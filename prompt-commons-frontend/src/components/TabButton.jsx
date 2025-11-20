import React from 'react';
import { cn } from '../utils/cn';

const TabButton = ({ active, onClick, children }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center p-4 border-b-2 font-medium text-sm',
      active
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

export default TabButton;
