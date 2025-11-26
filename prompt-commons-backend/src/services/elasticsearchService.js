// src/services/elasticsearchService.js
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
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const queryModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 쿼리 이해용

const INDEX_NAME = 'experiments';

/**
 * 재시도 로직 헬퍼 함수
 * @param {Function} operation - 실행할 비동기 함수
 * @param {number} retries - 최대 재시도 횟수
 * @param {number} delay - 초기 대기 시간 (ms)
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
 * 텍스트를 벡터로 변환 (Gemini text-embedding-004)
 * @param {string} text - 임베딩할 텍스트
 * @returns {Promise<number[]|null>} - 768차원 벡터 또는 null
 */
async function getEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('[ES Service] Embedding Error:', error.message);
    return null;
  }
}

/**
 * 자연어 쿼리를 분석하고 확장 (Gemini 사용)
 * @param {string} query - 사용자 검색 쿼리
 * @returns {Promise<Object>} - { keywords: string[], intent: string, expandedQuery: string }
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
    console.log(`[ES Service] Query analysis:`, analysis);

    return {
      keywords: analysis.keywords || [],
      intent: analysis.intent || 'search',
      expandedQuery: analysis.expandedQuery || query
    };
  } catch (error) {
    console.error('[ES Service] Query analysis error:', error.message);
    // Fallback: 기본 분석
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = ['how', 'to', 'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'what', 'when', 'where', 'why', 'which', 'who'];
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
 * @param {Object} params - 인덱싱할 실험 데이터
 * @param {string} params.id - 실험 ID
 * @param {string} params.title - 제목
 * @param {string} params.description - 설명
 * @param {string} params.promptText - 프롬프트 텍스트
 * @param {string} params.aiModel - AI 모델
 * @param {number} params.reproductionRate - 재현율
 * @param {string[]} params.tags - 태그 목록
 * @param {Date} params.createdAt - 생성일
 */
