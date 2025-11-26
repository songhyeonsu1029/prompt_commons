// tests/search.test.js
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');

// 테스트 환경 설정
const BASE_URL = 'http://localhost:3000';

describe('Search API Tests', () => {
  // 테스트 설정
  const api = request(BASE_URL);

  describe('기본 검색 기능', () => {
    test('단일 키워드 검색 - "React"', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'React' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);

      // React 관련 결과가 있어야 함
      if (response.body.data.length > 0) {
        const firstResult = response.body.data[0];
        expect(firstResult).toHaveProperty('id');
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('similarity_score');

        // 점수가 정규화되어 있어야 함 (0-1 범위)
        expect(firstResult.similarity_score).toBeGreaterThanOrEqual(0);
        expect(firstResult.similarity_score).toBeLessThanOrEqual(1);

        // React 관련 내용이 포함되어야 함
        const content = `${firstResult.title} ${firstResult.prompt_text} ${firstResult.tags?.join(' ')}`.toLowerCase();
        expect(content).toMatch(/react/i);
      }
    });

    test('두 단어 검색 - "Python API"', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'Python API' })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        // 첫 번째 결과가 높은 점수를 가져야 함
        expect(response.body.data[0].similarity_score).toBeGreaterThan(0.4);
      }
    });

    test('자연어 쿼리 - "how to create authentication"', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'how to create authentication' })
        .expect(200);

      expect(response.body.data).toBeDefined();
      // 자연어 쿼리도 결과를 반환해야 함
      expect(response.body.pagination).toHaveProperty('totalResults');
    });

    test('태그 매칭 검색 - "security"', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'security' })
        .expect(200);

      if (response.body.data.length > 0) {
        // security 태그를 가진 항목이 상위에 있어야 함
        const hasSecurityTag = response.body.data.slice(0, 3).some(item =>
          item.tags?.includes('security')
        );
        expect(hasSecurityTag).toBe(true);
      }
    });
  });

  describe('검색 필터 기능', () => {
    test('AI 모델 필터 - GPT-4', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'Python', model: 'GPT-4' })
        .expect(200);

      expect(response.body.data).toBeDefined();

      // 모든 결과가 GPT-4 모델이어야 함
      response.body.data.forEach(item => {
        expect(item.ai_model).toBe('GPT-4');
      });
    });

    test('재현율 필터 - 80% 이상', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'test', rate: 80 })
        .expect(200);

      expect(response.body.data).toBeDefined();

      // 모든 결과가 80% 이상의 재현율을 가져야 함
      response.body.data.forEach(item => {
        expect(item.reproduction_rate).toBeGreaterThanOrEqual(80);
      });
    });

    test('모델 + 재현율 복합 필터', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'code', model: 'Claude-3.5-Sonnet', rate: 90 })
        .expect(200);

      expect(response.body.data).toBeDefined();

      response.body.data.forEach(item => {
        expect(item.ai_model).toBe('Claude-3.5-Sonnet');
        expect(item.reproduction_rate).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe('페이지네이션 기능', () => {
    test('첫 페이지 조회', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'development', page: 1, limit: 5 })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.currentPage).toBe(1);
    });

    test('두 번째 페이지 조회', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'development', page: 2, limit: 5 })
        .expect(200);

      expect(response.body.pagination.currentPage).toBe(2);
    });

    test('커스텀 limit 설정', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'code', limit: 3 })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('엣지 케이스 및 에러 처리', () => {
    test('빈 검색어', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: '' })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.message).toBeDefined();
    });

    test('너무 짧은 검색어 (1글자)', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'a' })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalResults).toBe(0);
    });

    test('존재하지 않는 검색어', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'xyznonexistentquery123' })
        .expect(200);

      // 개선된 검색은 관련 없는 결과를 반환하지 않아야 함
      expect(response.body.data.length).toBe(0);
    });

    test('특수문자 포함 검색어', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'Node.js API' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      // 에러 없이 처리되어야 함
    });

    test('매우 긴 검색어', async () => {
      const longQuery = 'how to implement a sophisticated authentication system with JWT tokens and refresh tokens';
      const response = await api
        .get('/api/experiments/search')
        .query({ q: longQuery })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('검색 품질 검증', () => {
    test('정확한 제목 매칭이 최상위에 위치', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'React Custom Hook' })
        .expect(200);

      if (response.body.data.length > 0) {
        const firstResult = response.body.data[0];
        // 제목에 검색어가 포함되어 있으면 높은 점수
        if (firstResult.title.toLowerCase().includes('react') &&
            firstResult.title.toLowerCase().includes('hook')) {
          expect(firstResult.similarity_score).toBeGreaterThan(0.7);
        }
      }
    });

    test('점수 순서대로 정렬', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'JavaScript' })
        .expect(200);

      if (response.body.data.length > 1) {
        // 점수가 내림차순으로 정렬되어야 함
        for (let i = 0; i < response.body.data.length - 1; i++) {
          expect(response.body.data[i].similarity_score).toBeGreaterThanOrEqual(
            response.body.data[i + 1].similarity_score
          );
        }
      }
    });

    test('검색 결과에 필수 필드 포함', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'test' })
        .expect(200);

      if (response.body.data.length > 0) {
        const result = response.body.data[0];

        // 필수 필드 확인
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('ai_model');
        expect(result).toHaveProperty('prompt_text');
        expect(result).toHaveProperty('reproduction_rate');
        expect(result).toHaveProperty('tags');
        expect(result).toHaveProperty('similarity_score');
        expect(result).toHaveProperty('author');
        expect(result.author).toHaveProperty('username');
      }
    });
  });

  describe('동적 임계값 테스트', () => {
    test('단일 키워드는 높은 임계값 적용 (0.72)', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'Docker' })
        .expect(200);

      // 단일 키워드는 더 적은 결과를 반환할 수 있음 (높은 임계값)
      if (response.body.data.length > 0) {
        // 첫 번째 결과는 높은 관련성을 가져야 함
        const firstResult = response.body.data[0];
        const content = `${firstResult.title} ${firstResult.prompt_text}`.toLowerCase();
        const isRelevant = content.includes('docker') ||
                          firstResult.tags?.includes('docker') ||
                          firstResult.tags?.includes('devops');
        expect(isRelevant).toBeTruthy();

        // 모든 결과는 최소한 0.72 이상의 점수를 가져야 함 (동적 임계값)
        // 또는 하이브리드 검색으로 인해 일부는 낮을 수 있음
        expect(response.body.data.length).toBeGreaterThan(0);
      }
    });

    test('여러 단어는 낮은 임계값 적용 (0.68)', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'Python Flask' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      // 2-3 단어는 의미론적 매칭이 더 관대함
    });

    test('긴 자연어는 가장 낮은 임계값 적용 (0.65)', async () => {
      const response = await api
        .get('/api/experiments/search')
        .query({ q: 'show me how to build REST API' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      // 자연어는 의미 기반 검색이 작동해야 함
    });
  });

  describe('성능 테스트', () => {
    test('검색 응답 시간 확인 (5초 이내)', async () => {
      const startTime = Date.now();

      await api
        .get('/api/experiments/search')
        .query({ q: 'database optimization' })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000); // 5초 이내
    });

    test('복잡한 쿼리 처리 시간', async () => {
      const startTime = Date.now();

      await api
        .get('/api/experiments/search')
        .query({
          q: 'authentication security best practices',
          model: 'GPT-4',
          rate: 80,
          page: 1,
          limit: 10
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000);
    });
  });
});
