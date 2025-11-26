import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, SearchBar, Card, Pagination, Badge } from '../components';
import { fetchExperiments } from '../services/api';
import { Loader, Plus, Filter, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AI_MODELS = ['All', 'GPT-4', 'GPT-4o', 'Claude-3.5', 'Claude-3', 'Gemini Pro', 'Llama-3'];
const TASK_TYPES = ['All', 'Coding', 'Writing', 'Analysis', 'Translation', 'RAG', 'Image Generation'];
const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'reproduction', label: 'Highest Reproduction Rate' },
];

export default function ExperimentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const currentPage = parseInt(searchParams.get('page') || '1');
  const selectedModel = searchParams.get('model') || 'All';
  const selectedTaskType = searchParams.get('task') || 'All';
  const sortBy = searchParams.get('sort') || 'latest';
  const searchQuery = searchParams.get('q') || '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['experiments', { page: currentPage, model: selectedModel, task: selectedTaskType, sort: sortBy, q: searchQuery }],
    queryFn: () => fetchExperiments({
      page: currentPage,
      limit: 9,
      model: selectedModel !== 'All' ? selectedModel : undefined,
      taskType: selectedTaskType !== 'All' ? selectedTaskType : undefined,
      sort: sortBy,
      q: searchQuery || undefined
    }),
    keepPreviousData: true, // 페이지네이션 시 깜빡임 방지 (v5에서는 placeholderData: keepPreviousData 사용 권장하지만 간단히 처리)
  });

  const experiments = data?.data || [];
  const pagination = data?.pagination || null;

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'All') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change
    if (!updates.page) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  const handleSearch = (query) => {
    updateParams({ q: query, page: '1' });
  };

  const handleCardClick = (id) => {
    navigate(`/experiments/${id}`);
  };

  const handlePageChange = (page) => {
    updateParams({ page: page.toString() });
    window.scrollTo(0, 0);
  };

  const clearFilters = () => {
    setSearchParams({ page: '1' });
  };

  const hasActiveFilters = selectedModel !== 'All' || selectedTaskType !== 'All' || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Experiments</h1>
              <p className="text-gray-600 mt-1">Browse and discover verified AI prompts</p>
            </div>
            {isAuthenticated && (
              <Button variant="primary" onClick={() => navigate('/experiments/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New Experiment
              </Button>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchBar
                placeholder="Search experiments..."
                onSearch={handleSearch}
                defaultValue={searchQuery}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50 border-blue-300' : ''}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Model Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Filter className="w-4 h-4 inline mr-1" />
                    AI Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => updateParams({ model: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {AI_MODELS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                {/* Task Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Type
                  </label>
                  <select
                    value={selectedTaskType}
                    onChange={(e) => updateParams({ task: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TASK_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => updateParams({ sort: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Active filters:</span>
                  {selectedModel !== 'All' && (
                    <Badge variant="info">{selectedModel}</Badge>
                  )}
                  {selectedTaskType !== 'All' && (
                    <Badge variant="info">{selectedTaskType}</Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="info">"{searchQuery}"</Badge>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-600 hover:text-red-800 ml-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Results count */}
          {pagination && (
            <p className="text-sm text-gray-600 mb-4">
              Showing {experiments.length} of {pagination.total} experiments
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader className="w-12 h-12 animate-spin text-blue-600" />
            </div>
          ) : experiments.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No experiments found</h3>
              <p className="text-gray-500 mb-6">
                {hasActiveFilters
                  ? "Try adjusting your filters or search query"
                  : "Be the first to create an experiment!"
                }
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : isAuthenticated ? (
                <Button variant="primary" onClick={() => navigate('/experiments/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Experiment
                </Button>
              ) : (
                <Button variant="primary" asChild>
                  <Link to="/login">Sign in to Create</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {experiments.map((experiment) => (
                  <Card
                    key={experiment.id}
                    experiment={experiment}
                    onClick={() => handleCardClick(experiment.id)}
                  />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
