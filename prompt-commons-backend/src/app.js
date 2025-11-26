const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
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
app.use(cors({
  origin: 'http://localhost:5174', // 프론트엔드 주소
  credentials: true // 쿠키 허용
}));
app.use(cookieParser());
app.use(express.json()); // JSON 요청 본문 해석

// Rate Limiting 설정
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 100개 요청
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20, // IP당 20개 요청 (로그인/회원가입 등)
  message: 'Too many login attempts, please try again after an hour'
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 50, // IP당 50개 요청 (AI 실험 생성 등)
  message: 'AI request limit exceeded, please try again later'
});

// 전역 제한 적용 (모든 라우트에)
app.use(generalLimiter);

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

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/experiments', aiLimiter, experimentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// 에러 핸들링 미들웨어 (라우트 등록 후 마지막에 위치해야 함)
app.use(notFoundHandler); // 404 처리
app.use(errorHandler);    // 글로벌 에러 처리

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
