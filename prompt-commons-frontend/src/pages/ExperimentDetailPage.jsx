import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Beaker,
  Clipboard,
  ClipboardCheck,
  AlertTriangle,
  Bookmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  DualCommentSystem,
  ReliabilityCard,
  ExperimentHeader,
  VersionHistory,
  DraftVersionModal,
  Badge
} from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useExperiment } from '../hooks/useExperiment';
import { deleteExperiment } from '../services/api';

const ExperimentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // URL 파라미터에서 버전 가져오기
  const versionParam = searchParams.get('version');
  const [selectedVersion, setSelectedVersion] = useState(versionParam);

  const [activeTab, setActiveTab] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Custom Hook for Experiment Data
  const {
    experiment,
    isLoading,
    isError,
    error,
    saveMutation,
    publishMutation
  } = useExperiment(id, user);

  // URL 파라미터 변경 시 selectedVersion 업데이트
  useEffect(() => {
    if (versionParam) {
      setSelectedVersion(versionParam);
    } else if (experiment?.active_version && !selectedVersion) {
      // 초기 로드 시 URL에 버전이 없으면 active_version(최신)으로 설정
      setSelectedVersion(experiment.active_version);
    }
  }, [versionParam, experiment, selectedVersion]);

  // scrollTo 파라미터 처리 - reproduction으로 자동 스크롤
  useEffect(() => {
    const scrollTo = searchParams.get('scrollTo');
    if (scrollTo && !isLoading && experiment && !hasScrolled) {
      // 약간의 지연 후 스크롤 (DOM 렌더링 대기)
      const timer = setTimeout(() => {
        const element = document.getElementById(scrollTo);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 하이라이트 효과
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 3000);
          setHasScrolled(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, experiment, hasScrolled]);

  const handleCopy = () => {
    if (!displayData) return;
    navigator.clipboard.writeText(displayData.prompt_text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to save an experiment.");
      navigate('/login');
      return;
    }
    saveMutation.mutate();
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

    publishMutation.mutate(newVersionData, {
      onSuccess: (updatedExperiment) => {
        setSelectedVersion(updatedExperiment.active_version);
        setIsModalOpen(false);
        setActiveTab('history');
      }
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

  if (isError) {
    return (
      <div className="text-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error</h2>
        <p>{error.message}</p>
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
          <ExperimentHeader
            experiment={experiment}
            selectedVersion={selectedVersion}
            onVersionChange={setSelectedVersion}
            displayData={displayData}
            formatDate={formatDate}
          />

          {/* Reliability Section */}
          <ReliabilityCard stats={{
            reproduction_rate: displayData.stats.reproduction_rate,
            reproduction_count: displayData.stats.reproduction_count,
            views: displayData.stats.views
          }} />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 my-6">
            <Button variant={experiment.isSaved ? "primary" : "outline"} onClick={handleSave} disabled={saveMutation.isPending}>
              <Bookmark className="w-4 h-4 mr-2" /> {experiment.isSaved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="primary" onClick={() => navigate(`/experiments/${id}/reproduce?version=${selectedVersion}`)}>
              <Beaker className="w-4 h-4 mr-2" /> Try Reproduction
            </Button>
            {/* Requirement: Only visible if user is author */}
            {user && experiment.author.username === user.username && (
              <>
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  Draft New Version
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (window.confirm('정말로 이 실험을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                      try {
                        await deleteExperiment(id);
                        toast.success('실험이 삭제되었습니다.');
                        navigate('/');
                      } catch (error) {
                        toast.error('실험 삭제 중 오류가 발생했습니다.');
                        console.error(error);
                      }
                    }
                  }}
                >
                  Delete Experiment
                </Button>
              </>
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
          <VersionHistory
            activeTab={activeTab}
            onTabChange={setActiveTab}
            versions={experiment.versions}
            activeVersion={experiment.active_version}
            selectedVersion={selectedVersion}
            onVersionSelect={setSelectedVersion}
            formatDate={formatDate}
          />

          {/* Dual Comment System (Replaces the old list) */}
          {/* Comments are shared across all versions, reproductions are filtered by version */}
          {displayData && (
            <DualCommentSystem
              experimentId={displayData.id}
              comments={displayData.comments || []}
              reproductions={(displayData.reproductions || []).filter(r => r.version_number === selectedVersion)}
              onUpdate={() => queryClient.invalidateQueries(['experiment', id])}
              defaultTab={searchParams.get('scrollTo')?.startsWith('reproduction-') ? 'verification' : 'discussion'}
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
      <DraftVersionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePublish}
        experiment={experiment}
        selectedVersion={selectedVersion}
        displayData={displayData}
      />
    </div>
  );
};

export default ExperimentDetailPage;