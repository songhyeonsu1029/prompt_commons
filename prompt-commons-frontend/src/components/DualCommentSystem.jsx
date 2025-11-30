import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import PropTypes from 'prop-types';
import { MessageSquare, CheckCircle, ThumbsUp, CornerDownRight, User } from 'lucide-react';
import { Button, Badge } from './index';
import { postComment, voteReproduction, replyToReproduction } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const DualCommentSystem = ({ experimentId, comments = [], reproductions = [], onUpdate, defaultTab = 'discussion' }) => {
    const [activeTab, setActiveTab] = useState(defaultTab); // 'discussion' | 'verification'
    const { user } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // ID of reproduction being replied to

    // Post Comment Mutation
    const commentMutation = useMutation({
        mutationFn: () => postComment(experimentId, user, newComment),
        onSuccess: () => {
            toast.success('Comment posted');
            setNewComment('');
            onUpdate();
        },
        onError: () => toast.error('Failed to post comment')
    });

    // Vote Mutation
    const voteMutation = useMutation({
        mutationFn: (reproductionId) => voteReproduction(reproductionId, user.id),
        onSuccess: () => {
            toast.success('Upvoted!');
            onUpdate();
        },
        onError: () => toast.error('Failed to vote')
    });

    // Reply Mutation
    const replyMutation = useMutation({
        mutationFn: ({ reproductionId, text }) => replyToReproduction(reproductionId, user, text),
        onSuccess: () => {
            toast.success('Reply posted');
            setReplyText('');
            setReplyingTo(null);
            onUpdate();
        },
        onError: () => toast.error('Failed to reply')
    });

    const handlePostComment = () => {
        if (!user) return toast.error('Please login to comment');
        if (!newComment.trim()) return;
        commentMutation.mutate();
    };

    const handleVote = (reproductionId) => {
        if (!user) return toast.error('Please login to vote');
        voteMutation.mutate(reproductionId);
    };

    const handleReply = (reproductionId) => {
        if (!user) return toast.error('Please login to reply');
        if (!replyText.trim()) return;
        replyMutation.mutate({ reproductionId, text: replyText });
    };

    return (
        <div className="mt-12 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('discussion')}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'discussion'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    General Discussion ({comments.length})
                </button>
                <button
                    onClick={() => setActiveTab('verification')}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'verification'
                        ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Verification Reports ({reproductions.length})
                </button>
            </div>

            {/* Content Area */}
            <div className="p-6 bg-gray-50 min-h-[300px]">

                {/* TAB 1: General Discussion */}
                {activeTab === 'discussion' && (
                    <div className="space-y-6">
                        {/* Comment Input */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Ask a question or share your thoughts..."
                                className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                                rows={3}
                            />
                            <div className="flex justify-end mt-2">
                                <Button size="sm" onClick={handlePostComment} disabled={!newComment.trim() || commentMutation.isPending}>
                                    {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
                                </Button>
                            </div>
                        </div>

                        {/* Comment List */}
                        <div className="space-y-4">
                            {comments.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No comments yet. Be the first to start the discussion!</p>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-medium text-sm text-gray-900">{comment.author.username}</span>
                                                    <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: Verification Reports */}
                {activeTab === 'verification' && (
                    <div className="space-y-6">
                        {reproductions.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">No Verification Reports Yet</h3>
                                <p className="text-gray-500 mt-1">Be the first to verify this prompt and share your results.</p>
                            </div>
                        ) : (
                            reproductions.map((rep) => (
                                <div key={rep.id} id={`reproduction-${rep.id}`} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                    {/* Card Header */}
                                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                <User className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{rep.user}</span>
                                            <span className="text-xs text-gray-400">• {rep.date}</span>
                                        </div>
                                        <Badge variant={rep.score >= 80 ? 'success' : rep.score >= 40 ? 'warning' : 'destructive'}>
                                            Score: {rep.score}/100
                                        </Badge>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 space-y-4">
                                        {/* Modification Summary */}
                                        {rep.modified_prompt && (
                                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Modified Prompt</p>
                                                <p className="text-xs font-mono text-gray-600 line-clamp-3">{rep.modified_prompt}</p>
                                            </div>
                                        )}

                                        {/* Review */}
                                        <div>
                                            <p className="text-sm text-gray-800">{rep.note}</p>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleVote(rep.id)}
                                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                                            >
                                                <ThumbsUp className="w-4 h-4" />
                                                <span>{rep.upvotes || 0} Helpful</span>
                                            </button>
                                            <button
                                                onClick={() => setReplyingTo(replyingTo === rep.id ? null : rep.id)}
                                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                                            >
                                                <CornerDownRight className="w-4 h-4" />
                                                <span>Reply</span>
                                            </button>
                                        </div>

                                        {/* Replies Section */}
                                        {(rep.replies?.length > 0 || replyingTo === rep.id) && (
                                            <div className="pl-4 border-l-2 border-gray-200 space-y-3 mt-2">
                                                {rep.replies?.map((reply) => (
                                                    <div key={reply.id} className="bg-white p-2 rounded border border-gray-100 text-sm">
                                                        <span className="font-bold text-gray-900 mr-2">{reply.author.username}</span>
                                                        <span className="text-gray-600">{reply.content}</span>
                                                    </div>
                                                ))}

                                                {replyingTo === rep.id && (
                                                    <div className="flex gap-2 mt-2">
                                                        <input
                                                            type="text"
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Write a reply..."
                                                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                        <Button size="sm" variant="outline" onClick={() => handleReply(rep.id)}>
                                                            Reply
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

DualCommentSystem.propTypes = {
    experimentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    comments: PropTypes.array,
    reproductions: PropTypes.array,
    onUpdate: PropTypes.func.isRequired,
    defaultTab: PropTypes.oneOf(['discussion', 'verification'])
};

export default DualCommentSystem;