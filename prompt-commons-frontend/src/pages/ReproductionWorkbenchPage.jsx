// src/pages/ReproductionWorkbenchPage.jsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    Play,
    Edit3,
    FileText,
    Clipboard,
    ClipboardCheck,
    Wand2,
    AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Badge } from '../components';
import { fetchExperimentById, submitVerificationReport} from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ReproductionWorkbenchPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [experiment, setExperiment] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentStep, setCurrentStep] = useState(1);
    const [modifiedPrompt, setModifiedPrompt] = useState('');
    const [score, setScore] = useState(50);
    const [feedback, setFeedback] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        fetchExperimentById(id)
            .then(data => {
                setExperiment(data);
                setModifiedPrompt(data.prompt_text); 
            })
            .catch(err => {
                console.error("Failed to fetch experiment:", err);
                setError(err.message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [id]);

    const handleNext = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleAiAssist = () => {
        toast.loading('AI is analyzing instructions...', { duration: 1500 });
        setTimeout(() => {
            toast.dismiss();
            toast.success('AI suggestions applied!');
            setModifiedPrompt(prev => prev + "\n\n[AI Suggestion]: Consider adding specific constraints for your context here.");
        }, 1500);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(modifiedPrompt).then(() => {
            setIsCopied(true);
            toast.success('Prompt copied to clipboard!');
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    
    const handleSubmit = () => {
        if (!user) {
            toast.error('You must be logged in to submit a report.');
            return;
        }

        const report = {
            templateId: id,
            modifiedContent: modifiedPrompt,
            score,
            feedback,
            status: 'submitted'
        };

        submitVerificationReport(id, report, user)
            .then(() => {
                toast.success('Verification report submitted!');
                navigate(`/experiments/${id}`);
            })
            .catch(err => {
                console.error('Failed to submit report:', err);
                toast.error('Failed to submit report.');
            });
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen">Loading workbench...</div>;
    if (error) return <div className="text-center py-20 text-red-500">Error: {error}</div>;
    if (!experiment) return null;

    const steps = [
        { id: 1, label: 'Load', icon: FileText },
        { id: 2, label: 'Adapt', icon: Edit3 },
        { id: 3, label: 'Run', icon: Play },
        { id: 4, label: 'Evaluate', icon: CheckCircle },
    ];

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                 <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/experiments/${id}`)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Exit
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">{experiment.title}</h1>
                        <p className="text-xs text-gray-500">Reproduction Workbench</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center">
                             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStep === step.id
                                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-1'
                                : currentStep > step.id
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-400'
                                }`}>
                                <step.icon className="w-4 h-4" />
                                <span>{step.label}</span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`h-0.5 w-6 mx-1 ${currentStep > step.id ? 'bg-green-300' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="w-32" />
            </header>

             <div className="flex-1 flex overflow-hidden">
                 <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto p-6 hidden md:block">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Reference</h2>
                     <div className="mb-6">
                        <h3 className="font-semibold text-gray-900 mb-2">Original Prompt</h3>
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 text-sm font-mono whitespace-pre-wrap text-gray-700">
                            {experiment.prompt_text}
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-semibold text-gray-900 mb-2">Instructions</h3>
                        <div className="prose prose-sm text-gray-600">
                            {experiment.modification_guide ? (
                                <p className="whitespace-pre-wrap">{experiment.modification_guide}</p>
                            ) : (
                                <>
                                    <p>1. Read the prompt carefully.</p>
                                    <p>2. Identify placeholders (e.g., [Subject]).</p>
                                    <p>3. Replace them with your specific context.</p>
                                    <p>4. Run the prompt in your AI model ({experiment.ai_model}).</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Metadata</h3>
                        <div className="flex flex-wrap gap-2">
                            <Badge>{experiment.ai_model}</Badge>
                            <Badge>{experiment.task_type}</Badge>
                            <Badge>{experiment.active_version}</Badge>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-gray-50 overflow-y-auto p-6 flex flex-col items-center">
                    <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
                        
                        <div className="flex-1 p-8">
                             {currentStep === 1 && (
                                <div className="space-y-6">
                                    <div className="text-center mb-8">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900">Review Original Prompt</h2>
                                        <p className="text-gray-600 mt-2">Familiarize yourself with the prompt and instructions on the left.</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800">
                                        <p className="font-medium flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" /> Note
                                        </p>
                                        <p className="text-sm mt-1">Ensure you have access to <strong>{experiment.ai_model}</strong> or a compatible model before proceeding.</p>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-4 h-full flex flex-col">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold text-gray-900">Adapt Prompt</h2>
                                        <Button variant="outline" size="sm" onClick={handleAiAssist} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                                            <Wand2 className="w-4 h-4 mr-2" /> AI Assist
                                        </Button>
                                    </div>
                                    <p className="text-sm text-gray-500">Modify the prompt for your specific use case.</p>
                                    <textarea
                                        value={modifiedPrompt}
                                        onChange={(e) => setModifiedPrompt(e.target.value)}
                                        className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        placeholder="Edit your prompt here..."
                                    />
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-bold text-gray-900">Run Experiment</h2>
                                        <p className="text-gray-600 mt-2">Copy the prompt and run it in your AI environment.</p>
                                    </div>

                                    <div className="relative">
                                        <div className="bg-gray-900 rounded-lg p-6 text-gray-100 font-mono text-sm whitespace-pre-wrap min-h-[200px]">
                                            {modifiedPrompt}
                                        </div>
                                        <div className="absolute top-4 right-4">
                                            <Button variant="secondary" size="sm" onClick={handleCopy}>
                                                {isCopied ? <ClipboardCheck className="w-4 h-4 mr-2" /> : <Clipboard className="w-4 h-4 mr-2" />}
                                                {isCopied ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex justify-center">
                                        <a
                                            href="https://chat.openai.com"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                        >
                                            Open ChatGPT <ArrowRight className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-bold text-gray-900">Evaluate Results</h2>
                                        <p className="text-gray-600 mt-2">How well did the prompt perform?</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="score-range" className="block text-sm font-medium text-gray-700 mb-2">
                                                Success Score: <span className="text-blue-600 font-bold text-lg">{score}</span>
                                            </label>
                                            <input
                                                id="score-range"
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={score}
                                                onChange={(e) => setScore(parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Failure (0)</span>
                                                <span>Success (100)</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Feedback & Observations</label>
                                            <textarea
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                rows={5}
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Describe the output quality, any issues, or unexpected behaviors..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex justify-between items-center">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={currentStep === 1}
                                className={currentStep === 1 ? 'invisible' : ''}
                            >
                                Back
                            </Button>

                            <div className="flex gap-3">
                                {currentStep < 4 ? (
                                    <Button variant="primary" onClick={handleNext}>
                                        Next Step <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button variant="primary" onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white">
                                        Submit Report <CheckCircle className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReproductionWorkbenchPage;