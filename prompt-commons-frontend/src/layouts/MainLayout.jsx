import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Search, Github, Plus } from 'lucide-react';
import { Button } from '../components';

import { useAuth } from '../contexts/AuthContext';

export default function MainLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleHeaderSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster position="top-center" />
      {/* Header - Enhanced with glass effect */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl">🚀</span>
              <span className="text-xl font-bold text-gray-900">Prompt Commons</span>
            </Link>

            {/* Search Input - Desktop only */}
            <div className="flex-1 max-w-lg mx-8 hidden md:block">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleHeaderSearch}
                  className="w-full bg-gray-100 rounded-full pl-11 pr-4 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:bg-white transition-all duration-200 text-gray-900"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/experiments/new" className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  New Experiment
                </Link>
              </Button>

              {isAuthenticated ? (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/my-page">{user.username}</Link>
                  </Button>
                  <Button onClick={logout} variant="outline" size="sm">
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-gray-900 px-4 py-2
                               rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg
                               hover:bg-blue-700 transition-colors font-medium shadow-sm
                               hover:shadow-md"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer - Enhanced */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-600 text-sm">© 2025 Prompt Commons. All rights reserved.</p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900
                       transition-colors group"
            >
              <Github className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
