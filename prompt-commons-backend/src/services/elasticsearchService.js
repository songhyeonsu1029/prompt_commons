// src/services/elasticsearchService.js
const { Client } = require('@elastic/elasticsearch');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Elasticsearch 클라이언트 초기화
const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const INDEX_NAME = 'experiments';

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
async function indexExperiment({ id, title, description, promptText, aiModel, reproductionRate, tags, createdAt }) {
  try {
    // 검색에 사용할 텍스트 조합
    const textToEmbed = `Title: ${title}\nDescription: ${description || ''}\nPrompt: ${promptText}`;

    // Gemini로 임베딩 생성
    const embedding = await getEmbedding(textToEmbed);

    if (!embedding) {
      console.error(`[ES Service] Failed to generate embedding for experiment ${id}`);
      return { success: false, error: 'Embedding generation failed' };
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
    console.error(`[ES Service] Index Error for experiment ${id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Elasticsearch에서 실험 삭제
 * @param {string} id - 실험 ID
 */
async function deleteExperiment(id) {
  try {
    await esClient.delete({
      index: INDEX_NAME,
      id: id.toString()
    });
    console.log(`[ES Service] Deleted experiment ${id} from index`);
    return { success: true };
  } catch (error) {
    // 문서가 없는 경우는 에러로 처리하지 않음
    if (error.meta?.statusCode === 404) {
      console.log(`[ES Service] Experiment ${id} not found in index (already deleted)`);
      return { success: true };
    }
    console.error(`[ES Service] Delete Error for experiment ${id}:`, error.message);
    return { success: false, error: error.message };
  }
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
 * 자연어 검색 (벡터 유사도 + 텍스트 매칭)
 * @param {Object} params - 검색 파라미터
 * @param {string} params.query - 검색어 (자연어)
 * @param {string} [params.model] - AI 모델 필터
 * @param {number} [params.minRate] - 최소 재현율 필터
 * @param {number} [params.page] - 페이지 번호
 * @param {number} [params.limit] - 페이지당 결과 수
 */
async function semanticSearch({ query, model, minRate = 0, page = 1, limit = 10 }) {
  try {
    // 검색어를 벡터로 변환
    const queryEmbedding = await getEmbedding(query);

    if (!queryEmbedding) {
      console.error('[ES Service] Failed to generate query embedding');
      return { success: false, error: 'Query embedding failed', data: [], total: 0 };
    }

    // 필터 조건 구성
    const filters = [];

    if (model && model !== 'All') {
      filters.push({ term: { aiModel: model } });
    }

    if (minRate > 0) {
      filters.push({ range: { reproductionRate: { gte: minRate } } });
    }

    // knn 쿼리 구성 (벡터 유사도 검색)
    const searchBody = {
      knn: {
        field: 'embedding',
        query_vector: queryEmbedding,
        k: limit * 2, // 필터링 후 결과를 위해 여유있게 가져옴
        num_candidates: 100
      },
      size: limit,
      from: (page - 1) * limit
    };

    // 필터가 있으면 추가
    if (filters.length > 0) {
      searchBody.query = {
        bool: {
          filter: filters
        }
      };
    }

    const response = await esClient.search({
      index: INDEX_NAME,
      body: searchBody
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'object'
      ? response.hits.total.value
      : response.hits.total;

    const results = hits.map(hit => ({
      id: hit._source.id,
      title: hit._source.title,
      description: hit._source.description,
      promptText: hit._source.promptText,
      aiModel: hit._source.aiModel,
      reproductionRate: hit._source.reproductionRate,
      tags: hit._source.tags,
      createdAt: hit._source.createdAt,
      score: hit._score // 유사도 점수
    }));

    console.log(`[ES Service] Semantic search found ${results.length} results for query: "${query}"`);

    return {
      success: true,
      data: results,
      total: total || results.length
    };
  } catch (error) {
    console.error('[ES Service] Semantic Search Error:', error.message);
    return { success: false, error: error.message, data: [], total: 0 };
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
 * 인덱스 존재 여부 확인
 */
async function indexExists() {
  try {
    return await esClient.indices.exists({ index: INDEX_NAME });
  } catch (error) {
    return false;
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
  INDEX_NAME
};
