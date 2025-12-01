// src/services/api.js

// ==========================================
// API Configuration
// ==========================================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// ==========================================
// API Request Helper
// ==========================================

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

const apiRequest = async (endpoint, options = {}) => {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    },
    ...options,
    credentials: 'include', // 쿠키 포함
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }

  return response.json();
};

// ==========================================
// Experiments API
// ==========================================

/**
 * 실험 목록 조회
 */
export const fetchExperiments = ({ page = 1, limit = 6, model, taskType, sort, q } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (model) params.append('model', model);
  if (taskType) params.append('taskType', taskType);
  if (sort) params.append('sort', sort);
  if (q) params.append('q', q);

  return apiRequest(`/experiments?${params.toString()}`);
};

/**
 * 실험 상세 조회
 */
export const fetchExperimentById = (id, _username = null, version = null) => {
  const queryParams = version ? `?version=${version}` : '';
  return apiRequest(`/experiments/${id}${queryParams}`);
};

/**
 * 실험 생성
 */
export const createExperiment = (experimentData) => {
  return apiRequest('/experiments', {
    method: 'POST',
    body: JSON.stringify(experimentData),
  });
};

/**
 * 실험 새 버전 배포
 */
export const updateExperiment = (experimentId, newVersionData) => {
  return apiRequest(`/experiments/${experimentId}/versions`, {
    method: 'POST',
    body: JSON.stringify(newVersionData),
  });
};

/**
 * 실험 삭제
 */
export const deleteExperiment = (experimentId) => {
  return apiRequest(`/experiments/${experimentId}`, {
    method: 'DELETE',
  });
};

/**
 * 실험 저장/해제 토글
 */
export const saveExperiment = (experimentId) => {
  return apiRequest(`/experiments/${experimentId}/save`, {
    method: 'POST',
  });
};

/**
 * 실험 검색
 */
export const searchExperiments = ({ query = '', tag = '', model = 'All', rate = 'All', page = 1, limit = 10 } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (query) params.append('q', query);
  if (tag) params.append('tag', tag);
  if (model && model !== 'All') params.append('model', model);
  if (rate && rate !== 'All') params.append('rate', rate);

  return apiRequest(`/experiments/search?${params.toString()}`);
};

/**
 * 주간 인기 실험 Top 10 조회
 */
export const fetchWeeklyTopExperiments = () => {
  return apiRequest('/experiments/weekly-top');
};

// ==========================================
// Comments API
// ==========================================

/**
 * 댓글 작성
 */
export const postComment = (experimentId, _author, text) => {
  return apiRequest(`/experiments/${experimentId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};

/**
 * 댓글 삭제
 */
export const deleteComment = (experimentId, commentId) => {
  return apiRequest(`/experiments/${experimentId}/comments/${commentId}`, {
    method: 'DELETE',
  });
};

// ==========================================
// Reproductions API
// ==========================================

/**
 * 검증 리포트 제출
 */
export const submitVerificationReport = (experimentId, report, _user, versionNumber) => {
  return apiRequest(`/experiments/${experimentId}/reproductions`, {
    method: 'POST',
    body: JSON.stringify({
      version_number: versionNumber,
      modifiedContent: report.modifiedContent,
      score: report.score,
      feedback: report.feedback,
    }),
  });
};

/**
 * 재현 리포트 업보트
 */
export const voteReproduction = (reproductionId) => {
  return apiRequest(`/experiments/reproductions/${reproductionId}/vote`, {
    method: 'POST',
  });
};

/**
 * 재현 리포트 답글
 */
export const replyToReproduction = (reproductionId, _user, text) => {
  return apiRequest(`/experiments/reproductions/${reproductionId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ content: text }),
  });
};

// ==========================================
// Users API
// ==========================================

/**
 * 내 페이지 데이터 조회
 */
export const fetchMyPageData = () => {
  return apiRequest('/users/me');
};

/**
 * 사용자 프로필 조회
 */
export const getUserByUsername = (username) => {
  return apiRequest(`/users/${username}`);
};

/**
 * 프로필 수정
 */
export const updateUserProfile = (data) => {
  return apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * 비밀번호 변경
 */
export const changePassword = (currentPassword, newPassword) => {
  return apiRequest('/users/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

// ==========================================
// Statistics API
// ==========================================

/**
 * 플랫폼 통계 조회
 */
export const fetchPlatformStats = () => {
  return apiRequest('/stats');
};

// ==========================================
// Follow/Following API
// ==========================================

/**
 * 유저 팔로우
 */
export const followUser = (username) => {
  return apiRequest(`/users/${username}/follow`, {
    method: 'POST',
  });
};

/**
 * 유저 언팔로우
 */
export const unfollowUser = (username) => {
  return apiRequest(`/users/${username}/follow`, {
    method: 'DELETE',
  });
};

/**
 * 팔로워 목록 조회
 */
export const getFollowers = (username) => {
  return apiRequest(`/users/${username}/followers`);
};

/**
 * 팔로잉 목록 조회
 */
export const getFollowing = (username) => {
  return apiRequest(`/users/${username}/following`);
};
