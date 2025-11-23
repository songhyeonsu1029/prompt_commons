// src/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

// ==========================================
// GET /api/users/me - 내 정보 조회
// ==========================================
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1. 유저 정보 조회
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new ApiError(404, '유저를 찾을 수 없습니다.');
  }

  // 2. 저장한 실험 조회
  const savedExperiments = await prisma.savedExperiment.findMany({
    where: { userId: BigInt(userId) },
    include: {
      experiment: {
        include: {
          author: { select: { username: true } },
          activeVersion: {
            select: {
              versionNumber: true,
              aiModel: true,
              reproductionRate: true,
              tags: { select: { tagName: true } }
            }
          }
        }
      }
    },
    orderBy: { savedAt: 'desc' }
  });

  // 3. 내가 만든 실험 조회
  const myExperiments = await prisma.experiment.findMany({
    where: { authorId: BigInt(userId) },
    include: {
      activeVersion: {
        select: {
          versionNumber: true,
          aiModel: true,
          reproductionRate: true,
          reproductionCount: true,
          viewCount: true,
          tags: { select: { tagName: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. 재현 히스토리 조회
  const reproductionHistory = await prisma.reproduction.findMany({
    where: { verifierId: BigInt(userId) },
    include: {
      experiment: { select: { id: true, title: true } },
      version: { select: { versionNumber: true, promptText: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 5. 응답 형식 가공
  const formattedSaved = savedExperiments.map(s => ({
    id: s.experiment.id.toString(),
    title: s.experiment.title,
    author: { username: s.experiment.author.username },
    version_number: s.experiment.activeVersion?.versionNumber || 'v1.0',
    ai_model: s.experiment.activeVersion?.aiModel,
    reproduction_rate: s.experiment.activeVersion?.reproductionRate || 0,
    tags: s.experiment.activeVersion?.tags?.map(t => t.tagName) || [],
    saved_at: s.savedAt?.toISOString()
  }));

  const formattedMyExperiments = myExperiments.map(e => ({
    id: e.id.toString(),
    title: e.title,
    task_type: e.taskType,
    version_number: e.activeVersion?.versionNumber || 'v1.0',
    ai_model: e.activeVersion?.aiModel,
    reproduction_rate: e.activeVersion?.reproductionRate || 0,
    reproduction_count: e.activeVersion?.reproductionCount || 0,
    views: e.activeVersion?.viewCount || 0,
    tags: e.activeVersion?.tags?.map(t => t.tagName) || [],
    created_at: e.createdAt?.toISOString()
  }));

  const formattedHistory = reproductionHistory.map(r => ({
    id: r.id.toString(),
    experiment_id: r.experiment.id.toString(),
    target_title: r.experiment.title,
    version_number: r.version.versionNumber,
    prompt_text: r.version.promptText,
    note: r.note,
    success: r.success,
    score: r.score,
    date: r.createdAt?.toISOString().split('T')[0]
  }));

  res.json({
    userProfile: {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      bio: user.bio,
      joined_at: user.createdAt?.toISOString().split('T')[0],
      stats: {
        saved: savedExperiments.length,
        reproductions: reproductionHistory.length,
        experiments: myExperiments.length
      }
    },
    savedPrompts: formattedSaved,
    myExperiments: formattedMyExperiments,
    reproductionHistory: formattedHistory
  });
}));

// ==========================================
// GET /api/users/:username - 다른 유저 프로필 조회
// ==========================================
router.get('/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;

  // 1. 유저 조회
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new ApiError(404, '유저를 찾을 수 없습니다.');
  }

  // 2. 유저의 실험 조회
  const experiments = await prisma.experiment.findMany({
    where: { authorId: user.id },
    include: {
      activeVersion: {
        select: {
          versionNumber: true,
          aiModel: true,
          reproductionRate: true,
          reproductionCount: true,
          viewCount: true,
          tags: { select: { tagName: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 3. 재현 수 조회
  const reproductionCount = await prisma.reproduction.count({
    where: { verifierId: user.id }
  });

  // 4. 응답 형식 가공
  const formattedExperiments = experiments.map(e => ({
    id: e.id.toString(),
    title: e.title,
    task_type: e.taskType,
    version_number: e.activeVersion?.versionNumber || 'v1.0',
    ai_model: e.activeVersion?.aiModel,
    reproduction_rate: e.activeVersion?.reproductionRate || 0,
    reproduction_count: e.activeVersion?.reproductionCount || 0,
    views: e.activeVersion?.viewCount || 0,
    tags: e.activeVersion?.tags?.map(t => t.tagName) || [],
    created_at: e.createdAt?.toISOString()
  }));

  res.json({
    profile: {
      id: user.id.toString(),
      username: user.username,
      bio: user.bio,
      joined_at: user.createdAt?.toISOString().split('T')[0],
      stats: {
        experiments: experiments.length,
        reproductions: reproductionCount
      }
    },
    experiments: formattedExperiments
  });
}));

// ==========================================
// PUT /api/users/me - 내 프로필 수정
// ==========================================
router.put('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username, bio } = req.body;

  // 1. 유저명 중복 체크 (변경하는 경우)
  if (username && username !== req.user.username) {
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    if (existingUser) {
      throw new ApiError(409, '이미 사용 중인 유저명입니다.');
    }
  }

  // 2. 프로필 업데이트
  const updated = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: {
      ...(username && { username }),
      ...(bio !== undefined && { bio })
    },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      createdAt: true
    }
  });

  res.json({
    id: updated.id.toString(),
    email: updated.email,
    username: updated.username,
    bio: updated.bio,
    joined_at: updated.createdAt?.toISOString().split('T')[0]
  });
}));

// ==========================================
// PUT /api/users/me/password - 비밀번호 변경
// ==========================================
router.put('/me/password', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  // 1. 필수 값 검증
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, '현재 비밀번호와 새 비밀번호를 입력해주세요.');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, '새 비밀번호는 6자 이상이어야 합니다.');
  }

  // 2. 현재 유저 조회
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) }
  });

  if (!user) {
    throw new ApiError(404, '유저를 찾을 수 없습니다.');
  }

  // 3. 현재 비밀번호 확인
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, '현재 비밀번호가 일치하지 않습니다.');
  }

  // 4. 새 비밀번호 해시 생성 및 업데이트
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { passwordHash: newPasswordHash }
  });

  res.json({ message: '비밀번호가 변경되었습니다.' });
}));

module.exports = router;
