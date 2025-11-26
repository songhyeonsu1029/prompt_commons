import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Failed to parse user from localStorage', error);
      return null;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const navigate = useNavigate();

  // 토큰 갱신 함수
  const refreshTokens = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken || isRefreshing) return false;

    setIsRefreshing(true);
    try {
      // 쿠키를 사용하므로 body에 refreshToken을 보낼 필요 없음
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 포함
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.accessToken);
      // refreshToken은 쿠키에 저장되므로 localStorage 저장 안 함
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tokenExpiry', Date.now() + data.expiresIn * 1000);
      setUser(data.user);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // 리프레시 실패 시 로그아웃
      localStorage.removeItem('token');
      // localStorage.removeItem('refreshToken'); // 제거
      localStorage.removeItem('user');
      localStorage.removeItem('tokenExpiry');
      setUser(null);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // 토큰 만료 전 자동 갱신 (만료 1분 전)
  useEffect(() => {
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    // const refreshToken = localStorage.getItem('refreshToken'); // 쿠키 사용

    if (!tokenExpiry || !user) return;

    const expiryTime = parseInt(tokenExpiry);
    const timeUntilExpiry = expiryTime - Date.now();
    const refreshTime = timeUntilExpiry - 60000; // 만료 1분 전에 갱신

    if (refreshTime <= 0) {
      // 이미 만료됨 또는 곧 만료 -> 즉시 갱신
      refreshTokens();
      return;
    }

    const timer = setTimeout(() => {
      refreshTokens();
    }, refreshTime);

    return () => clearTimeout(timer);
  }, [user, refreshTokens]);

  // 앱 시작 시 토큰 유효성 확인
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const tokenExpiry = localStorage.getItem('tokenExpiry');

      if (!token) return;

      // 토큰 만료 확인
      if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
        // 만료됨 -> 리프레시 시도
        const success = await refreshTokens();
        if (!success) {
          toast.error('Session expired. Please login again.');
        }
      }
    };

    checkAuth();
  }, [refreshTokens]);

  const login = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // 토큰 저장
      localStorage.setItem('token', data.accessToken || data.token);
      // localStorage.setItem('refreshToken', data.refreshToken); // 쿠키 사용
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tokenExpiry', Date.now() + (data.expiresIn || 3600) * 1000);

      setUser(data.user);
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
        body: JSON.stringify({
          email: userData.email,
          username: userData.username,
          password: userData.password,
        }),
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

    localStorage.removeItem('token');
    // localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
    setUser(null);
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  // API 요청용 토큰 가져오기 (필요 시 갱신)
  const getValidToken = useCallback(async () => {
    const tokenExpiry = localStorage.getItem('tokenExpiry');

    // 토큰이 곧 만료되거나 만료됨 -> 갱신
    if (tokenExpiry && Date.now() > parseInt(tokenExpiry) - 30000) {
      await refreshTokens();
    }

    return localStorage.getItem('token');
  }, [refreshTokens]);

  const value = {
    user,
    login,
    register,
    logout,
    refreshTokens,
    getValidToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
