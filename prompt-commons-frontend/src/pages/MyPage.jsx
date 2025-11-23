import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Beaker, User, Settings, CheckCircle, XCircle, Loader, AlertTriangle, FileText } from 'lucide-react';
import { Button, TabButton } from '../components';
import Card from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyPageData } from '../services/api';

const MyPage = () => {
  const [activeTab, setActiveTab] = useState('saved');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [myData, setMyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.username) {
      fetchMyPageData(user.username)
        .then(data => {
          setMyData(data);
        })
        .catch(err => {
          console.error("Failed to fetch My Page data:", err);
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user]);

  const renderContent = () => {
    if (!myData) return null;

    switch (activeTab) {
      case 'my-experiments':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myData.myExperiments && myData.myExperiments.length > 0 ? (
              myData.myExperiments.map((exp) => (
                <Card key={exp.id} experiment={exp} onClick={() => navigate(`/experiments/${exp.id}`)} />
              ))
            ) : (
              <div className="col-span-2 text-center py-10 text-gray-500">
                <p>You haven't created any experiments yet.</p>
                <Button asChild className="mt-4" variant="primary">
                  <Link to="/experiments/new">Create Experiment</Link>
                </Button>
              </div>
            )}
          </div>
        );
      case 'saved':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myData.savedPrompts.map((exp) => (
              <Card key={exp.id} experiment={exp} onClick={() => navigate(`/experiments/${exp.id}`)} />
            ))}
          </div>
        );
      
      case 'reproductions':
        return (
          <div className="space-y-4">
            {myData.reproductionHistory.length > 0 ? (
              myData.reproductionHistory.map(rep => (
                <div key={rep.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                      {rep.success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                      <Link to={`/experiments/${rep.experiment_id}`} className="font-semibold text-blue-600 hover:underline">
                        {rep.target_title}
                      </Link>
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">{rep.version_number}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${rep.score >= 80 ? 'text-green-600' : rep.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        Score: {rep.score}/100
                      </span>
                      <span className="text-sm text-gray-500">{rep.date}</span>
                    </div>
                  </div>

                  {/* Prompt Preview */}
                  {rep.prompt_text && (
                    <div className="px-4 py-3 bg-gray-900">
                      <p className="text-xs text-gray-400 mb-1">Prompt Preview</p>
                      <pre className="font-mono text-gray-100 text-sm line-clamp-3 whitespace-pre-wrap">
                        {rep.prompt_text}
                      </pre>
                    </div>
                  )}

                  {/* Note */}
                  {rep.note && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 italic">"{rep.note}"</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/experiments/${rep.experiment_id}?version=${rep.version_number}&scrollTo=reproduction-${rep.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p>You haven't made any reproduction attempts yet.</p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };



  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-16 h-16 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !myData) {
    return (
      <div className="text-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error Loading Page</h2>
        <p>{error || 'Could not load user data.'}</p>
      </div>
    );
  }

  const { userProfile } = myData;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Left Sidebar */}
        <aside className="lg:col-span-3 mb-8 lg:mb-0">
          <div className="sticky top-24 border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-500" />
              </div>
              <h1 className="text-2xl font-bold">{userProfile.username}</h1>
              <p className="text-gray-600 text-center my-3">{userProfile.bio}</p>
              <Button variant="outline" className="w-full mt-2">
                <Settings className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
            <div className="mt-6 border-t pt-6">
              <div className="flex justify-around text-center">
                <div className="px-2">
                  <p className="text-xl font-bold">{userProfile.stats.saved}</p>
                  <p className="text-sm text-gray-500">Saved</p>
                </div>
                <div className="px-2">
                  <p className="text-xl font-bold">{userProfile.stats.reproductions}</p>
                  <p className="text-sm text-gray-500">Reproductions</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <main className="lg:col-span-9">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-2">
              <TabButton active={activeTab === 'my-experiments'} onClick={() => setActiveTab('my-experiments')}>
                <FileText className="w-4 h-4 mr-2" /> My Experiments
              </TabButton>
              <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
                <Star className="w-4 h-4 mr-2" /> Saved
              </TabButton>
              <TabButton active={activeTab === 'reproductions'} onClick={() => setActiveTab('reproductions')}>
                <Beaker className="w-4 h-4 mr-2" /> Reproductions
              </TabButton>
            </nav>
          </div>
          <div className="mt-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MyPage;