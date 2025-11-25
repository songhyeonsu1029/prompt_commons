import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { RefreshCcw, Eye } from 'lucide-react';
import Badge from './Badge';
import { cn } from '../utils/cn';

export default function Card({ experiment, onClick, className }) {
  const {
    title,
    prompt_text,
    reproduction_rate,
    reproduction_count,
    tags = [],
    ai_model,
    author,
    views,
  } = experiment;

  // Determine badge based on reproduction rate
  const getStatusBadge = () => {
    if (reproduction_rate >= 80) {
      return { variant: 'success', text: '✅ Verified' };
    } else if (reproduction_rate >= 50) {
      return { variant: 'warning', text: '⚠️ Under Review' };
    } else {
      return { variant: 'danger', text: '❌ Unstable' };
    }
  };

  const statusBadge = getStatusBadge();

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm p-6 cursor-pointer',
        'transition-all duration-300 hover:shadow-lg hover:border-blue-300',
        'transform hover:-translate-y-1',
        'focus:outline-none focus:ring-2 focus:ring-blue-500', // Added focus style
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900 flex-1 mr-2 line-clamp-1">{title}</h3>
        <Badge variant="default" className="text-xs shrink-0">
          {ai_model}
        </Badge>
      </div>

      {/* Body - Prompt Preview */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{prompt_text}</p>

      {/* Status Section */}
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={statusBadge.variant} className="font-medium">
          {statusBadge.text}
        </Badge>
        <span className="text-sm text-gray-500">{reproduction_rate}%</span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="default" className="text-xs">
              +{tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Footer - Meta Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
        <Link
          to={`/users/${author?.username}`}
          className="font-medium text-gray-700 hover:underline z-10 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {author?.username || 'Unknown Author'}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1" title="재현 횟수">
            <RefreshCcw className="h-4 w-4" />
            <span>{reproduction_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{views}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Card.propTypes = {
  experiment: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string.isRequired,
    prompt_text: PropTypes.string.isRequired,
    reproduction_rate: PropTypes.number.isRequired,
    reproduction_count: PropTypes.number,
    tags: PropTypes.arrayOf(PropTypes.string),
    ai_model: PropTypes.string,
    author: PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
    }),
    views: PropTypes.number,
  }).isRequired,
  onClick: PropTypes.func,
  className: PropTypes.string,
};
