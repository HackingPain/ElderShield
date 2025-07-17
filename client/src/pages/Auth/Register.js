import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
    role: 'senior',
    agreeToTerms: false,
    agreeToPrivacy: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { register, user, loading: authLoading } = useAuth();

  // Redirect if already logged in
  if (user && !authLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // First Name
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    // Last Name
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    // Email
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone (optional but validate if provided)
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Date of Birth (required for seniors)
    if (formData.role === 'senior' && !formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required for seniors';
    }

    // Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms and Privacy
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the Terms of Service';
    }

    if (!formData.agreeToPrivacy) {
      newErrors.agreeToPrivacy = 'You must agree to the Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    
    // Prepare data for API
    const registrationData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.toLowerCase().trim(),
      phone: formData.phone.trim() || null,
      dateOfBirth: formData.dateOfBirth || null,
      password: formData.password,
      role: formData.role
    };

    const result = await register(registrationData);
    setLoading(false);

    if (!result.success) {
      setErrors({ general: result.error });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="text-4xl font-bold text-indigo-600 mb-2">🛡️</div>
        </div>
        <h2 className="text-center text-3xl font-bold text-gray-900 mb-2">
          Join ElderShield
        </h2>
        <p className="text-center text-sm text-gray-600">
          Create your secure family care account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-200">
          {/* General Error */}
          {errors.general && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                  formData.role === 'senior' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="senior"
                    checked={formData.role === 'senior'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center w-full">
                    <div className="text-2xl mb-1">👴</div>
                    <div className="text-sm font-medium">Senior</div>
                  </div>
                </label>
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                  formData.role === 'caregiver' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="caregiver"
                    checked={formData.role === 'caregiver'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center w-full">
                    <div className="text-2xl mb-1">👩‍⚕️</div>
                    <div className="text-sm font-medium">Caregiver</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="First name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="(555) 123-4567"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Date of Birth (for seniors) */}
            {formData.role === 'senior' && (
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.dateOfBirth ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Create a strong password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms and Privacy */}
            <div className="space-y-3">
              <div className="flex items-start">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                />
                <label htmlFor="agreeToTerms" className="ml-2 text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/terms" className="text-indigo-600 hover:text-indigo-500 font-medium">
                    Terms of Service
                  </Link>
                </label>
              </div>
              {errors.agreeToTerms && (
                <p className="text-sm text-red-600">{errors.agreeToTerms}</p>
              )}

              <div className="flex items-start">
                <input
                  id="agreeToPrivacy"
                  name="agreeToPrivacy"
                  type="checkbox"
                  checked={formData.agreeToPrivacy}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                />
                <label htmlFor="agreeToPrivacy" className="ml-2 text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/privacy" className="text-indigo-600 hover:text-indigo-500 font-medium">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {errors.agreeToPrivacy && (
                <p className="text-sm text-red-600">{errors.agreeToPrivacy}</p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Sign in to your account
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            HIPAA compliant • SOC2 Type II • Enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;