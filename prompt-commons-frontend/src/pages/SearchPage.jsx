import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar, Badge, Button, Pagination } from '../components';
import { Sparkles, SearchX, Eye, GitCommitHorizontal, Loader } from 'lucide-react';
import { searchExperiments } from '../services/api';

const highlightText = (text, query) => {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 px-0">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const RateBadge = ({ rate }) => {
  let variant = 'default';
  if (rate >= 80) variant = 'success';
  else if (rate >= 50) variant = 'warning';
  else variant = 'danger';
  return <Badge variant={variant}>{rate}%</Badge>;
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const query = searchParams.get('q') || '';
  const model = searchParams.get('model') || 'All';
  const rate = searchParams.get('rate') || 'All';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    const performSearch = () => {
      setIsLoading(true);
      searchExperiments({ query, model, rate, page })
        .then(response => {
          setResults(response.data);
          setPagination(response.pagination);
        })
        .catch(console.error)
        .finally(() => {
          setIsLoading(false);
        });
    };
    performSearch();
  }, [query, model, rate, page]);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value === 'All') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      // Reset page to 1 when filters change
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
  }

  const handleSearch = (searchQuery) => {
    handleFilterChange('q', searchQuery || 'All');
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
          <h2 className="mt-4 text-xl font-semibold">No results found for &quot;{query}&quot;</h2>
          <p className="mt-2 text-gray-500">
            Try simpler keywords like &apos;Python&apos; or &apos;TDD&apos;
          </p>
        </div>
      );
    }
    
    return (
      <div className="border-t border-gray-200">
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
                {highlightText(result.title, query)}
              </h3>
              {/* Fake match score for now */}
              <Badge variant="success">98% Match</Badge> 
            </div>
            <p className="mt-2 text-gray-600 line-clamp-3">
              {highlightText(result.prompt_text, query)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{result.ai_model}</Badge>
                <RateBadge rate={result.reproduction_rate} />
                {result.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <span className="flex items-center gap-1">
                  <GitCommitHorizontal className="w-4 h-4" /> {result.reproduction_count}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {result.views}
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
          {query.split(' ').length > 4 && (
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
            {['All', 'gpt-4', 'claude-3-sonnet', 'gemini-pro'].map((m) => (
              <FilterButton key={m} value={m} filterKey="model" currentFilter={model} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Rate:</span>
            {['All', '80', '50'].map((r) => (
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