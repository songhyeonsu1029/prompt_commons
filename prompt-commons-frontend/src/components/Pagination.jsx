import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Simplified pagination links for this example
  // In a real app, you might want more complex logic for many pages (e.g., ellipses)
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center space-x-2 mt-12">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {pageNumbers.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium',
            page === currentPage
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100'
          )}
        >
          {page}
        </button>
      ))}

      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default Pagination;
