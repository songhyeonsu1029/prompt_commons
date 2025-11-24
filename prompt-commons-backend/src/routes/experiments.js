// src/routes/experiments.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, optionalAuth } = require('../middlewares/authMiddleware');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const prisma = new PrismaClient();

// 실험 목록 조회 (최신순, 페이지네이션 가능)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    // 1. DB에서 목록 가져오기
    const experiments = await prisma.experiment.findMany({
      skip: skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { username: true } // 작성자 닉네임만 가져옴
        },
        // ★ 핵심: 현재 활성화된 버전의 통계와 정보를 가져옴
        activeVersion: {
          select: {
            versionNumber: true,
            aiModel: true,
            modelVersion: true,
            reproductionRate: true,
            reproductionCount: true,
            viewCount: true,
            promptText: true, // 미리보기용
            tags: {
              select: { tagName: true }
            }
          }
        }
      }
    });

    // 2. 전체 개수 카운트 (페이지네이션용)
    const totalCount = await prisma.experiment.count();

    // 3. 프론트엔드가 쓰기 편하게 데이터 가공 (Flatten)
    const formattedExperiments = experiments.map(exp => {
      // activeVersion이 없을 수도 있으니 안전하게 처리
      const version = exp.activeVersion || {};
      const tags = version.tags ? version.tags.map(t => t.tagName) : [];

      return {
        id: exp.id.toString(), // BigInt -> String
        title: exp.title,
        author: { username: exp.author.username },
        // 버전 정보 끌어올리기
        version_number: version.versionNumber || 'v1.0',
        ai_model: version.aiModel || 'Unknown',
        model_version: version.modelVersion,
        prompt_text: version.promptText || '',
        reproduction_rate: version.reproductionRate || 0,
        reproduction_count: version.reproductionCount || 0,
        views: version.viewCount || 0,
        tags: tags,
        created_at: exp.createdAt.toISOString()
      };
    });

    res.json({
      data: formattedExperiments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalResults: totalCount
      }
    });

  } catch (error) {
    console.error('실험 목록 조회 에러:', error);
    res.status(500).json({ error: '실험 목록을 불러오는데 실패했습니다.' });
  }
});

// ==========================================
// GET /api/experiments/search - 실험 검색
// ==========================================
router.get('/search', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = req.query.q || '';
  const model = req.query.model;
  const rate = parseInt(req.query.rate) || 0;

  // 검색 조건 구성
  const whereConditions = {
    AND: []
  };

  // 텍스트 검색 (제목 또는 프롬프트 텍스트)
  if (query) {
    whereConditions.AND.push({
      OR: [
        { title: { contains: query } },
        {
          versions: {
            some: {
              promptText: { contains: query }
            }
          }
        }
      ]
    });
  }

  // AI 모델 필터
  if (model && model !== 'All') {
    whereConditions.AND.push({
      activeVersion: {
        aiModel: { contains: model }
      }
    });
  }

  // 재현율 필터
  if (rate > 0) {
    whereConditions.AND.push({
      activeVersion: {
        reproductionRate: { gte: rate }
      }
    });
  }

  // AND 조건이 비어있으면 제거
  const finalWhere = whereConditions.AND.length > 0 ? whereConditions : {};

  // 검색 실행
  const experiments = await prisma.experiment.findMany({
    where: finalWhere,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { username: true } },
      activeVersion: {
        select: {
          versionNumber: true,
          aiModel: true,
          promptText: true,
          reproductionRate: true,
          reproductionCount: true,
          viewCount: true,
          tags: { select: { tagName: true } }
        }
      }
    }
  });

  // 전체 개수
  const totalCount = await prisma.experiment.count({ where: finalWhere });

  // 데이터 가공
  const formattedResults = experiments.map(exp => {
    const version = exp.activeVersion || {};
    return {
      id: exp.id.toString(),
      title: exp.title,
      author: { username: exp.author.username },
      ai_model: version.aiModel || 'Unknown',
      prompt_text: version.promptText || '',
      reproduction_rate: version.reproductionRate || 0,
      reproduction_count: version.reproductionCount || 0,
      views: version.viewCount || 0,
      tags: version.tags?.map(t => t.tagName) || [],
      created_at: exp.createdAt.toISOString()
    };
  });

  res.json({
    data: formattedResults,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount
    }
  });
}));

