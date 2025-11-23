// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * 인증 미들웨어
 * Authorization: Bearer <token> 헤더를 검증하고 req.user에 유저 정보를 담습니다.
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Authorization 헤더 확인
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    // 2. 토큰 추출
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: '유효한 토큰이 필요합니다.' });
    }

    // 3. 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');

    // 4. DB에서 유저 정보 조회 (토큰에 담긴 userId로)
    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: '유저를 찾을 수 없습니다.' });
    }

    // 5. req.user에 유저 정보 담기 (BigInt를 문자열로 변환)
    req.user = {
      id: user.id.toString(),
      email: user.email,
      username: user.username,
      bio: user.bio,
      createdAt: user.createdAt
    };

    // 6. 다음 미들웨어/라우트로 진행
    next();
  } catch (error) {
    // JWT 토큰 관련 에러 처리
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    console.error('인증 미들웨어 에러:', error);
    return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고 req.user에 담지만, 없어도 진행합니다.
 * 로그인/비로그인 모두 접근 가능한 API에서 사용
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 토큰이 없으면 그냥 진행
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');

    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        createdAt: true
      }
    });

    if (user) {
      req.user = {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        bio: user.bio,
        createdAt: user.createdAt
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // 토큰이 잘못되어도 그냥 진행 (선택적 인증이므로)
    req.user = null;
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };
