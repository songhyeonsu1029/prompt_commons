import { Link } from 'react-router-dom';
import { Button } from '../components';
import { AlertTriangle } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">404 - Page Not Found</h1>
      <p className="text-lg text-gray-600 mb-6">
        Sorry, the page you are looking for does not exist.
      </p>
      <Button asChild>
        <Link to="/">Go back to Homepage</Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;
