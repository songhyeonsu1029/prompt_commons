const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const experimentRoutes = require('./routes/experiments');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // 모든 도메인 허용 (개발용)
app.use(express.json()); // JSON 요청 본문 해석

// 루트 경로 (API 서버 정보)
app.get('/', (req, res) => {
  res.json({
    name: 'Prompt Commons API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      experiments: '/api/experiments'
    }
  });
});

// 1. 헬스 체크 API (서버 살아있니?)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running smoothly' });
});

// 2. DB 연결 테스트 API
app.get('/api/test-db', async (req, res) => {
  try {
    // DB에 쿼리 날려보기 (간단한 연산)
    const result = await prisma.$queryRaw`SELECT 1 + 1 AS result`;
    res.json({ 
      message: 'Database connection successful!', 
      result: Number(result[0].result) // BigInt 처리
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// 에러 핸들링 미들웨어 (라우트 등록 후 마지막에 위치해야 함)
app.use(notFoundHandler); // 404 처리
app.use(errorHandler);    // 글로벌 에러 처리

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
