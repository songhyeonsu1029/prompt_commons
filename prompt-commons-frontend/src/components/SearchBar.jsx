import { useState } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import Button from './Button';
import { cn } from '../utils/cn';

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  defaultValue = '',
  className,
}) {
  const [value, setValue] = useState(defaultValue);

  const handleSearch = () => {
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   transition-colors"
        />
      </div>
      <Button onClick={handleSearch} variant="primary">
        Search
      </Button>
    </div>
  );
}

SearchBar.propTypes = {
  placeholder: PropTypes.string,
  onSearch: PropTypes.func,
  defaultValue: PropTypes.string,
  className: PropTypes.string,
};
