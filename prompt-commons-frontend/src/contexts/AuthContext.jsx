import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { setAccessToken as setApiAccessToken } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  // State 대신 Ref 사용: 렌더링 유발 방지 및 useEffect 의존성 루프 해결
  const isRefreshingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // ✅ 수정됨: 갱신된 Access Token을 반환하도록 변경
  const refreshTokens = useCallback(async () => {
    if (isRefreshingRef.current) return null; // 중복 호출 방지

    isRefreshingRef.current = true;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // HttpOnly 쿠키 전송
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // 상태 업데이트
      setAccessToken(data.accessToken);
      setUser(data.user);
      setApiAccessToken(data.accessToken); // API 서비스에 토큰 설정

      // ★ 핵심 수정: 갱신된 토큰을 즉시 반환 (State 업데이트를 기다리지 않음)
      return data.accessToken;
    } catch (error) {
      // 실패 시 로그아웃 처리 (조용히 처리)
      setAccessToken(null);
      setUser(null);
      setApiAccessToken(null);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []); // 의존성 제거: API_BASE_URL은 상수, set 함수들은 안정적

  // 앱 초기화 (새로고침 시 로그인 유지)
  useEffect(() => {
    const initAuth = async () => {
      await refreshTokens();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshTokens]);

  // 주기적 갱신 (14분마다)
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      refreshTokens();
    }, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, refreshTokens]);

  const login = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setAccessToken(data.accessToken);
      setUser(data.user);
      setApiAccessToken(data.accessToken); // API 서비스에 토큰 설정
      toast.success('Login Successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      toast.success('Registration successful! Please login.');
      navigate('/login');
      return data;
    } catch (error) {
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setAccessToken(null);
    setUser(null);
    setApiAccessToken(null); // API 서비스 토큰 초기화
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  // ✅ 수정됨: refreshTokens의 반환값을 사용하도록 변경
  const getValidToken = useCallback(async () => {
    // 1. 메모리에 토큰이 있으면(로그인 상태) 바로 반환
    if (accessToken) return accessToken;

    // 2. 토큰이 없으면(새로고침 직후 등) 리프레시 시도하고, 그 결과(새 토큰)를 반환
    // 이전에는 여기서 state인 accessToken을 반환해서 null 문제가 발생했음
    const newAccessToken = await refreshTokens();
    return newAccessToken;
  }, [accessToken, refreshTokens]);

  const value = {
    user,
    accessToken,
    login,
    register,
    logout,
    refreshTokens,
    getValidToken,
    isAuthenticated: !!user,
    isLoading,
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};