// ==========================================
// POST /api/experiments - 새 실험 생성
// ==========================================
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const {
    title,
    ai_model,
    model_version,
    task_type,
    prompt_text,
    modification_guide,
    description,
    tags // 콤마로 구분된 문자열 또는 배열
  } = req.body;

  // 1. 필수 값 검증
  if (!title || !prompt_text) {
    throw new ApiError(400, '제목과 프롬프트 텍스트는 필수입니다.');
  }

  if (!ai_model) {
    throw new ApiError(400, 'AI 모델은 필수입니다.');
  }

  // 2. 태그 파싱 (문자열이면 배열로 변환)
  let tagList = [];
  if (tags) {
    if (typeof tags === 'string') {
      tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    } else if (Array.isArray(tags)) {
      tagList = tags;
    }
  }

  // 3. 트랜잭션으로 Experiment + ExperimentVersion + Tags 생성
  const result = await prisma.$transaction(async (tx) => {
    // 3-1. Experiment 생성 (activeVersionId는 나중에 업데이트)
    const experiment = await tx.experiment.create({
      data: {
        authorId: BigInt(userId),
        title: title,
        taskType: task_type || null,
      }
    });

    // 3-2. 첫 번째 버전 생성
    const firstVersion = await tx.experimentVersion.create({
      data: {
        experimentId: experiment.id,
        versionNumber: 'v1.0',
        promptText: prompt_text,
        aiModel: ai_model,
        modelVersion: model_version || null,
        promptDescription: description || null,
        modificationGuide: modification_guide || null,
        changelog: 'Initial release',
        reproductionRate: 0,
        reproductionCount: 0,
        viewCount: 0
      }
    });

    // 3-3. 태그 생성
    if (tagList.length > 0) {
      await tx.experimentTag.createMany({
        data: tagList.map(tagName => ({
          versionId: firstVersion.id,
          tagName: tagName
        }))
      });
    }

    // 3-4. Experiment의 activeVersionId 업데이트
    await tx.experiment.update({
      where: { id: experiment.id },
      data: { activeVersionId: firstVersion.id }
    });

    return { experiment, firstVersion };
  });

  // 4. 생성된 실험 정보 반환
  const response = {
    id: result.experiment.id.toString(),
    title: result.experiment.title,
    task_type: result.experiment.taskType,
    author: {
      id: userId,
      username: req.user.username
    },
    created_at: result.experiment.createdAt.toISOString(),
    active_version: 'v1.0',
    version_number: 'v1.0',
    ai_model: ai_model,
    model_version: model_version,
    prompt_text: prompt_text,
    prompt_description: description,
    modification_guide: modification_guide,
    tags: tagList,
    stats: {
      reproduction_rate: 0,
      reproduction_count: 0,
      views: 0
    },
    versions: [{
      version_number: 'v1.0',
      prompt_text: prompt_text,
      prompt_description: description,
      modification_guide: modification_guide,
      changelog: 'Initial release',
      tags: tagList,
      created_at: result.firstVersion.createdAt.toISOString(),
      stats: {
        reproduction_rate: 0,
        reproduction_count: 0,
        views: 0
      }
    }],
    comments: [],
    reproductions: [],
    similar: []
  };

  res.status(201).json(response);
}));

