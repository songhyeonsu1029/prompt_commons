import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../components';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (formData.password !== formData.passwordConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Mock API Call
    console.log('Registering:', formData);

    toast.success('Registration Successful! Please log in.');
    navigate('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="max-w-md w-full p-8 space-y-8">
        <h2 className="text-2xl font-bold text-center mb-6">Create an Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={handleChange}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
            />
          </div>
          <div>
            <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              required
              value={formData.passwordConfirm}
              onChange={handleChange}
              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
            />
          </div>

          <div>
            <Button type="submit" className="w-full mt-4">
              Sign Up
            </Button>
          </div>
        </form>
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
