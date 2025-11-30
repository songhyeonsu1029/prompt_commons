import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../utils/cn';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  // 페이지가 1개뿐이면 숨김
  if (totalPages <= 1) {
    return null;
  }

  // 페이지 번호 리스트 생성 로직 (1 ... 4 5 6 ... 10)
  const getPageNumbers = () => {
    const pages = [];
    const delta = 1; // 현재 페이지 양옆으로 보여줄 개수

    // 1. 항상 첫 페이지 포함
    pages.push(1);

    // 2. 중간 페이지 범위 계산
    let start = Math.max(2, currentPage - delta);
    let end = Math.min(totalPages - 1, currentPage + delta);

    // 예외 처리: 시작 부분이나 끝 부분이 너무 짧으면 연결해서 보여줌
    if (currentPage <= 3) {
      end = Math.min(totalPages - 1, 4); // 1, 2, 3, 4 ...
    }
    if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - 3); // ... 7, 8, 9, 10
    }

    // 3. 앞쪽 생략(...) 추가
    if (start > 2) {
      pages.push('ellipsis-start');
    }

    // 4. 중간 페이지들 추가
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // 5. 뒤쪽 생략(...) 추가
    if (end < totalPages - 1) {
      pages.push('ellipsis-end');
    }

    // 6. 항상 마지막 페이지 포함 (1페이지가 아닐 때만)
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <nav className="flex items-center justify-center gap-1 mt-12 select-none">
      {/* 이전 버튼 */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* 페이지 번호들 */}
      {getPageNumbers().map((page, index) => {
        if (typeof page === 'string') {
          return (
            <span key={page} className="px-2 text-gray-400">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              'min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-all duration-200',
              page === currentPage
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            {page}
          </button>
        );
      })}

      {/* 다음 버튼 */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
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