// ==========================================
// GET /api/experiments/:id - 실험 상세 조회
// ==========================================
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { version } = req.query; // ?version=v1.0 쿼리 파라미터

  // 1. 실험 조회 (모든 버전, 작성자, 댓글, 재현 등 포함)
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: {
      author: {
        select: { id: true, username: true }
      },
      versions: {
        orderBy: { createdAt: 'asc' },
        include: {
          tags: { select: { tagName: true } }
        }
      },
      activeVersion: {
        include: {
          tags: { select: { tagName: true } }
        }
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { username: true } }
        }
      },
      reproductions: {
        orderBy: { createdAt: 'desc' },
        include: {
          verifier: { select: { username: true } },
          version: { select: { versionNumber: true } },
          upvotes: true,
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { username: true } }
            }
          }
        }
      }
    }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 2. 조회할 버전 결정 (쿼리 파라미터 or activeVersion)
  let targetVersion;
  if (version) {
    targetVersion = experiment.versions.find(v => v.versionNumber === version);
    if (!targetVersion) {
      throw new ApiError(404, `버전 ${version}을 찾을 수 없습니다.`);
    }
  } else {
    targetVersion = experiment.activeVersion || experiment.versions[experiment.versions.length - 1];
  }

  // 3. view_count 증가 (해당 버전)
  if (targetVersion) {
    await prisma.experimentVersion.update({
      where: { id: targetVersion.id },
      data: { viewCount: { increment: 1 } }
    });
    targetVersion.viewCount += 1; // 응답에도 반영
  }

  // 4. 저장 여부 확인 (로그인한 사용자만)
  let isSaved = false;
  if (req.user?.id) {
    const savedRecord = await prisma.savedExperiment.findUnique({
      where: {
        userId_experimentId: {
          userId: BigInt(req.user.id),
          experimentId: BigInt(id)
        }
      }
    });
    isSaved = !!savedRecord;
  }

  // 6. 유사 실험 조회 (같은 태그를 가진 다른 실험)
  const currentTags = targetVersion?.tags?.map(t => t.tagName) || [];
  let similarExperiments = [];
  if (currentTags.length > 0) {
    similarExperiments = await prisma.experiment.findMany({
      where: {
        id: { not: experiment.id },
        versions: {
          some: {
            tags: {
              some: {
                tagName: { in: currentTags }
              }
            }
          }
        }
      },
      take: 3,
      include: {
        activeVersion: {
          select: {
            reproductionRate: true,
            tags: { select: { tagName: true } }
          }
        }
      }
    });
  }

  // 7. 프론트엔드 형식에 맞게 데이터 가공
  const formattedVersions = experiment.versions.map(v => ({
    version_number: v.versionNumber,
    prompt_text: v.promptText,
    prompt_description: v.promptDescription,
    modification_guide: v.modificationGuide,
    changelog: v.changelog,
    tags: v.tags.map(t => t.tagName),
    created_at: v.createdAt.toISOString(),
    stats: {
      reproduction_rate: v.reproductionRate || 0,
      reproduction_count: v.reproductionCount || 0,
      views: v.viewCount || 0
    }
  }));

  const formattedComments = experiment.comments.map(c => ({
    id: c.id.toString(),
    experiment_id: experiment.id.toString(),
    author: { username: c.author.username },
    text: c.content,
    created_at: c.createdAt.toISOString()
  }));

  const formattedReproductions = experiment.reproductions.map(r => ({
    id: r.id.toString(),
    experiment_id: experiment.id.toString(),
    version_number: r.version?.versionNumber || 'v1.0',
    user: r.verifier.username,
    success: r.success,
    note: r.note,
    score: r.score,
    modified_prompt: r.modifiedPrompt,
    date: r.createdAt.toISOString().split('T')[0],
    upvotes: r.upvotes.length,
    replies: r.replies.map(reply => ({
      id: reply.id.toString(),
      author: { username: reply.author.username },
      content: reply.content,
      timestamp: reply.createdAt.toISOString()
    }))
  }));

  const formattedSimilar = similarExperiments.map(s => ({
    id: s.id.toString(),
    title: s.title,
    reproduction_rate: s.activeVersion?.reproductionRate || 0,
    tags: s.activeVersion?.tags?.map(t => t.tagName) || []
  }));

  const response = {
    id: experiment.id.toString(),
    title: experiment.title,
    task_type: experiment.taskType,
    author: {
      id: experiment.author.id.toString(),
      username: experiment.author.username
    },
    created_at: experiment.createdAt.toISOString(),
    active_version: experiment.activeVersion?.versionNumber || 'v1.0',
    versions: formattedVersions,
    // 현재 버전 정보 (flatten)
    version_number: targetVersion?.versionNumber,
    ai_model: targetVersion?.aiModel,
    model_version: targetVersion?.modelVersion,
    prompt_text: targetVersion?.promptText,
    prompt_description: targetVersion?.promptDescription,
    modification_guide: targetVersion?.modificationGuide,
    changelog: targetVersion?.changelog,
    tags: targetVersion?.tags?.map(t => t.tagName) || [],
    stats: {
      reproduction_rate: targetVersion?.reproductionRate || 0,
      reproduction_count: targetVersion?.reproductionCount || 0,
      views: targetVersion?.viewCount || 0
    },
    comments: formattedComments,
    reproductions: formattedReproductions,
    similar: formattedSimilar,
    isSaved
  };

  res.json(response);
}));

