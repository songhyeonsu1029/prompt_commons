import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, Card, Pagination } from '../components';
import { fetchExperiments } from '../services/api';
import { Loader } from 'lucide-react';

const STATS = [
  { label: 'Verified Prompts', value: '12,340+' },
  { label: 'Total Reproductions', value: '850K+' },
  { label: 'Active Researchers', value: '5,000+' },
];

const QUICK_FILTERS = ['#GPT-4o', '#Claude-3.5', '#Coding', '#RAG', '#ImageGen'];

export default function HomePage() {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchExperiments({ page: currentPage, limit: 6 })
      .then(response => {
        setExperiments(response.data);
        setPagination(response.pagination);
      })
      .catch(error => {
        console.error("Failed to fetch experiments:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [currentPage]);

  const handleSearch = (query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleCardClick = (id) => {
    navigate(`/experiments/${id}`);
  };

  const handleFilterClick = (tag) => {
    navigate(`/search?tag=${encodeURIComponent(tag)}`);
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0); // Scroll to top on page change
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section - Enhanced with vibrant gradient */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Discover Reliability in the AI Era
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-3xl">
              A community driven by reproduction verification.
            </p>

            {/* Search Bar */}
            <div className="w-full max-w-2xl mb-8">
              <SearchBar placeholder="Search verified prompts..." onSearch={handleSearch} />
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap justify-center gap-3">
              {QUICK_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterClick(filter)}
                  className="text-white border-white hover:bg-white/20"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Enhanced */}
      <section className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {STATS.map((stat) => (
              <div key={stat.label} className="group">
                <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-3 transition-transform duration-200 group-hover:scale-110">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium text-lg">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Experiments Section - Enhanced */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              🔥 Weekly Top Experiments
            </h2>
            <p className="text-gray-600 text-lg">Most verified and reproduced prompts this week</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
                <Loader className="w-12 h-12 animate-spin text-blue-600" />
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
              {pagination && (
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