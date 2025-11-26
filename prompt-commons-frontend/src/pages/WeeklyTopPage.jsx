import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components';
import { fetchWeeklyTopExperiments } from '../services/api';
import { Loader, TrendingUp } from 'lucide-react';

export default function WeeklyTopPage() {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 주간 인기 실험 Top 10 로드
  useEffect(() => {
    setIsLoading(true);
    fetchWeeklyTopExperiments()
      .then(response => {
        setExperiments(response.data);
      })
      .catch(error => {
        console.error("Failed to fetch weekly top experiments:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleCardClick = (id) => {
    navigate(`/experiments/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Weekly Top 10
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Most popular and verified experiments from the past 7 days
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Ranked by popularity score: (Views × 1) + (Reproduction Rate × 2) + (Reproduction Count × 5)
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : experiments.length > 0 ? (
          <div className="space-y-4">
            {experiments.map((experiment, index) => (
              <div
                key={experiment.id}
                className="relative bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200 overflow-hidden"
              >
                {/* Rank Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <div className={`
                    w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg
                    ${index === 0 ? 'bg-yellow-400 text-yellow-900' : ''}
                    ${index === 1 ? 'bg-gray-300 text-gray-700' : ''}
                    ${index === 2 ? 'bg-orange-400 text-orange-900' : ''}
                    ${index > 2 ? 'bg-blue-100 text-blue-700' : ''}
                  `}>
                    #{index + 1}
                  </div>
                </div>

                {/* Card Content */}
                <div className="pl-20 pr-6 py-6">
                  <Card
                    experiment={experiment}
                    onClick={() => handleCardClick(experiment.id)}
                  />

                  {/* Popularity Score */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Popularity Score:</span>
                      <span className="font-bold text-blue-600 text-lg">
                        {experiment.popularity_score || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              No experiments found this week. Check back later!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
