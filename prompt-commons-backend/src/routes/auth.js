// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// JWT 설정
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
const ACCESS_TOKEN_EXPIRES = '15m';  // Access 토큰: 15분
const REFRESH_TOKEN_EXPIRES = '7d';   // Refresh 토큰: 7일

// 토큰 생성 헬퍼 함수
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );

  const refreshToken = jwt.sign(
    { userId: user.id.toString(), username: user.username, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  return { accessToken, refreshToken };
};

// 회원가입 API (POST /api/auth/register)
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // 1. 필수 값 체크
    if (!email || !username || !password) {
      return res.status(400).json({ error: '이메일, 사용자명, 비밀번호를 모두 입력해주세요.' });
    }

    // 2. 중복 사용자 체크
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일 또는 사용자명입니다.' });
    }

    // 3. 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: hashedPassword,
      },
    });

    // 4. 결과 반환 (BigInt 처리 포함)
    // BigInt 타입은 JSON으로 바로 변환이 안 되므로 문자열로 바꿔줍니다.
    const result = {
      ...newUser,
      id: newUser.id.toString(),
      createdAt: newUser.createdAt.toISOString()
    };

    res.status(201).json(result);

  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(500).json({ error: '회원가입 처리에 실패했습니다.' });
  }

  
});

// 로그인 API
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. 유저 찾기
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    // 2. 유저가 없는 경우
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    // 3. 비밀번호 검증 (bcrypt compare)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    // 4. JWT 토큰 발급 (Access + Refresh)
    const { accessToken, refreshToken } = generateTokens(user);

    // 5. 응답 (토큰과 유저 기본 정보)
    res.json({
      message: '로그인 성공!',
      token: accessToken,           // 기존 호환성 유지
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,           // 15분 (초 단위)
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// ==========================================
// POST /api/auth/refresh - 토큰 갱신
// ==========================================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: '리프레시 토큰이 필요합니다.' });
    }

    // 1. 리프레시 토큰 검증
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.' });
      }
      return res.status(401).json({ error: '유효하지 않은 리프레시 토큰입니다.' });
    }

    // 2. 토큰 타입 확인
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: '유효하지 않은 토큰 타입입니다.' });
    }

    // 3. 유저 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) }
    });

    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 4. 새 토큰 발급
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('토큰 갱신 에러:', error);
    res.status(500).json({ error: '토큰 갱신 중 오류가 발생했습니다.' });
  }
});

// ==========================================
// POST /api/auth/verify - 토큰 유효성 확인
// ==========================================
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: '토큰이 없습니다.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: BigInt(decoded.userId) },
        select: { id: true, email: true, username: true }
      });

      if (!user) {
        return res.status(401).json({ valid: false, error: '사용자를 찾을 수 없습니다.' });
      }

      res.json({
        valid: true,
        user: {
          id: user.id.toString(),
          email: user.email,
          username: user.username
        }
      });
    } catch (err) {
      return res.status(401).json({ valid: false, error: '유효하지 않은 토큰입니다.' });
    }

  } catch (error) {
    console.error('토큰 검증 에러:', error);
    res.status(500).json({ valid: false, error: '토큰 검증 중 오류가 발생했습니다.' });
  }
});

module.exports = router;