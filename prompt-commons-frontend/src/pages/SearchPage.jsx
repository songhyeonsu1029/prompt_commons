import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar, Badge, Button, Pagination } from '../components';
import { Sparkles, SearchX, Eye, GitCommitHorizontal, Loader, X } from 'lucide-react';
import { searchExperiments } from '../services/api';

const RateBadge = ({ rate }) => {
  let variant = 'default';
  if (rate >= 80) variant = 'success';
  else if (rate >= 50) variant = 'warning';
  else variant = 'danger';
  return <Badge variant={variant}>{rate}%</Badge>;
};

const AI_MODELS = ['All', 'GPT-4', 'GPT-4o', 'Claude-3', 'Claude-3.5', 'Gemini Pro'];
const RATE_FILTERS = ['All', '80', '50'];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';
  const model = searchParams.get('model') || 'All';
  const rate = searchParams.get('rate') || 'All';
  const page = parseInt(searchParams.get('page') || '1');

  // Search Experiments
  const { data: searchData, isLoading } = useQuery({
    queryKey: ['experiments', 'search', { query, tag, model, rate, page }],
    queryFn: () => searchExperiments({ query, tag, model, rate, page }),
    placeholderData: keepPreviousData,
  });

  const results = searchData?.data || [];
  const pagination = searchData?.pagination || null;

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value === 'All') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('page', newPage);
      return newParams;
    });
    window.scrollTo(0, 0);
  };

  const handleSearch = (searchQuery) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (searchQuery) {
        newParams.set('q', searchQuery);
      } else {
        newParams.delete('q');
      }
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handleTagClick = (tagName, e) => {
    e.stopPropagation(); // Prevent card click
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tag', tagName);
      newParams.set('page', '1');
      // 태그 검색 시 텍스트 쿼리는 유지할지 여부 결정. 
      // 사용자 요청: "태그 클릭 시 해당 태그가 붙은 실험글만 검색" -> 쿼리 제거가 맞을 듯 하지만, 
      // 필터링 느낌으로 가려면 유지하는게 좋음. 
      // 하지만 "기존 자연어 기반 임베딩 하지 말고 그냥 태그가 붙은 실험들만 딱 보이게 해줘" 라고 했으므로
      // 쿼리를 제거하거나 무시해야 함. 백엔드에서 tag가 있으면 쿼리를 무시하도록 구현했음 (검색어 있어도 필터링만 됨).
      // UI적으로는 쿼리를 남겨두는게 헷갈릴 수 있으니 제거하는게 깔끔할 수 있음.
      // 여기서는 쿼리를 제거하지 않고 백엔드 로직을 따름.
      return newParams;
    });
  };

  const clearTagFilter = () => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('tag');
      newParams.set('page', '1');
      return newParams;
    });
  };

  const FilterButton = ({ value, filterKey, currentFilter }) => (
    <Button
      variant={value === currentFilter ? 'primary' : 'outline'}
      size="sm"
      onClick={() => handleFilterChange(filterKey, value)}
    >
      {value === 'All' ? 'All' : filterKey === 'rate' ? `${value}%+` : value}
    </Button>
  );

  const renderResults = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="text-center py-20">
          <SearchX className="mx-auto w-16 h-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold">
            {tag ? `No results found for tag "${tag}"` : query ? `No results found for "${query}"` : 'Start searching for experiments'}
          </h2>
          <p className="mt-2 text-gray-500">
            {tag || query ? "Try different keywords or filters" : "Enter a keyword to find AI prompts"}
          </p>
        </div>
      );
    }

    return (
      <div className="border-t border-gray-200">
        {/* 결과 개수 표시 */}
        {pagination && (
          <div className="p-4 text-sm text-gray-600">
            Found {pagination.totalResults} result{pagination.totalResults !== 1 ? 's' : ''}
            {tag && <span className="font-semibold text-blue-600 ml-1">tagged "{tag}"</span>}
            {query && ` for "${query}"`}
          </div>
        )}

        {results.map((result) => (
          <div
            key={result.id}
            className="p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => navigate(`/experiments/${result.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/experiments/${result.id}`);
              }
            }}
            role="button"
            tabIndex="0"
          >
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-blue-600 hover:underline">
                {result.title}
              </h3>
              <RateBadge rate={result.reproduction_rate} />
            </div>
            <p className="mt-2 text-gray-600 line-clamp-3">
              {result.prompt_text}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{result.ai_model}</Badge>
                {result.tags?.slice(0, 3).map((t) => (
                  <button
                    key={t}
                    onClick={(e) => handleTagClick(t, e)}
                    className="hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                  >
                    <Badge variant={t === tag ? "primary" : "secondary"}>{t}</Badge>
                  </button>
                ))}
                {result.tags?.length > 3 && (
                  <span className="text-gray-400 text-xs">+{result.tags.length - 3} more</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <span className="flex items-center gap-1">
                  <GitCommitHorizontal className="w-4 h-4" /> {result.reproduction_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {result.views || 0}
                </span>
              </div>
            </div>
          </div>
        ))}

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Search Header */}
      <header className="bg-gray-50 border-b border-gray-200 sticky top-[60px] z-40">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <SearchBar onSearch={handleSearch} defaultValue={query} />
          {tag && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Filtered by tag:</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {tag}
                <button onClick={clearTagFilter} className="hover:text-blue-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
          {!tag && query && query.split(' ').length > 4 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 text-sm text-blue-700">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <p>Natural language detected. We found prompts matching your intent.</p>
            </div>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-x-6 gap-y-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Model:</span>
            {AI_MODELS.map((m) => (
              <FilterButton key={m} value={m} filterKey="model" currentFilter={model} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Rate:</span>
            {RATE_FILTERS.map((r) => (
              <FilterButton key={r} value={r} filterKey="rate" currentFilter={rate} />
            ))}
          </div>
        </div>
      </div>

      {/* Results List */}
      <main className="max-w-7xl mx-auto px-4">
        {renderResults()}
      </main>
    </div>
  );
};

export default SearchPage;