// ==========================================
// POST /api/experiments/:id/versions - 새 버전 배포
// ==========================================
router.post('/:id/versions', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const {
    version_number,
    prompt_text,
    prompt_description,
    modification_guide,
    changelog,
    ai_model,
    model_version,
    tags // 선택적: 새 태그 배열
  } = req.body;

  // 1. 실험 조회 및 작성자 확인
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: {
      author: { select: { id: true } },
      activeVersion: {
        include: { tags: { select: { tagName: true } } }
      }
    }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 작성자만 새 버전 배포 가능
  if (experiment.author.id.toString() !== userId) {
    throw new ApiError(403, '본인의 실험만 수정할 수 있습니다.');
  }

  // 2. 필수 값 검증
  if (!version_number || !prompt_text) {
    throw new ApiError(400, '버전 번호와 프롬프트 텍스트는 필수입니다.');
  }

  // 3. 트랜잭션으로 새 버전 생성 + active_version 업데이트
  await prisma.$transaction(async (tx) => {
    // 3-1. 새 버전 생성
    const newVersion = await tx.experimentVersion.create({
      data: {
        experimentId: experiment.id,
        versionNumber: version_number,
        promptText: prompt_text,
        promptDescription: prompt_description || null,
        modificationGuide: modification_guide || null,
        changelog: changelog || null,
        aiModel: ai_model || experiment.activeVersion?.aiModel,
        modelVersion: model_version || experiment.activeVersion?.modelVersion,
        reproductionRate: 0,
        reproductionCount: 0,
        viewCount: 0
      }
    });

    // 3-2. 태그 처리 (새 태그가 없으면 이전 버전 태그 상속)
    const tagsToCreate = tags && tags.length > 0
      ? tags
      : experiment.activeVersion?.tags?.map(t => t.tagName) || [];

    if (tagsToCreate.length > 0) {
      await tx.experimentTag.createMany({
        data: tagsToCreate.map(tagName => ({
          versionId: newVersion.id,
          tagName: tagName
        }))
      });
    }

    // 3-3. experiments 테이블의 activeVersionId 업데이트
    await tx.experiment.update({
      where: { id: experiment.id },
      data: { activeVersionId: newVersion.id }
    });

    return newVersion;
  });

  // 4. 업데이트된 실험 전체 정보 반환 (GET /:id와 동일한 형식)
  // 재귀 호출 대신 리다이렉트 형태로 처리
  const updatedExperiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: {
      author: { select: { id: true, username: true } },
      versions: {
        orderBy: { createdAt: 'asc' },
        include: { tags: { select: { tagName: true } } }
      },
      activeVersion: {
        include: { tags: { select: { tagName: true } } }
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { username: true } } }
      },
      reproductions: {
        orderBy: { createdAt: 'desc' },
        include: {
          verifier: { select: { username: true } },
          version: { select: { versionNumber: true } },
          upvotes: true,
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { username: true } } }
          }
        }
      }
    }
  });

  // 프론트엔드 형식으로 가공
  const targetVersion = updatedExperiment.activeVersion;

  // 저장 여부 확인
  let isSaved = false;
  if (req.user?.id) {
    const savedRecord = await prisma.savedExperiment.findUnique({
      where: {
        userId_experimentId: {
          userId: BigInt(req.user.id),
          experimentId: BigInt(id)
        }
      }
    });
    isSaved = !!savedRecord;
  }

  const formattedVersions = updatedExperiment.versions.map(v => ({
    version_number: v.versionNumber,
    prompt_text: v.promptText,
    prompt_description: v.promptDescription,
    modification_guide: v.modificationGuide,
    changelog: v.changelog,
    tags: v.tags.map(t => t.tagName),
    created_at: v.createdAt.toISOString(),
    stats: {
      reproduction_rate: v.reproductionRate || 0,
      reproduction_count: v.reproductionCount || 0,
      views: v.viewCount || 0
    }
  }));

  const formattedComments = updatedExperiment.comments.map(c => ({
    id: c.id.toString(),
    experiment_id: updatedExperiment.id.toString(),
    author: { username: c.author.username },
    text: c.content,
    created_at: c.createdAt.toISOString()
  }));

  const formattedReproductions = updatedExperiment.reproductions.map(r => ({
    id: r.id.toString(),
    experiment_id: updatedExperiment.id.toString(),
    version_number: r.version?.versionNumber || 'v1.0',
    user: r.verifier.username,
    success: r.success,
    note: r.note,
    score: r.score,
    modified_prompt: r.modifiedPrompt,
    date: r.createdAt.toISOString().split('T')[0],
    upvotes: r.upvotes.length,
    replies: r.replies.map(reply => ({
      id: reply.id.toString(),
      author: { username: reply.author.username },
      content: reply.content,
      timestamp: reply.createdAt.toISOString()
    }))
  }));

  const response = {
    id: updatedExperiment.id.toString(),
    title: updatedExperiment.title,
    task_type: updatedExperiment.taskType,
    author: {
      id: updatedExperiment.author.id.toString(),
      username: updatedExperiment.author.username
    },
    created_at: updatedExperiment.createdAt.toISOString(),
    active_version: targetVersion?.versionNumber || 'v1.0',
    versions: formattedVersions,
    version_number: targetVersion?.versionNumber,
    ai_model: targetVersion?.aiModel,
    model_version: targetVersion?.modelVersion,
    prompt_text: targetVersion?.promptText,
    prompt_description: targetVersion?.promptDescription,
    modification_guide: targetVersion?.modificationGuide,
    changelog: targetVersion?.changelog,
    tags: targetVersion?.tags?.map(t => t.tagName) || [],
    stats: {
      reproduction_rate: targetVersion?.reproductionRate || 0,
      reproduction_count: targetVersion?.reproductionCount || 0,
      views: targetVersion?.viewCount || 0
    },
    comments: formattedComments,
    reproductions: formattedReproductions,
    similar: [],
    isSaved
  };

  res.status(201).json(response);
}));