async function indexExperiment(params) {
  return withRetry(async () => {
    try {
      const { id, title, description, promptText, aiModel, reproductionRate, tags, createdAt } = params;

      // 검색에 사용할 텍스트 조합
      const textToEmbed = `Title: ${title}\nDescription: ${description || ''}\nPrompt: ${promptText}`;

      // Gemini로 임베딩 생성
      const embedding = await getEmbedding(textToEmbed);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for experiment ${id}`);
      }

      // Elasticsearch에 저장
      await esClient.index({
        index: INDEX_NAME,
        id: id.toString(),
        document: {
          id: id.toString(),
          title,
          description: description || '',
          promptText,
          aiModel,
          reproductionRate: reproductionRate || 0,
          tags: tags || [],
          createdAt,
          embedding
        }
      });

      console.log(`[ES Service] Indexed experiment ${id} successfully`);
      return { success: true };
    } catch (error) {
      // 재시도를 위해 에러를 던짐 (마지막 시도에서 catch됨)
      throw error;
    }
  }).catch(error => {
    console.error(`[ES Service] Index Error for experiment ${params.id}:`, error.message);
    return { success: false, error: error.message };
  });
}

/**
 * Elasticsearch에서 실험 삭제
 * @param {string} id - 실험 ID
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
        console.log(`[ES Service] Experiment ${id} not found in index (already deleted)`);
        return { success: true };
      }
      throw error;
    }
  }).catch(error => {
    console.error(`[ES Service] Delete Error for experiment ${id}:`, error.message);
    return { success: false, error: error.message };
  });
}

/**
 * 실험 정보 업데이트 (재인덱싱)
 * @param {Object} params - 업데이트할 실험 데이터
 */
async function updateExperiment(params) {
  // 업데이트는 재인덱싱으로 처리 (upsert)
  return indexExperiment(params);
}

/**
 * 자연어 검색 (하이브리드: 벡터 유사도 + 텍스트 매칭)
 * @param {Object} params - 검색 파라미터
 * @param {string} params.query - 검색어 (자연어)
 * @param {string} [params.model] - AI 모델 필터
 * @param {number} [params.minRate] - 최소 재현율 필터
 * @param {number} [params.page] - 페이지 번호
 * @param {number} [params.limit] - 페이지당 결과 수
 */
async function semanticSearch({ query, model, minRate = 0, page = 1, limit = 10 }) {
  try {
    // 1. 쿼리 검증
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      console.warn('[ES Service] Query too short:', query);
      return { success: true, data: [], total: 0, message: 'Query must be at least 2 characters' };
    }

    // 2. 검색어를 벡터로 변환
    const queryEmbedding = await getEmbedding(trimmedQuery);

    if (!queryEmbedding) {
      console.error('[ES Service] Failed to generate query embedding');
      return { success: false, error: 'Query embedding failed', data: [], total: 0 };
    }

    // 3. 필터 조건 구성
    const filters = [];

    if (model && model !== 'All') {
      filters.push({ term: { aiModel: model } });
    }

    if (minRate > 0) {
      filters.push({ range: { reproductionRate: { gte: minRate } } });
    }

    // 4. 쿼리 분석 (AI 기반)
    const queryWords = trimmedQuery.split(/\s+/).length;
    const isNaturalLanguage = queryWords >= 3; // 3단어 이상은 자연어 분석 적용

    let queryAnalysis = null;
    let searchMode = 'keyword';
    let MIN_SCORE = 0.72;

    if (isNaturalLanguage) {
      // AI로 쿼리 분석 (비동기, 병렬 처리)
      queryAnalysis = await analyzeQuery(trimmedQuery);
      searchMode = 'semantic';
      MIN_SCORE = 0.55; // 자연어는 더 낮은 임계값 (의미 중심)
      console.log(`[ES Service] NL Query: "${trimmedQuery}" → Expanded: "${queryAnalysis.expandedQuery}", Keywords: [${queryAnalysis.keywords.join(', ')}], Intent: ${queryAnalysis.intent}`);
    } else if (queryWords === 1) {
      MIN_SCORE = 0.72; // 단일 키워드: 높은 정밀도
    } else {
      MIN_SCORE = 0.68; // 2단어: 중간 정밀도
    }

    const CANDIDATE_SIZE = 100;

    // 5. 검색 전략: 자연어는 순수 벡터 + 약간의 키워드 보조
    let searchBody;

    if (searchMode === 'semantic' && queryAnalysis) {
      // 자연어 검색: AI 분석 결과로 확장된 쿼리 사용
      // 확장된 쿼리로 새로운 임베딩 생성
      const expandedEmbedding = await getEmbedding(queryAnalysis.expandedQuery);
      const finalEmbedding = expandedEmbedding || queryEmbedding;

      searchBody = {
        knn: {
          field: 'embedding',
          query_vector: finalEmbedding,
          k: CANDIDATE_SIZE,
          num_candidates: 200,
          filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
          boost: 100.0 // 벡터 검색 압도적 우선 (자연어는 의미가 핵심)
        },
        query: {
          bool: {
            should: [
              // AI가 추출한 핵심 키워드로만 매칭
              {
                multi_match: {
                  query: queryAnalysis.keywords.join(' '),
                  fields: ['title^3', 'tags^4', 'promptText'], // 제목과 태그 우선
                  type: 'best_fields',
                  boost: 1.0 // 벡터 대비 매우 낮은 가중치
                }
              }
            ],
            minimum_should_match: 0, // 벡터 검색만으로도 충분
            filter: filters
          }
        },
        size: CANDIDATE_SIZE,
        from: 0
      };
    } else {
      // 키워드 검색: 텍스트 매칭과 벡터 검색 균형
      searchBody = {
        knn: {
          field: 'embedding',
          query_vector: queryEmbedding,
          k: CANDIDATE_SIZE,
          num_candidates: 200,
          filter: filters.length > 0 ? { bool: { filter: filters } } : undefined,
          boost: 1.0 // 벡터 검색 가중치 기본
        },
        query: {
          bool: {
            should: [
              // 제목에서 키워드 매칭 (높은 가중치)
              {
                match: {
                  title: {
                    query: trimmedQuery,
                    boost: 2.5,
                    fuzziness: 'AUTO'
                  }
                }
              },
              // 설명에서 키워드 매칭
              {
                match: {
                  description: {
                    query: trimmedQuery,
                    boost: 1.5,
                    fuzziness: 'AUTO'
                  }
                }
              },
              // 프롬프트 텍스트에서 키워드 매칭
              {
                match: {
                  promptText: {
                    query: trimmedQuery,
                    boost: 1.0,
                    fuzziness: 'AUTO'
                  }
                }
              },
              // 태그 정확 매칭 (높은 가중치)
              {
                terms: {
                  tags: trimmedQuery.toLowerCase().split(/\s+/),
                  boost: 3.0
                }
              }
            ],
            minimum_should_match: 0,
            filter: filters
          }
        },
        size: CANDIDATE_SIZE,
        from: 0,
        // 재현율로 2차 정렬 (동일 점수일 때)
        sort: [
          { _score: { order: 'desc' } },
          { reproductionRate: { order: 'desc' } }
        ]
      };
    }

    const response = await esClient.search({
      index: INDEX_NAME,
      body: searchBody
    });

    const hits = response.hits.hits;

    // Debug Logging: Top 5 Results with detailed scoring
    if (hits.length > 0) {
      console.log(`[ES Service] Top 5 Hits for "${trimmedQuery}" (mode: ${searchMode}, threshold: ${MIN_SCORE}):`);
      hits.slice(0, 5).forEach((hit, idx) => {
        console.log(`   ${idx + 1}. [${hit._score.toFixed(4)}] ${hit._source.title} (ID: ${hit._id})`);
      });
    }

    // 6. 점수 정규화 및 필터링
    const maxScore = hits.length > 0 ? hits[0]._score : 1;
    const filteredHits = hits
      .map(hit => ({
        ...hit,
        _normalizedScore: hit._score / maxScore // 0-1 범위로 정규화
      }))
      .filter(hit => hit._normalizedScore >= (MIN_SCORE / maxScore));

    // 7. 전체 개수 계산 (필터링된 결과 기준)
    const total = filteredHits.length;

    // 8. 인메모리 페이지네이션
    const startIndex = (page - 1) * limit;
    const paginatedHits = filteredHits.slice(startIndex, startIndex + limit);

    // 9. 결과 포맷팅
    const results = paginatedHits.map(hit => ({
      id: hit._source.id,
      title: hit._source.title,
      description: hit._source.description,
      promptText: hit._source.promptText,
      aiModel: hit._source.aiModel,
      reproductionRate: hit._source.reproductionRate,
      tags: hit._source.tags,
      createdAt: hit._source.createdAt,
      score: hit._normalizedScore, // 정규화된 점수 (0-1)
      rawScore: hit._score // 원본 점수
    }));

    console.log(`[ES Service] ${searchMode === 'semantic' ? 'Semantic' : 'Keyword'} search: Query="${trimmedQuery}", Words=${queryWords}, Threshold=${MIN_SCORE}, RawHits=${hits.length}, Filtered=${total}, Returned=${results.length}`);

    return {
      success: true,
      data: results,
      total: total
    };
  } catch (error) {
    console.error('[ES Service] Semantic Search Error:', error.message);
    return { success: false, error: error.message, data: [], total: 0 };
  }
}

/**
 * 인덱스 존재 여부 확인
 * @param {string} indexName
 */
async function indexExists(indexName) {
  try {
    const exists = await esClient.indices.exists({ index: indexName });
    return exists;
  } catch (error) {
    console.error(`[ES Service] Error checking index ${indexName}:`, error.message);
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
  const BATCH_SIZE = 50; // 한 번에 처리할 개수

  try {
    // 1. 전체 개수 확인
    const totalCount = await prisma.experiment.count();
    console.log(`[ES Service] Found ${totalCount} experiments to sync.`);

    // 2. 배치 단위로 처리
    for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
      const experiments = await prisma.experiment.findMany({
        skip,
        take: BATCH_SIZE,
        include: {
          activeVersion: {
            include: {
              tags: true
            }
          }
        }
      });

      const bulkOperations = [];

      for (const exp of experiments) {
        const version = exp.activeVersion;
        if (!version) continue;

        const tags = version.tags.map(t => t.tagName);
        const textToEmbed = `Title: ${exp.title}\nDescription: ${version.promptDescription || ''}\nPrompt: ${version.promptText}`;

        // 임베딩 생성 (개별적으로 생성해야 함 - Gemini API 제한 주의)
        // 병렬 처리 시 Rate Limit 걸릴 수 있으므로 순차 처리 권장
        const embedding = await getEmbedding(textToEmbed);

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
          console.error(`[ES Service] Failed to generate embedding for experiment ${exp.id} during sync`);
          errorCount++;
        }
      }

      if (bulkOperations.length > 0) {
        const bulkResponse = await esClient.bulk({ refresh: true, operations: bulkOperations });

        if (bulkResponse.errors) {
          const erroredDocuments = [];
          bulkResponse.items.forEach((action, i) => {
            const operation = Object.keys(action)[0];
            if (action[operation].error) {
              erroredDocuments.push({
                status: action[operation].status,
                error: action[operation].error,
              });
              errorCount++;
            } else {
              syncedCount++;
            }
          });
          console.error('[ES Service] Bulk sync errors:', erroredDocuments);
        } else {
          syncedCount += bulkOperations.length / 2;
        }
      }

      console.log(`[ES Service] Synced ${Math.min(skip + BATCH_SIZE, totalCount)}/${totalCount} experiments...`);
    }

    console.log(`[ES Service] Full sync completed. Success: ${syncedCount}, Errors: ${errorCount}`);
    return { success: true, syncedCount, errorCount, totalCount };

  } catch (error) {
    console.error('[ES Service] Full sync failed:', error);
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
  INDEX_NAME
};
