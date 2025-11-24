// src/routes/stats.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

// ==========================================
// GET /api/stats - 플랫폼 통계 조회
// ==========================================
router.get('/', asyncHandler(async (req, res) => {
  // 1. 총 실험 수 (검증된 프롬프트 = reproduction_rate >= 80)
  const totalExperiments = await prisma.experiment.count();

  // 2. 검증된 프롬프트 수 (reproduction_rate >= 80인 버전을 가진 실험)
  const verifiedExperiments = await prisma.experimentVersion.count({
    where: {
      reproductionRate: { gte: 80 }
    }
  });

  // 3. 총 재현 횟수
  const totalReproductions = await prisma.reproduction.count();

  // 4. 활성 연구자 수 (재현을 1회 이상 수행한 사용자)
  const activeResearchers = await prisma.reproduction.groupBy({
    by: ['verifierId'],
    _count: true
  });

  // 5. 총 사용자 수
  const totalUsers = await prisma.user.count();

  // 6. 총 조회수 (모든 버전의 viewCount 합계)
  const viewsAggregate = await prisma.experimentVersion.aggregate({
    _sum: {
      viewCount: true
    }
  });

  // 숫자 포맷팅 함수
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M+';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num.toString() + '+';
  };

  res.json({
    verifiedPrompts: {
      value: verifiedExperiments,
      formatted: formatNumber(verifiedExperiments)
    },
    totalReproductions: {
      value: totalReproductions,
      formatted: formatNumber(totalReproductions)
    },
    activeResearchers: {
      value: activeResearchers.length,
      formatted: formatNumber(activeResearchers.length)
    },
    totalExperiments: {
      value: totalExperiments,
      formatted: formatNumber(totalExperiments)
    },
    totalUsers: {
      value: totalUsers,
      formatted: formatNumber(totalUsers)
    },
    totalViews: {
      value: viewsAggregate._sum.viewCount || 0,
      formatted: formatNumber(viewsAggregate._sum.viewCount || 0)
    }
  });
}));

module.exports = router;