// ==========================================
// POST /api/experiments/:id/comments - 댓글 작성
// ==========================================
router.post('/:id/comments', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { text } = req.body;

  // 1. 필수 값 검증
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, '댓글 내용을 입력해주세요.');
  }

  // 2. 실험 존재 여부 확인
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 3. 댓글 생성
  const comment = await prisma.comment.create({
    data: {
      experimentId: BigInt(id),
      authorId: BigInt(userId),
      content: text.trim()
    },
    include: {
      author: { select: { username: true } }
    }
  });

  // 4. 응답 형식 맞추기
  const response = {
    id: comment.id.toString(),
    experiment_id: id,
    author: { username: comment.author.username },
    text: comment.content,
    created_at: comment.createdAt.toISOString()
  };

  res.status(201).json(response);
}));

// ==========================================
// DELETE /api/experiments/:experimentId/comments/:commentId - 댓글 삭제
// ==========================================
router.delete('/:experimentId/comments/:commentId', authMiddleware, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  // 1. 댓글 조회
  const comment = await prisma.comment.findUnique({
    where: { id: BigInt(commentId) },
    include: { author: { select: { id: true } } }
  });

  if (!comment) {
    throw new ApiError(404, '댓글을 찾을 수 없습니다.');
  }

  // 2. 작성자 본인 확인
  if (comment.author.id.toString() !== userId) {
    throw new ApiError(403, '본인의 댓글만 삭제할 수 있습니다.');
  }

  // 3. 댓글 삭제
  await prisma.comment.delete({
    where: { id: BigInt(commentId) }
  });

  res.json({ message: '댓글이 삭제되었습니다.' });
}));

