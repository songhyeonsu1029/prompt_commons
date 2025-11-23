// src/middlewares/errorHandler.js

/**
 * 커스텀 API 에러 클래스
 * 에러 발생 시 상태 코드와 메시지를 함께 전달
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * 404 Not Found 핸들러
 * 등록되지 않은 라우트에 접근할 때 처리
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `요청한 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * 글로벌 에러 핸들러
 * 모든 에러를 일관된 JSON 형식으로 응답
 */
const errorHandler = (err, req, res, next) => {
  // 이미 응답이 시작된 경우 기본 에러 핸들러에 위임
  if (res.headersSent) {
    return next(err);
  }

  // 개발 환경에서는 에러 로깅
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }

  // 상태 코드 결정
  let statusCode = err.statusCode || 500;
  let message = err.message || '서버에서 오류가 발생했습니다.';

  // Prisma 에러 처리
  if (err.code) {
    switch (err.code) {
      case 'P2002': // Unique constraint failed
        statusCode = 409;
        message = '이미 존재하는 데이터입니다.';
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        message = '요청한 데이터를 찾을 수 없습니다.';
        break;
      case 'P2003': // Foreign key constraint failed
        statusCode = 400;
        message = '연관된 데이터를 찾을 수 없습니다.';
        break;
      default:
        if (statusCode === 500) {
          message = '데이터베이스 처리 중 오류가 발생했습니다.';
        }
    }
  }

  // JSON 파싱 에러
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = '잘못된 JSON 형식입니다.';
  }

  // Validation 에러 (express-validator 등)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // 일관된 에러 응답 형식
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * 비동기 라우트 핸들러 래퍼
 * try-catch 없이 async 함수에서 발생하는 에러를 자동으로 next()에 전달
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler
};
