const { Client } = require('@elastic/elasticsearch');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Elasticsearch 클라이언트 초기화
const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
const queryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const INDEX_NAME = 'experiments';

/**
 * 재시도 로직 헬퍼 함수
 */
async function withRetry(operation, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`[ES Service] Operation failed, retrying (${i + 1}/${retries})... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

/**
 * 유틸리티: 지연 함수 (Rate Limit 방지용)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 텍스트를 벡터로 변환 (Gemini text-embedding-004)
 */
async function getEmbedding(text) {
  return withRetry(async () => {
    try {
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text: text }] },
        outputDimensionality: 768
      });
      return result.embedding.values;
    } catch (error) {
      console.error('[ES Service] Embedding Error:', error.message);
      throw error; // 재시도를 위해 에러 throw
    }
  }, 3, 2000); // 임베딩은 중요하므로 재시도 적용
}

/**
 * 자연어 쿼리를 분석하고 확장 (Gemini 사용)
 */
async function analyzeQuery(query) {
  try {
    const prompt = `You are a search query analyzer for a programming prompts repository.

Analyze this search query and extract:
1. Core keywords (2-5 important technical terms only, no filler words)
2. User intent (what they want to do: "learn", "implement", "debug", "optimize", etc.)
3. Expanded query (rewrite as a clear, concise search phrase)

Query: "${query}"

Respond ONLY in this JSON format, no other text:
{
  "keywords": ["keyword1", "keyword2"],
  "intent": "intent_verb",
  "expandedQuery": "clear search phrase"
}`;

    const result = await queryModel.generateContent(prompt);
    const response = result.response.text().trim();

    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonText = response;
    if (response.includes('```')) {
      jsonText = response.match(/\{[\s\S]*\}/)?.[0] || response;
    }

    const analysis = JSON.parse(jsonText);
    // console.log(`[ES Service] Query analysis:`, analysis); // 로그 너무 많으면 주석 처리

    return {
      keywords: analysis.keywords || [],
      intent: analysis.intent || 'search',
      expandedQuery: analysis.expandedQuery || query
    };
  } catch (error) {
    // console.error('[ES Service] Query analysis error:', error.message);
    // Fallback: 기본 분석
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = ['how', 'to', 'a', 'an', 'the', 'is', 'are', 'function', 'code'];
    const keywords = words.filter(w => !stopWords.includes(w) && w.length > 2);

    return {
      keywords: keywords.slice(0, 5),
      intent: 'search',
      expandedQuery: query
    };
  }
}

/**
 * 실험에 대한 3가지 검색 관점(Problem, Tech, Solution) 생성
 */
async function generateSearchPerspectives(experiment) {
  try {
    const prompt = `
Analyze this programming experiment and generate 3 distinct, short search queries a developer would type to find this.
Focus on these 3 perspectives:
1. Problem: The error, bug, or issue being solved (e.g., "fix react re-render", "memory leak loop").
2. Tech: The specific technology, library, or version (e.g., "Next.js 14 server actions", "Python 3.11 asyncio").
3. Solution: The outcome, benefit, or technique used (e.g., "seo optimization guide", "reduce latency 50%").

Experiment Title: ${experiment.title}
Prompt Text: ${experiment.promptText}

Respond ONLY in this JSON format:
{
  "problem": "search phrase for problem",
  "tech": "search phrase for tech",
  "solution": "search phrase for solution"
}
`;

    const result = await queryModel.generateContent(prompt);
    const response = result.response.text().trim();

    let jsonText = response;
    if (response.includes('```')) {
      jsonText = response.match(/\{[\s\S]*\}/)?.[0] || response;
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('[ES Service] Perspective generation failed:', error.message);
    // Fallback
    return {
      problem: experiment.title,
      tech: experiment.aiModel || '',
      solution: experiment.title
    };
  }
}

/**
 * 실험 데이터를 Elasticsearch에 인덱싱 (Multi-Vector)
 */
async function indexExperiment(params) {
  return withRetry(async () => {
    try {
      const { id, title, description, promptText, aiModel, reproductionRate, tags, createdAt } = params;

      // 1. Generate Search Perspectives
      const perspectives = await generateSearchPerspectives({ title, promptText, aiModel });

      // 2. Generate Embeddings for each perspective
      // Sequential generation to respect rate limits
      let vec_problem = null;
      let vec_tech = null;
      let vec_solution = null;

      try {
        vec_problem = await getEmbedding(perspectives.problem);
        await sleep(500);
        vec_tech = await getEmbedding(perspectives.tech);
        await sleep(500);
        vec_solution = await getEmbedding(perspectives.solution);
      } catch (err) {
        console.error(`[ES Service] Embedding generation failed for ${id}: ${err.message}`);
      }

      // Elasticsearch에 저장할 문서
      const doc = {
        id: id.toString(),
        title,
        description: description || '',
        promptText,
        aiModel,
        reproductionRate: reproductionRate || 0,
        tags: tags || [],
        createdAt,

        // Text Fields
        text_problem: perspectives.problem,
        text_tech: perspectives.tech,
        text_solution: perspectives.solution,

        // Vector Fields
        vec_problem: vec_problem || [],
        vec_tech: vec_tech || [],
        vec_solution: vec_solution || []
      };

      // Upsert (인덱싱)
      await esClient.index({
        index: INDEX_NAME,
        id: id.toString(),
        document: doc
      });

      console.log(`[ES Service] Indexed Experiment ID: ${id} with Multi-Vectors`);
      return { success: true };

    } catch (error) {
      console.error('[ES Service] Indexing Error:', error);
      throw error;
    }
  });
}

/**
 * 자연어 검색(하이브리드: 벡터 유사도 + 텍스트 매칭)
 */
async function semanticSearch({ query, tag, model, minRate = 0, page = 1, limit = 10 }) {
  try {
    // 1. 쿼리 검증 (태그 검색인 경우 쿼리 길이 제한 무시)
    const trimmedQuery = query ? query.trim() : '';
    if (!tag && trimmedQuery.length < 2) {
      return { success: true, data: [], total: 0, message: 'Query must be at least 2 characters' };
    }

    // 2. 필터 조건 구성
    const filters = [];
    if (model && model !== 'All') {
      filters.push({ term: { aiModel: model } });
    }
    if (minRate > 0) {
      filters.push({ range: { reproductionRate: { gte: minRate } } });
    }
    // 태그 필터 추가
    if (tag) {
      filters.push({ term: { tags: tag } });
    }

    let searchBody;
    let searchMode = 'keyword';
    let MIN_SCORE = 0.0; // 태그 검색 시 점수 무관하게 반환

    // 태그 검색이 있는 경우 (쿼리가 없어도 됨)
    if (tag) {
      searchMode = 'tag_filter';
      searchBody = {
        query: {
          bool: {
            must: trimmedQuery ? { multi_match: { query: trimmedQuery, fields: ['title^3', 'promptText'], fuzziness: 'AUTO' } } : { match_all: {} },
            filter: filters
          }
        },
        sort: [
          { createdAt: { order: "desc" } } // 태그 검색 시 최신순 정렬
        ]
      };
    } else {
      // 기존 검색 로직 (자연어/키워드)
      MIN_SCORE = 0.65; // 기본 임계값

      // 3. 검색 모드 결정 (3단어 이상 = 자연어 검색)
      const queryWords = trimmedQuery.split(/\s+/).length;
      const isNaturalLanguage = queryWords >= 3;

      if (isNaturalLanguage) {
        searchMode = 'semantic';
        MIN_SCORE = 0.55; // 자연어 검색은 조금 더 관대하게 (0.6 -> 0.55 조정)

        // 3-1. AI 쿼리 분석 (Gemini로 키워드 추출 + 의도 파악)
        let queryAnalysis = await analyzeQuery(trimmedQuery);

        // 3-2. 확장된 쿼리로 임베딩 생성
        let embedding = null;
        try {
          embedding = await getEmbedding(queryAnalysis.expandedQuery);
        } catch (err) { } //

        if (embedding) {
          // 3-3. 하이브리드 검색 (Multi-Vector + 추출된 키워드 매칭)
          // Gemini가 추출한 키워드를 검색 쿼리로 사용
          const extractedKeywords = queryAnalysis.keywords.join(' ');

          searchBody = {
            knn: [
              {
                field: 'vec_problem',
                query_vector: embedding,
                k: 50,
                num_candidates: 200,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.3
              },
              {
                field: 'vec_tech',
                query_vector: embedding,
                k: 50,
                num_candidates: 200,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.3
              },
              {
                field: 'vec_solution',
                query_vector: embedding,
                k: 50,
                num_candidates: 200,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.4
              }
            ],
            query: {
              bool: {
                should: [
                  // 1) 추출된 키워드로 정확한 매칭 (높은 가중치)
                  {
                    multi_match: {
                      query: extractedKeywords,
                      fields: ['title^7', 'tags^5', 'promptText^2', 'text_problem^3', 'text_tech^3', 'text_solution^3'],
                      type: 'best_fields',
                      boost: 0.6 // 추출된 키워드에 높은 비중
                    }
                  },
                  // 2) 원본 쿼리로도 매칭 (보조적 역할, 낮은 가중치)
                  {
                    multi_match: {
                      query: trimmedQuery,
                      fields: ['title^3', 'description^1', 'promptText^1', 'text_problem', 'text_tech', 'text_solution'],
                      type: 'best_fields',
                      fuzziness: 'AUTO',
                      boost: 0.3 // 원본 쿼리는 보조
                    }
                  }
                ],
                filter: filters
              }
            }
          };

          console.log(`[ES Service] Multi-Vector Search - Original: "${trimmedQuery}", Keywords: "${extractedKeywords}", Intent: "${queryAnalysis.intent}"`);
        } else {
          // 임베딩 실패 시 키워드 검색 Fallback
          searchMode = 'keyword_fallback';
          const extractedKeywords = queryAnalysis.keywords.join(' ');

          searchBody = {
            query: {
              bool: {
                should: [
                  { multi_match: { query: extractedKeywords, fields: ['title^5', 'tags^3', 'promptText', 'text_problem^2', 'text_tech^2', 'text_solution^2'], boost: 2.5 } },
                  { multi_match: { query: queryAnalysis.expandedQuery, fields: ['title^3', 'description', 'promptText'], boost: 1.5 } }
                ],
                filter: filters
              }
            }
          };
        }

      } else {
        // 4. 단순 키워드 검색 (3단어 미만)
        searchMode = 'keyword';
        MIN_SCORE = 0.68; // 키워드 검색은 정확도 중요

        // 짧은 단어도 임베딩을 시도는 해봄 (하이브리드)
        let embedding = null;
        try { embedding = await getEmbedding(trimmedQuery); } catch (e) { } //

        if (embedding) {
          searchBody = {
            knn: [
              {
                field: 'vec_problem',
                query_vector: embedding,
                k: 30,
                num_candidates: 100,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.2
              },
              {
                field: 'vec_tech',
                query_vector: embedding,
                k: 30,
                num_candidates: 100,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.2
              },
              {
                field: 'vec_solution',
                query_vector: embedding,
                k: 30,
                num_candidates: 100,
                filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
                boost: 0.2
              }
            ],
            query: {
              bool: {
                should: [
                  { multi_match: { query: trimmedQuery, fields: ['title^10', 'tags^5', 'promptText', 'text_problem', 'text_tech', 'text_solution'], fuzziness: 'AUTO', boost: 0.7 } }
                ],
                filter: filters
              }
            }
          };
        } else {
          searchBody = {
            query: {
              bool: {
                must: { multi_match: { query: trimmedQuery, fields: ['title^3', 'tags^2', 'promptText', 'text_problem', 'text_tech', 'text_solution'], fuzziness: 'AUTO' } },
                filter: filters
              }
            }
          };
        }
      }
    }

    // 5. 검색 실행
    searchBody.size = 100; // 후보군 확보
    searchBody.from = 0;

    const response = await esClient.search({
      index: INDEX_NAME,
      body: searchBody
    });

    const hits = response.hits.hits;

    // 6. 점수 정규화 및 필터링
    const maxScore = hits.length > 0 ? (hits[0]._score || 1) : 1;
    const filteredHits = hits
      .map(hit => ({
        ...hit,
        _normalizedScore: (hit._score || 1) / maxScore
      }))
      .filter(hit => hit._normalizedScore >= MIN_SCORE);

    // 7. 페이지네이션 (In-Memory)
    const total = filteredHits.length;
    const startIndex = (page - 1) * limit;
    const paginatedHits = filteredHits.slice(startIndex, startIndex + limit);

    // 8. 결과 반환
    const results = paginatedHits.map(hit => ({
      id: hit._source.id,
      title: hit._source.title,
      description: hit._source.description,
      promptText: hit._source.promptText,
      aiModel: hit._source.aiModel,
      reproductionRate: hit._source.reproductionRate,
      tags: hit._source.tags,
      createdAt: hit._source.createdAt,
      score: hit._normalizedScore
    }));

    console.log(`[ES Service] Search (${searchMode}): Query="${trimmedQuery}", Tag="${tag || ''}", Hits=${hits.length} -> Filtered=${total}`);

    return {
      success: true,
      data: results,
      total: total
    };

  } catch (error) {
    console.error('[ES Service] Search Error:', error.message);
    return { success: false, error: error.message, data: [], total: 0 };
  }
}

/**
 * Elasticsearch에서 실험 삭제
 */
async function deleteExperiment(id) {
  return withRetry(async () => {
    try {
      await esClient.delete({
        index: INDEX_NAME,
        id: id.toString()
      });
      console.log(`[ES Service] Deleted experiment ${id} from index`);
      return { success: true };
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        // 이미 삭제된 경우
        return { success: true };
      }
      throw error;
    }
  });
}

/**
 * 실험 정보 업데이트
 */
async function updateExperiment(params) {
  return indexExperiment(params);
}

/**
 * 인덱스 존재 여부 확인
 */
async function indexExists(indexName) {
  try {
    const exists = await esClient.indices.exists({ index: indexName });
    return exists;
  } catch (error) {
    return false;
  }
}

/**
 * Elasticsearch 연결 상태 확인
 */
async function checkConnection() {
  try {
    const health = await esClient.cluster.health();
    return { connected: true, status: health.status };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * 모든 실험 데이터를 MySQL에서 가져와 Elasticsearch에 동기화 (Bulk Indexing)
 */
async function syncAllExperiments() {
  console.log('[ES Service] Starting full sync...');
  let syncedCount = 0;
  let errorCount = 0;
  const BATCH_SIZE = 50;

  try {
    const totalCount = await prisma.experiment.count();
    console.log(`[ES Service] Found ${totalCount} experiments to sync.`);

    let cursor = null;
    let processed = 0;

    while (true) {
      const experiments = await prisma.experiment.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        include: {
          activeVersion: {
            include: { tags: true }
          }
        }
      });

      if (experiments.length === 0) break;

      const bulkOperations = [];

      for (const exp of experiments) {
        const version = exp.activeVersion;
        if (!version) continue;

        const tags = version.tags.map(t => t.tagName);

        // 1. Generate Perspectives
        const perspectives = await generateSearchPerspectives({
          title: exp.title,
          promptText: version.promptText,
          aiModel: version.aiModel
        });

        // 2. Generate Embeddings (Sequential)
        let vec_problem = null;
        let vec_tech = null;
        let vec_solution = null;

        try {
          vec_problem = await getEmbedding(perspectives.problem);
          await sleep(500);
          vec_tech = await getEmbedding(perspectives.tech);
          await sleep(500);
          vec_solution = await getEmbedding(perspectives.solution);
        } catch (e) {
          console.warn(`Failed embedding for exp ${exp.id}`);
        }

        if (vec_problem) { // At least one embedding succeeded (or check all?)
          bulkOperations.push({ index: { _index: INDEX_NAME, _id: exp.id.toString() } });
          bulkOperations.push({
            id: exp.id.toString(),
            title: exp.title,
            description: version.promptDescription || '',
            promptText: version.promptText,
            aiModel: version.aiModel,
            reproductionRate: version.reproductionRate || 0,
            tags: tags,
            createdAt: exp.createdAt,

            text_problem: perspectives.problem,
            text_tech: perspectives.tech,
            text_solution: perspectives.solution,

            vec_problem: vec_problem || [],
            vec_tech: vec_tech || [],
            vec_solution: vec_solution || []
          });
        } else {
          errorCount++;
        }
      }

      if (bulkOperations.length > 0) {
        const bulkResponse = await esClient.bulk({ refresh: true, operations: bulkOperations });
        if (bulkResponse.errors) {
          // 에러 상세 로깅
          const errors = bulkResponse.items.filter(item => item.index && item.index.error);
          console.error("Bulk errors:", JSON.stringify(errors, null, 2));
          errorCount += errors.length;
          syncedCount += (bulkOperations.length / 2) - errors.length;
        } else {
          syncedCount += bulkOperations.length / 2;
        }
      }

      processed += experiments.length;
      console.log(`[ES Service] Processed ${processed}/${totalCount} experiments...`);

      cursor = experiments[experiments.length - 1].id;
    }

    console.log(`[ES Service] Full sync completed. Success: ${syncedCount}, Errors: ${errorCount}`);
    return { success: true, syncedCount, errorCount, totalCount };

  } catch (error) {
    console.error('[ES Service] Full sync failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 인덱스 초기화 (삭제 후 재생성)
 */
async function resetIndex() {
  try {
    await esClient.indices.delete({ index: INDEX_NAME, ignore_unavailable: true });

    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: { type: 'text' },
            description: { type: 'text' },
            promptText: { type: 'text' },
            aiModel: { type: 'keyword' },
            reproductionRate: { type: 'float' },
            tags: { type: 'keyword' },
            createdAt: { type: 'date' },

            // New Text Fields
            text_problem: { type: 'text' },
            text_tech: { type: 'text' },
            text_solution: { type: 'text' },

            // New Vector Fields
            vec_problem: {
              type: 'dense_vector',
              dims: 768,
              index: true,
              similarity: 'cosine'
            },
            vec_tech: {
              type: 'dense_vector',
              dims: 768,
              index: true,
              similarity: 'cosine'
            },
            vec_solution: {
              type: 'dense_vector',
              dims: 768,
              index: true,
              similarity: 'cosine'
            }
          }
        }
      }
    });
    console.log(`[ES Service] Index '${INDEX_NAME}' reset successfully.`);
    return { success: true };
  } catch (error) {
    console.error('[ES Service] Index reset failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getEmbedding,
  indexExperiment,
  deleteExperiment,
  updateExperiment,
  semanticSearch,
  checkConnection,
  indexExists,
  syncAllExperiments,
  resetIndex,
  INDEX_NAME
};