// ==========================================
// POST /api/experiments/:id/reproductions - 재현 검증 제출
// ==========================================
router.post('/:id/reproductions', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const {
    version_number,
    modifiedContent,  // 수정된 프롬프트
    score,            // 0-100 점수
    feedback          // 피드백/노트
  } = req.body;

  // 1. 실험 존재 여부 확인
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: {
      versions: true,
      activeVersion: true
    }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 2. 버전 찾기 (version_number가 없으면 activeVersion 사용)
  let targetVersion = experiment.activeVersion;
  if (version_number) {
    targetVersion = experiment.versions.find(v => v.versionNumber === version_number);
    if (!targetVersion) {
      throw new ApiError(404, `버전 ${version_number}을 찾을 수 없습니다.`);
    }
  }

  // 3. 필수 값 검증
  if (score === undefined || score === null) {
    throw new ApiError(400, '점수는 필수입니다.');
  }

  // 4. 재현 기록 생성
  const reproduction = await prisma.reproduction.create({
    data: {
      experimentId: BigInt(id),
      versionId: targetVersion.id,
      verifierId: BigInt(userId),
      success: score >= 80,
      score: score,
      note: feedback || null,
      modifiedPrompt: modifiedContent || null
    },
    include: {
      verifier: { select: { username: true } },
      version: { select: { versionNumber: true } }
    }
  });

  // 5. 버전의 재현 통계 업데이트
  const versionReproductions = await prisma.reproduction.findMany({
    where: { versionId: targetVersion.id }
  });

  const totalCount = versionReproductions.length;
  const successCount = versionReproductions.filter(r => r.success).length;
  const reproductionRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  await prisma.experimentVersion.update({
    where: { id: targetVersion.id },
    data: {
      reproductionCount: totalCount,
      reproductionRate: reproductionRate
    }
  });

  // 6. 응답 형식 맞추기
  const response = {
    id: reproduction.id.toString(),
    experiment_id: id,
    version_number: reproduction.version.versionNumber,
    user: reproduction.verifier.username,
    success: reproduction.success,
    score: reproduction.score,
    note: reproduction.note,
    modified_prompt: reproduction.modifiedPrompt,
    date: reproduction.createdAt.toISOString().split('T')[0],
    upvotes: 0,
    replies: []
  };

  res.status(201).json(response);
}));

// ==========================================
// POST /api/reproductions/:id/vote - 재현에 좋아요 토글
// ==========================================
router.post('/reproductions/:reproductionId/vote', authMiddleware, asyncHandler(async (req, res) => {
  const { reproductionId } = req.params;
  const userId = req.user.id;

  // 1. 재현 기록 존재 확인
  const reproduction = await prisma.reproduction.findUnique({
    where: { id: BigInt(reproductionId) }
  });

  if (!reproduction) {
    throw new ApiError(404, '재현 기록을 찾을 수 없습니다.');
  }

  // 2. 기존 좋아요 확인
  const existingUpvote = await prisma.reproductionUpvote.findUnique({
    where: {
      reproductionId_userId: {
        reproductionId: BigInt(reproductionId),
        userId: BigInt(userId)
      }
    }
  });

  let action;
  if (existingUpvote) {
    // 좋아요 취소
    await prisma.reproductionUpvote.delete({
      where: { id: existingUpvote.id }
    });
    action = 'removed';
  } else {
    // 좋아요 추가
    await prisma.reproductionUpvote.create({
      data: {
        reproductionId: BigInt(reproductionId),
        userId: BigInt(userId)
      }
    });
    action = 'added';
  }

  // 3. 현재 좋아요 수 조회
  const upvoteCount = await prisma.reproductionUpvote.count({
    where: { reproductionId: BigInt(reproductionId) }
  });

  res.json({
    id: reproductionId,
    upvotes: upvoteCount,
    action: action
  });
}));

