import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Eye,
  Bookmark,
  Beaker,
  Clipboard,
  ClipboardCheck,
  AlertTriangle,
  History,
  GitCommit,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Badge,
  DualCommentSystem
} from '../components';
import { fetchExperimentById, saveExperiment, updateExperiment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ReliabilityCard = ({ stats }) => {
  const isVerified = stats.reproduction_rate >= 80;
  const rateColor = isVerified ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 my-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${rateColor}`}>{stats.reproduction_rate}%</div>
          <div>
            <Badge variant={isVerified ? 'success' : 'warning'}>
              {isVerified ? '✅ Verified' : '⚠️ Unverified'}
            </Badge>
            <p className="text-sm text-gray-600 mt-1">
              {Math.round(stats.reproduction_count * (stats.reproduction_rate / 100))} successes out of {stats.reproduction_count}{' '}
              attempts
            </p>
          </div>
        </div>
        <div className="flex items-center text-gray-600 gap-2">
          <Eye className="w-5 h-5" />
          <span>{stats.views.toLocaleString()} views</span>
        </div>
      </div>
    </div>
  );
};

const ExperimentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [experiment, setExperiment] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  
  const [activeTab, setActiveTab] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 1. loadExperimentData를 useEffect 밖으로 이동하고 useCallback으로 감쌈
  const loadExperimentData = useCallback(() => {
    setError(null);
    fetchExperimentById(id, user?.username)
      .then(data => {
        setExperiment(data);
        setIsSaved(data.isSaved);
        setSelectedVersion(prev => prev || data.version_number);
      })
      .catch(err => {
        console.error("Failed to fetch experiment:", err);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, user?.username]);

  useEffect(() => {
    loadExperimentData();
  }, [loadExperimentData]);

  const handleCopy = () => {
    if (!displayData) return;
    navigator.clipboard.writeText(displayData.prompt_text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to save an experiment.");
      navigate('/login');
      return;
    }
    try {
      const response = await saveExperiment(id, user.username);
      setIsSaved(response.isSaved);
      toast.success(response.isSaved ? "Experiment saved!" : "Experiment unsaved.");
    } catch (err) {
      toast.error(err.message || "Failed to update save status.");
    }
  };
  
  // Publishing a new version
  const handlePublish = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newVersionData = {
      version_number: formData.get('version_number'),
      prompt_text: formData.get('prompt_text'),
      prompt_description: formData.get('prompt_description'),
      modification_guide: formData.get('modification_guide'),
      changelog: formData.get('changelog'),
      ai_model: formData.get('ai_model'),
      model_version: formData.get('model_version'),
    };

    updateExperiment(id, newVersionData)
      .then((updatedExperiment) => {
        toast.success('New version published!');
        setExperiment(updatedExperiment);
        setSelectedVersion(newVersionData.version_number);
        setIsModalOpen(false);
        setActiveTab('history');
      })
      .catch((err) => {
        console.error('Failed to publish new version:', err);
        toast.error('Failed to publish new version.');
      });
  };

  // Logic to get data for the currently selected version
  const displayData = experiment && selectedVersion ? (
    experiment.versions.find(v => v.version_number === selectedVersion) ?
      { ...experiment, ...experiment.versions.find(v => v.version_number === selectedVersion), stats: experiment.versions.find(v => v.version_number === selectedVersion).stats }
      : experiment
  ) : experiment;

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <div className="text-center py-20">Loading experiment details...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error</h2>
        <p>{error}</p>
        <Button onClick={() => navigate('/')} className="mt-6">Go Home</Button>
      </div>
    );
  }

  if (!experiment) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{experiment.title}</h1>
              {/* Version Selector */}
              <div className="relative inline-block">
                <select
                  value={selectedVersion || ''}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="appearance-none bg-gray-100 border border-gray-300 text-gray-700 py-1 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500 text-sm font-medium cursor-pointer"
                >
                  {experiment.versions.map((v) => (
                    <option key={v.version_number} value={v.version_number}>
                      {v.version_number} {v.version_number === experiment.active_version ? '(Latest)' : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
              <Badge variant="info">{selectedVersion}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold">
                  {experiment.author.username.charAt(0).toUpperCase()}
                </div>
                <Link to={`/users/${experiment.author.username}`} className="hover:underline">
                  <span>{experiment.author.username}</span>
                </Link>
              </div>
              <span>•</span>
              <span>Published on {formatDate(displayData.created_at)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {displayData.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </div>

          {/* Reliability Section */}
          <ReliabilityCard stats={{
            reproduction_rate: displayData.stats.reproduction_rate,
            reproduction_count: displayData.stats.reproduction_count,
            views: displayData.stats.views
          }} />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 my-6">
            <Button variant={isSaved ? "primary" : "outline"} onClick={handleSave}>
              <Bookmark className="w-4 h-4 mr-2" /> {isSaved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="primary" onClick={() => navigate(`/experiments/${id}/reproduce?version=${selectedVersion}`)}>
              <Beaker className="w-4 h-4 mr-2" /> Try Reproduction
            </Button>
            {/* Requirement: Only visible if user is author */}
            {user && experiment.author.username === user.username && (
              <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                Draft New Version
              </Button>
            )}
          </div>

          {/* AI Model Info */}
          <div className="text-sm text-gray-700 space-y-2 mb-6">
            <p>
              <strong>AI Model:</strong> {experiment.ai_model}
            </p>
            <p>
              <strong>Model Version:</strong> {experiment.model_version}
            </p>
            <p>
              <strong>Task Type:</strong> {experiment.task_type}
            </p>
          </div>

          {/* Prompt Description */}
          {displayData && displayData.prompt_description && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Prompt Description</h2>
              <div className="prose max-w-none text-gray-700">{displayData.prompt_description}</div>
            </div>
          )}

          {/* Modification Guide */}
          {displayData && displayData.modification_guide && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Modification Guide</h2>
              <div className="prose max-w-none text-gray-700">{displayData.modification_guide}</div>
            </div>
          )}

          {/* Prompt Viewer */}
          <div className="bg-gray-900 rounded-lg relative">
            <div className="p-6">
              <pre className="font-mono text-gray-100 text-sm whitespace-pre-wrap overflow-x-auto">
                {displayData.prompt_text}
              </pre>
            </div>
            <div className="absolute top-2 right-2">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {isCopied ? (
                  <>
                    <ClipboardCheck className="w-4 h-4 mr-2" /> Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-4 h-4 mr-2" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* History Tab (Toggleable) */}
          <div className="mt-8">
             <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab(activeTab === 'history' ? null : 'history')}
                  className={`${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <History className="w-4 h-4" /> 
                  {activeTab === 'history' ? 'Hide Version History' : 'Show Version History'}
                </button>
              </nav>
            </div>

            {/* Requirement: History Tab Timeline */}
            {activeTab === 'history' && (
              <div className="space-y-0 mb-12">
                {[...experiment.versions].reverse().map((version, index, arr) => (
                  <div key={version.version_number} className="flex gap-4 relative">
                    {/* Timeline Line */}
                    {index !== arr.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 -ml-px"></div>
                    )}

                    <div className="flex flex-col items-center z-10">
                      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                        <GitCommit className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="pb-8 flex-1">
                      <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">{version.version_number}</h3>
                            {version.version_number === experiment.active_version && <Badge variant="success">Latest</Badge>}
                            {version.version_number === selectedVersion && <Badge variant="info">Viewing</Badge>}
                          </div>
                          <span className="text-sm text-gray-500">{formatDate(version.created_at)}</span>
                        </div>
                        <p className="text-gray-700 mb-4">{version.changelog}</p>
                        <Button
                          variant={selectedVersion === version.version_number ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setSelectedVersion(version.version_number)}
                          disabled={selectedVersion === version.version_number}
                        >
                          {selectedVersion === version.version_number ? "Currently Viewing" : "View This Version"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dual Comment System (Replaces the old list) */}
          {/* Comments are shared across all versions, reproductions are filtered by version */}
          {displayData && (
            <DualCommentSystem
              experimentId={displayData.id}
              comments={displayData.comments || []}
              reproductions={(displayData.reproductions || []).filter(r => r.version_number === selectedVersion)}
              onUpdate={loadExperimentData}
            />
          )}
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">💡 Similar Experiments</h3>
              <div className="space-y-3">
                {(experiment.similar || []).map((exp) => (
                  <div
                    key={exp.id}
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/experiments/${exp.id}`);
                      }
                    }}
                    role="button"
                    tabIndex="0"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-800">{exp.title}</p>
                      <Badge variant={exp.reproduction_rate >= 80 ? 'success' : 'warning'}>{exp.reproduction_rate}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Requirement: Draft New Version Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Draft New Version</h2>
            <form onSubmit={handlePublish}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="source-version" className="block text-sm font-medium text-gray-700 mb-1">Source Version</label>
                  <input
                    id="source-version"
                    type="text"
                    value={selectedVersion || experiment.active_version}
                    disabled
                    className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2 text-gray-500"
                  />
                </div>
                <div>
                  <label htmlFor="version-number" className="block text-sm font-medium text-gray-700 mb-1">New Version Number</label>
                  <input
                    id="version-number"
                    name="version_number"
                    type="text"
                    placeholder="e.g., v1.3"
                    required
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                  <input
                    id="ai-model"
                    name="ai_model"
                    type="text"
                    defaultValue={experiment.ai_model}
                    placeholder="e.g., GPT-4, Claude 3"
                    required
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="model-version" className="block text-sm font-medium text-gray-700 mb-1">Model Version</label>
                  <input
                    id="model-version"
                    name="model_version"
                    type="text"
                    defaultValue={experiment.model_version}
                    placeholder="e.g., gpt-4-turbo-2024-04-09"
                    required
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="prompt-description" className="block text-sm font-medium text-gray-700 mb-1">Prompt Description</label>
                <textarea
                  id="prompt-description"
                  name="prompt_description"
                  defaultValue={displayData.prompt_description || ''}
                  placeholder="Describe what this prompt does and its purpose..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="modification-guide" className="block text-sm font-medium text-gray-700 mb-1">Modification Guide</label>
                <textarea
                  id="modification-guide"
                  name="modification_guide"
                  defaultValue={displayData.modification_guide || ''}
                  placeholder="Provide guidance on how to modify or customize this prompt..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="prompt-text" className="block text-sm font-medium text-gray-700 mb-1">Prompt Text</label>
                <textarea
                  id="prompt-text"
                  name="prompt_text"
                  defaultValue={displayData.prompt_text}
                  rows={10}
                  required
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="changelog" className="block text-sm font-medium text-gray-700 mb-1">Changelog</label>
                <textarea
                  id="changelog"
                  name="changelog"
                  placeholder="What changed in this version?"
                  rows={3}
                  required
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Publish Version</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperimentDetailPage;