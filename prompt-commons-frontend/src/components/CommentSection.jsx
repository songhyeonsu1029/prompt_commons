import { useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { postComment } from '../services/api';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';

const Comment = ({ comment }) => {
  const formatDate = (isoString) => {
    if (!isoString) return '';
    // Simple time ago logic
    const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  return (
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 flex-shrink-0">
        {comment.author.username.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="bg-gray-100 rounded-lg px-4 py-2">
          <div className="flex items-center justify-between">
            <Link to={`/users/${comment.author.username}`} className="font-semibold text-sm hover:underline">
              {comment.author.username}
            </Link>
            <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-800 mt-1">{comment.text}</p>
        </div>
      </div>
    </div>
  );
};

Comment.propTypes = {
  comment: PropTypes.object.isRequired,
};


const CommentSection = ({ experimentId, initialComments = [] }) => {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState(initialComments);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    if (!data.commentText.trim()) return;
    try {
      const newComment = await postComment(experimentId, user, data.commentText);
      setComments(prev => [newComment, ...prev]);
      reset();
      toast.success('Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment.');
      console.error(error);
    }
  };

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Comments ({comments.length})</h2>
      
      {isAuthenticated ? (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-8 flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold flex-shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              {...register('commentText', { required: true })}
              rows="3"
              placeholder="Add a comment..."
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <Button type="submit" size="sm" className="mt-2" disabled={isSubmitting}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-8 text-center bg-gray-50 p-6 rounded-lg">
            <p>You must be <Link to="/login" className="text-blue-600 font-semibold hover:underline">logged in</Link> to post a comment.</p>
        </div>
      )}

      <div className="space-y-6">
        {comments.length > 0 ? (
            comments.map(comment => <Comment key={comment.id} comment={comment} />)
        ) : (
            <p className="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
        )}
      </div>
    </div>
  );
};

CommentSection.propTypes = {
  experimentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  initialComments: PropTypes.array,
};

export default CommentSection;