// ==========================================
// POST /api/reproductions/:id/replies - 재현에 답글 작성
// ==========================================
router.post('/reproductions/:reproductionId/replies', authMiddleware, asyncHandler(async (req, res) => {
  const { reproductionId } = req.params;
  const userId = req.user.id;
  const { content } = req.body;

  // 1. 필수 값 검증
  if (!content || content.trim().length === 0) {
    throw new ApiError(400, '답글 내용을 입력해주세요.');
  }

  // 2. 재현 기록 존재 확인
  const reproduction = await prisma.reproduction.findUnique({
    where: { id: BigInt(reproductionId) }
  });

  if (!reproduction) {
    throw new ApiError(404, '재현 기록을 찾을 수 없습니다.');
  }

  // 3. 답글 생성
  const reply = await prisma.reproductionReply.create({
    data: {
      reproductionId: BigInt(reproductionId),
      authorId: BigInt(userId),
      content: content.trim()
    },
    include: {
      author: { select: { username: true } }
    }
  });

  // 4. 응답 형식 맞추기
  const response = {
    id: reply.id.toString(),
    author: { username: reply.author.username },
    content: reply.content,
    timestamp: reply.createdAt.toISOString()
  };

  res.status(201).json(response);
}));

// ==========================================
// POST /api/experiments/:id/save - 실험 저장/북마크 토글
// ==========================================
router.post('/:id/save', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // 1. 실험 존재 여부 확인
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 2. 기존 저장 여부 확인
  const existingSave = await prisma.savedExperiment.findUnique({
    where: {
      userId_experimentId: {
        userId: BigInt(userId),
        experimentId: BigInt(id)
      }
    }
  });

  let isSaved;
  if (existingSave) {
    // 저장 취소
    await prisma.savedExperiment.delete({
      where: {
        userId_experimentId: {
          userId: BigInt(userId),
          experimentId: BigInt(id)
        }
      }
    });
    isSaved = false;
  } else {
    // 저장 추가
    await prisma.savedExperiment.create({
      data: {
        userId: BigInt(userId),
        experimentId: BigInt(id)
      }
    });
    isSaved = true;
  }

  // 3. 현재 저장한 실험 ID 목록 반환
  const savedExperiments = await prisma.savedExperiment.findMany({
    where: { userId: BigInt(userId) },
    select: { experimentId: true }
  });

  res.json({
    isSaved,
    saved: savedExperiments.map(s => s.experimentId.toString())
  });
}));

// ==========================================
// DELETE /api/experiments/:id - 실험 삭제
// ==========================================
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // 1. 실험 조회
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: { author: { select: { id: true } } }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 2. 작성자 본인 확인
  if (experiment.author.id.toString() !== userId) {
    throw new ApiError(403, '본인의 실험만 삭제할 수 있습니다.');
  }

  // 3. 실험 삭제 (CASCADE로 관련 데이터도 삭제됨)
  await prisma.experiment.delete({
    where: { id: BigInt(id) }
  });

  res.json({ message: '실험이 삭제되었습니다.' });
}));

// ==========================================
// PUT /api/experiments/:id - 실험 기본 정보 수정
// ==========================================
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, task_type } = req.body;

  // 1. 실험 조회
  const experiment = await prisma.experiment.findUnique({
    where: { id: BigInt(id) },
    include: { author: { select: { id: true } } }
  });

  if (!experiment) {
    throw new ApiError(404, '실험을 찾을 수 없습니다.');
  }

  // 2. 작성자 본인 확인
  if (experiment.author.id.toString() !== userId) {
    throw new ApiError(403, '본인의 실험만 수정할 수 있습니다.');
  }

  // 3. 실험 정보 업데이트
  const updated = await prisma.experiment.update({
    where: { id: BigInt(id) },
    data: {
      ...(title && { title }),
      ...(task_type && { taskType: task_type })
    },
    include: {
      author: { select: { id: true, username: true } },
      activeVersion: {
        include: { tags: { select: { tagName: true } } }
      }
    }
  });

  res.json({
    id: updated.id.toString(),
    title: updated.title,
    task_type: updated.taskType,
    author: {
      id: updated.author.id.toString(),
      username: updated.author.username
    }
  });
}));

module.exports = router;