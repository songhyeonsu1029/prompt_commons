import PropTypes from 'prop-types';
import { cn } from '../utils/cn';

export default function Badge({ children, variant = 'default', className }) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variants = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    brand: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return <span className={cn(baseStyles, variants[variant], className)}>{children}</span>;
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['success', 'warning', 'danger', 'brand', 'default']),
  className: PropTypes.string,
};
