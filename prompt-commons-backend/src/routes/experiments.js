const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middlewares/authMiddleware');
const experimentController = require('../controllers/experimentController');

// 주간 인기 실험 Top 10 조회
router.get('/weekly-top', experimentController.getWeeklyTop);

// 실험 목록 조회 (최신순, 페이지네이션 가능)
router.get('/', experimentController.getExperiments);

// 자연어 검색
router.get('/search', experimentController.searchExperiments);

// Elasticsearch 동기화 (수동 트리거) - Admin Route
router.post('/sync', authMiddleware, experimentController.syncExperiments);

// 새 실험 생성
router.post('/', authMiddleware, experimentController.createExperiment);

// 실험 상세 조회
router.get('/:id', optionalAuth, experimentController.getExperimentById);

// 새 버전 배포
router.post('/:id/versions', authMiddleware, experimentController.createVersion);

// 댓글 작성
router.post('/:id/comments', authMiddleware, experimentController.createComment);

// 댓글 삭제
router.delete('/:experimentId/comments/:commentId', authMiddleware, experimentController.deleteComment);

// 재현 검증 제출
router.post('/:id/reproductions', authMiddleware, experimentController.createReproduction);

// 재현에 좋아요 토글
router.post('/reproductions/:reproductionId/vote', authMiddleware, experimentController.voteReproduction);

// 재현에 답글 작성
router.post('/reproductions/:reproductionId/replies', authMiddleware, experimentController.replyReproduction);

// 실험 저장/북마크 토글
router.post('/:id/save', authMiddleware, experimentController.toggleSaveExperiment);

// 실험 삭제
router.delete('/:id', authMiddleware, experimentController.deleteExperiment);

// 실험 기본 정보 수정
router.put('/:id', authMiddleware, experimentController.updateExperiment);

module.exports = router;