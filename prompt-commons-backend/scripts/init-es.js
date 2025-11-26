// scripts/init-es.js
require('dotenv').config();
const { Client } = require('@elastic/elasticsearch');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require("@google/generative-ai");


// 1. 클라이언트 초기화
const esClient = new Client({ node: process.env.ELASTICSEARCH_NODE });
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

const INDEX_NAME = 'experiments';

// 벡터 변환 함수 (Gemini)
async function getEmbedding(text) {
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Embedding Error:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 [Gemini] Elasticsearch 초기화 시작...');

  // 2. 기존 인덱스 삭제 (초기화용)
  const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
  if (indexExists) {
    console.log('🗑️ 기존 인덱스 삭제 중...');
    await esClient.indices.delete({ index: INDEX_NAME });
  }

  // 3. 인덱스 생성 및 매핑 (차원 수 768 중요!)
  console.log('Ey️ 새 인덱스 생성 중 (Vector dims: 768)...');
  await esClient.indices.create({
    index: INDEX_NAME,
    body: {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          promptText: { type: 'text', analyzer: 'standard' },
          aiModel: { type: 'keyword' },
          tags: { type: 'keyword' },
          reproductionRate: { type: 'integer' },
          // ⭐ 핵심: Gemini text-embedding-004의 차원 수 768 설정
          embedding: {
            type: 'dense_vector',
            dims: 768, 
            index: true,
            similarity: 'cosine'
          },
          createdAt: { type: 'date' }
        }
      }
    }
  });

  // 4. 기존 MySQL 데이터 마이그레이션
  console.log('📦 MySQL 데이터 가져오는 중...');
  const experiments = await prisma.experiment.findMany({
    include: { activeVersion: { include: { tags: true } } }
  });

  console.log(`총 ${experiments.length}개의 실험 데이터를 발견했습니다.`);

  for (const exp of experiments) {
    const version = exp.activeVersion;
    if (!version) continue;

    // 검색에 사용할 텍스트 조합
    const textToEmbed = `Title: ${exp.title}\nDescription: ${version.promptDescription || ''}\nPrompt: ${version.promptText}`;
    
    // Gemini로 임베딩 생성
    const vector = await getEmbedding(textToEmbed);
    console.log(`ID ${exp.id} 벡터 생성됨. 길이: ${vector ? vector.length : 'null'}`);
    if (!vector) {
        console.log(`⚠️ ID ${exp.id} 임베딩 실패, 건너뜀`);
        continue;
    }

    // ES에 저장
    await esClient.index({
      index: INDEX_NAME,
      id: exp.id.toString(),
      document: {
        id: exp.id.toString(),
        title: exp.title,
        description: version.promptDescription,
        promptText: version.promptText,
        aiModel: version.aiModel,
        reproductionRate: version.reproductionRate,
        tags: version.tags.map(t => t.tagName),
        createdAt: exp.createdAt,
        embedding: vector // Gemini 벡터 데이터
      }
    });
    process.stdout.write('.'); 
  }

  console.log('\n✅ 초기화 및 데이터 동기화 완료!');
}

main().catch(console.error);