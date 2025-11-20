import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserByUsername } from '../services/api';
import { Card, Button } from '../components';
import { User, Calendar, Loader, AlertTriangle } from 'lucide-react';

const UserProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getUserByUsername(username)
      .then(data => {
        setProfileData(data);
      })
      .catch(err => {
        console.error("Failed to fetch user profile:", err);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [username]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-16 h-16 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!profileData) return null;

  const { profile, experiments } = profileData;
  const isOwnProfile = currentUser?.username === profile.username;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Left Sidebar */}
        <aside className="lg:col-span-3 mb-8 lg:mb-0">
          <div className="sticky top-24 border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full bg-gray-200 mb-4 flex items-center justify-center">
                <User className="w-16 h-16 text-gray-500" />
              </div>
              <h1 className="text-3xl font-bold">{profile.username}</h1>
              <p className="text-gray-600 my-3">{profile.bio}</p>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-2" />
                Joined in {formatDate(profile.joined_at)}
              </div>
              {isOwnProfile && (
                <Button asChild variant="outline" className="w-full mt-4">
                  <Link to="/my-page">Go to My Dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <main className="lg:col-span-9">
          <h2 className="text-2xl font-bold mb-6">
            Experiments by {profile.username} ({experiments.length})
          </h2>
          {experiments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {experiments.map((exp) => (
                <Card
                  key={exp.id}
                  experiment={exp}
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-dashed border-2 rounded-lg">
              <p className="text-gray-500">This user hasn&apos;t published any experiments yet.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default UserProfilePage;
