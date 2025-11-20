import { createContext, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  
  const navigate = useNavigate();

  const login = (userData) => {
    // In a real app, you'd get this from your API
    const mockUser = {
      id: 1,
      username: 'TestUser',
      email: userData.email,
    };
    
    localStorage.setItem('token', 'mock-jwt-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success('Login Successful!');
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const value = {
    user,
    login,
    logout,
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
