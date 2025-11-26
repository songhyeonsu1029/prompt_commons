import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserByUsername, followUser, unfollowUser, getFollowers, getFollowing } from '../services/api';
import { Card, Button } from '../components';
import { User, Calendar, Loader, AlertTriangle, Users } from 'lucide-react';

const UserProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Follow System State
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Modal State
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    setIsLoading(true);
    getUserByUsername(username)
      .then(data => {
        setProfileData(data);
        setIsFollowing(data.profile.isFollowing);
        setFollowersCount(data.profile.stats.followers);
        setFollowingCount(data.profile.stats.following);
      })
      .catch(err => {
        console.error("Failed to fetch user profile:", err);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [username]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Optimistic Update
    const prevIsFollowing = isFollowing;
    const prevFollowersCount = followersCount;

    setIsFollowing(!isFollowing);
    setFollowersCount(prevIsFollowing ? followersCount - 1 : followersCount + 1);
    setIsFollowLoading(true);

    try {
      if (prevIsFollowing) {
        await unfollowUser(username);
      } else {
        await followUser(username);
      }
    } catch (err) {
      console.error("Follow action failed:", err);
      // Revert on error
      setIsFollowing(prevIsFollowing);
      setFollowersCount(prevFollowersCount);
      alert("Failed to update follow status. Please try again.");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleShowFollowers = async () => {
    setShowFollowersModal(true);
    try {
      const data = await getFollowers(username);
      setFollowers(data.followers);
    } catch (err) {
      console.error("Failed to fetch followers:", err);
    }
  };

  const handleShowFollowing = async () => {
    setShowFollowingModal(true);
    try {
      const data = await getFollowing(username);
      setFollowing(data.following);
    } catch (err) {
      console.error("Failed to fetch following:", err);
    }
  };

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

              {/* Followers/Following Stats */}
              <div className="flex gap-6 my-4 text-center">
                <button
                  onClick={handleShowFollowers}
                  className="hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                >
                  <div className="font-bold text-lg">{followersCount}</div>
                  <div className="text-sm text-gray-600">Followers</div>
                </button>
                <button
                  onClick={handleShowFollowing}
                  className="hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                >
                  <div className="font-bold text-lg">{followingCount}</div>
                  <div className="text-sm text-gray-600">Following</div>
                </button>
              </div>

              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4 mr-2" />
                Joined in {formatDate(profile.joined_at)}
              </div>

              {isOwnProfile ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/my-page">Go to My Dashboard</Link>
                </Button>
              ) : (
                <Button
                  onClick={handleFollowToggle}
                  variant={isFollowing ? "outline" : "default"}
                  className="w-full"
                  disabled={isFollowLoading}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
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

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Followers ({followers.length})
              </h3>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {followers.length > 0 ? (
                <div className="space-y-4">
                  {followers.map((follower) => (
                    <div
                      key={follower.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <Link
                            to={`/users/${follower.username}`}
                            className="font-semibold hover:text-blue-600"
                            onClick={() => setShowFollowersModal(false)}
                          >
                            {follower.username}
                          </Link>
                          {follower.bio && (
                            <p className="text-sm text-gray-600 line-clamp-1">{follower.bio}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No followers yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Following ({following.length})
              </h3>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {following.length > 0 ? (
                <div className="space-y-4">
                  {following.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <Link
                            to={`/users/${user.username}`}
                            className="font-semibold hover:text-blue-600"
                            onClick={() => setShowFollowingModal(false)}
                          >
                            {user.username}
                          </Link>
                          {user.bio && (
                            <p className="text-sm text-gray-600 line-clamp-1">{user.bio}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Not following anyone yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
