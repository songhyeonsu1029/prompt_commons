const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const experimentRoutes = require('./routes/experiments');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const systemController = require('./controllers/systemController');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174','https://effortless-torte-cf69c1.netlify.app'], // 프론트엔드 주소 (Vite 기본 포트 포함)
  credentials: true // 쿠키 허용
}));
app.use(cookieParser());
app.use(express.json()); // JSON 요청 본문 해석

// Rate Limiting 설정
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // IP당 1000개 요청 (개발 환경 편의를 위해 증설)
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 100, // IP당 100개 요청
  message: 'Too many login attempts, please try again after an hour'
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 200, // IP당 200개 요청
  message: 'AI request limit exceeded, please try again later'
});

// 전역 제한 적용 (모든 라우트에)
app.use(generalLimiter);

// 루트 경로 (API 서버 정보)
app.get('/', systemController.getSystemInfo);

// 1. 헬스 체크 API (서버 살아있니?)
app.get('/api/health', systemController.healthCheck);

// 2. DB 연결 테스트 API
app.get('/api/test-db', systemController.testDbConnection);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/experiments', aiLimiter, experimentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// 에러 핸들링 미들웨어 (라우트 등록 후 마지막에 위치해야 함)
app.use(notFoundHandler); // 404 처리
app.use(errorHandler);    // 글로벌 에러 처리

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
