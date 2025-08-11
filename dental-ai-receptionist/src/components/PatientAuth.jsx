import React, { useState } from 'react';
import {
  User, Lock, Mail, Phone, Calendar, Shield, 
  Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight,
  Heart, UserPlus, LogIn, Key, Smartphone, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/apiService';

const PatientAuth = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
    insuranceProvider: '',
    policyNumber: '',
    agreeToTerms: false,
    enableTwoFactor: false
  });

  const [resetData, setResetData] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [twoFactorMethod, setTwoFactorMethod] = useState('sms');

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
  };

  const validatePhone = (phone) => {
    return /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);
  };

  const formatPhoneNumber = (value) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length <= 3) return phone;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateEmail(loginData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!loginData.password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.login({
        email: loginData.email,
        password: loginData.password,
        rememberMe: loginData.rememberMe
      });

      if (response.requiresTwoFactor) {
        setStep(2);
        setSuccess('Verification code sent to your registered device');
      } else {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('patientData', JSON.stringify(response.patient));
        onAuthenticated(response.patient);
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!registerData.firstName || !registerData.lastName) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    if (!validateEmail(registerData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!validatePhone(registerData.phone)) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    if (!validatePassword(registerData.password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and numbers');
      setLoading(false);
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!registerData.agreeToTerms) {
      setError('Please agree to the terms and conditions');
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.register({
        ...registerData,
        phone: registerData.phone.replace(/\D/g, '')
      });

      setSuccess('Registration successful! Please check your email to verify your account.');
      setTimeout(() => {
        setMode('login');
        setLoginData({ ...loginData, email: registerData.email });
      }, 3000);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorVerification = async () => {
    setError('');
    setLoading(true);
    const code = verificationCode.join('');

    if (code.length !== 6) {
      setError('Please enter the complete verification code');
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.verifyTwoFactor({
        email: loginData.email,
        code: code,
        method: twoFactorMethod
      });

      localStorage.setItem('authToken', response.token);
      localStorage.setItem('patientData', JSON.stringify(response.patient));
      onAuthenticated(response.patient);
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      setVerificationCode(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (step === 1) {
      if (!validateEmail(resetData.email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      try {
        await apiService.requestPasswordReset(resetData.email);
        setSuccess('Password reset code sent to your email');
        setStep(2);
      } catch (err) {
        setError('Email not found. Please check and try again.');
      }
    } else if (step === 2) {
      if (!resetData.code || resetData.code.length !== 6) {
        setError('Please enter the 6-digit verification code');
        setLoading(false);
        return;
      }

      if (!validatePassword(resetData.newPassword)) {
        setError('Password must be at least 8 characters with uppercase, lowercase, and numbers');
        setLoading(false);
        return;
      }

      if (resetData.newPassword !== resetData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      try {
        await apiService.resetPassword({
          email: resetData.email,
          code: resetData.code,
          newPassword: resetData.newPassword
        });
        setSuccess('Password reset successful! You can now login.');
        setTimeout(() => {
          setMode('login');
          setStep(1);
        }, 3000);
      } catch (err) {
        setError('Invalid or expired code. Please try again.');
      }
    }

    setLoading(false);
  };

  const handleVerificationCodeChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...verificationCode];
      newCode[index] = value;
      setVerificationCode(newCode);

      if (value && index < 5) {
        document.getElementById(`code-${index + 1}`)?.focus();
      }
    }
  };

  const handleVerificationCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  const renderLogin = () => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {step === 1 ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john.doe@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={loginData.rememberMe}
                onChange={(e) => setLoginData({ ...loginData, rememberMe: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setMode('reset')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </>
            )}
          </button>

          <div className="text-center">
            <span className="text-sm text-gray-600">Don't have an account? </span>
            <button
              type="button"
              onClick={() => setMode('register')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign up
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-600 mt-2">
              Enter the 6-digit code sent to your {twoFactorMethod === 'sms' ? 'phone' : 'email'}
            </p>
          </div>

          <div className="flex justify-center space-x-2">
            {verificationCode.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                type="text"
                value={digit}
                onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleVerificationCodeKeyDown(index, e)}
                className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={1}
              />
            ))}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={() => setTwoFactorMethod(twoFactorMethod === 'sms' ? 'email' : 'sms')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Use {twoFactorMethod === 'sms' ? 'email' : 'SMS'} instead
            </button>
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Resend code
            </button>
          </div>

          <button
            onClick={handleTwoFactorVerification}
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full text-sm text-gray-600 hover:text-gray-800"
          >
            Back to login
          </button>
        </div>
      )}
    </motion.div>
  );

  const renderRegister = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={registerData.firstName}
              onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={registerData.lastName}
              onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={registerData.phone}
              onChange={(e) => setRegisterData({ ...registerData, phone: formatPhoneNumber(e.target.value) })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={registerData.dateOfBirth}
              onChange={(e) => setRegisterData({ ...registerData, dateOfBirth: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-gray-400" />
              ) : (
                <Eye className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Must be 8+ characters with uppercase, lowercase, and numbers
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={registerData.confirmPassword}
            onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Insurance Information (Optional)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                value={registerData.insuranceProvider}
                onChange={(e) => setRegisterData({ ...registerData, insuranceProvider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Insurance Provider"
              />
            </div>
            <div>
              <input
                type="text"
                value={registerData.policyNumber}
                onChange={(e) => setRegisterData({ ...registerData, policyNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Policy Number"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={registerData.agreeToTerms}
              onChange={(e) => setRegisterData({ ...registerData, agreeToTerms: e.target.checked })}
              className="w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">
              I agree to the Terms of Service and Privacy Policy
            </span>
          </label>
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={registerData.enableTwoFactor}
              onChange={(e) => setRegisterData({ ...registerData, enableTwoFactor: e.target.checked })}
              className="w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">
              Enable two-factor authentication for added security
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <UserPlus className="w-5 h-5 mr-2" />
              Create Account
            </>
          )}
        </button>

        <div className="text-center">
          <span className="text-sm text-gray-600">Already have an account? </span>
          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Sign in
          </button>
        </div>
      </form>
    </motion.div>
  );

  const renderPasswordReset = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <form onSubmit={handlePasswordReset} className="space-y-4">
        {step === 1 ? (
          <>
            <div className="text-center mb-4">
              <Key className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Reset Your Password</h3>
              <p className="text-sm text-gray-600 mt-2">
                Enter your email address and we'll send you a verification code
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={resetData.email}
                  onChange={(e) => setResetData({ ...resetData, email: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="john.doe@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Enter Verification Code</h3>
              <p className="text-sm text-gray-600 mt-2">
                Check your email for the 6-digit code
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={resetData.code}
                onChange={(e) => setResetData({ ...resetData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-lg font-semibold"
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={resetData.newPassword}
                onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={resetData.confirmPassword}
                onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setMode('login');
            setStep(1);
          }}
          className="w-full text-sm text-gray-600 hover:text-gray-800"
        >
          Back to login
        </button>
      </form>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <Heart className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              {mode === 'login' 
                ? 'Sign in to access your patient portal'
                : mode === 'register'
                ? 'Join us for better dental care'
                : 'Recover your account access'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center"
            >
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-sm text-red-600">{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center"
            >
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm text-green-600">{success}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'login' && renderLogin()}
            {mode === 'register' && renderRegister()}
            {mode === 'reset' && renderPasswordReset()}
          </AnimatePresence>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              Protected by industry-standard encryption and HIPAA compliance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientAuth;