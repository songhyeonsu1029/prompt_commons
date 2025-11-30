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
 * 실험 데이터를 Elasticsearch에 인덱싱
 */
async function indexExperiment(params) {
  return withRetry(async () => {
    try {
      const { id, title, description, promptText, aiModel, reproductionRate, tags, createdAt } = params;

      // 검색에 사용할 텍스트 조합
      const textToEmbed = `Title: ${title}\nDescription: ${description || ''}\nPrompt: ${promptText}`;

      // Gemini로 임베딩 생성
      let embedding = null;
      try {
        embedding = await getEmbedding(textToEmbed);
      } catch (err) {
        console.error(`[ES Service] Embedding generation failed for ${id}: ${err.message}`);
        // 임베딩 실패해도 텍스트 검색은 되도록 진행
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
        createdAt
      };

      if (embedding) {
        doc.embedding = embedding;
      }

      // Upsert (인덱싱)
      await esClient.index({
        index: INDEX_NAME,
        id: id.toString(),
        document: doc
      });

      console.log(`[ES Service] Indexed Experiment ID: ${id}`);
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
async function semanticSearch({ query, model, minRate = 0, page = 1, limit = 10 }) {
  try {
    // 1. 쿼리 검증
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
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

    // 3. 검색 모드 결정 (3단어 이상 = 자연어 검색)
    const queryWords = trimmedQuery.split(/\s+/).length;
    const isNaturalLanguage = queryWords >= 3;

    let searchBody;
    let searchMode = 'keyword';
    let MIN_SCORE = 0.65; // 기본 임계값

    if (isNaturalLanguage) {
      searchMode = 'semantic';
      MIN_SCORE = 0.55; // 자연어 검색은 조금 더 관대하게 (0.6 -> 0.55 조정)

      // 3-1. AI 쿼리 분석
      let queryAnalysis = await analyzeQuery(trimmedQuery);

      // 3-2. 확장된 쿼리로 임베딩 생성
      let embedding = null;
      try {
        embedding = await getEmbedding(queryAnalysis.expandedQuery);
      } catch (err) { } //

      if (embedding) {
        // 3-3. 하이브리드 검색 (벡터 + 키워드 보조)
        searchBody = {
          knn: {
            field: 'embedding',
            query_vector: embedding,
            k: 100,
            num_candidates: 200,
            filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
            boost: 0.5 // 벡터 비중을 조금 낮추고
          },
          query: {
            bool: {
              should: [
                // 키워드 매칭 (제목에 가중치 대폭 부여)
                {
                  multi_match: {
                    query: trimmedQuery, // 원본 쿼리 사용
                    fields: ['title^5', 'tags^3', 'promptText^1'],
                    type: 'best_fields',
                    boost: 0.5 // 키워드 비중
                  }
                }
              ],
              filter: filters
            }
          }
        };
      } else {
        // 임베딩 실패 시 키워드 검색 Fallback
        searchMode = 'keyword_fallback';
        searchBody = {
          query: {
            bool: {
              should: [
                { multi_match: { query: queryAnalysis.expandedQuery, fields: ['title^3', 'description', 'promptText'], boost: 2.0 } }
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
          knn: {
            field: 'embedding',
            query_vector: embedding,
            k: 50,
            num_candidates: 100,
            filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
            boost: 0.3
          },
          query: {
            bool: {
              should: [
                { multi_match: { query: trimmedQuery, fields: ['title^10', 'tags^5', 'promptText'], fuzziness: 'AUTO', boost: 0.7 } }
              ],
              filter: filters
            }
          }
        };
      } else {
        searchBody = {
          query: {
            bool: {
              must: { multi_match: { query: trimmedQuery, fields: ['title^3', 'tags^2', 'promptText'], fuzziness: 'AUTO' } },
              filter: filters
            }
          }
        };
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
    const maxScore = hits.length > 0 ? hits[0]._score : 1;
    const filteredHits = hits
      .map(hit => ({
        ...hit,
        _normalizedScore: hit._score / maxScore
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

    console.log(`[ES Service] Search (${searchMode}): Query="${trimmedQuery}", Hits=${hits.length} -> Filtered=${total}`);

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
        const textToEmbed = `Title: ${exp.title}\nDescription: ${version.promptDescription || ''}\nPrompt: ${version.promptText}`;

        // Gemini API Rate Limit 방지를 위한 지연 처리
        await sleep(500); // 0.5초 대기 (필요시 조절)

        let embedding = null;
        try {
          embedding = await getEmbedding(textToEmbed);
        } catch (e) {
          console.warn(`Failed embedding for exp ${exp.id}`);
        }

        if (embedding) {
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
            embedding: embedding
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
            embedding: {
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
