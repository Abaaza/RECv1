import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientAuth from '../../components/PatientAuth';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService');

describe('PatientAuth Component', () => {
  const mockOnAuthenticated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Form', () => {
    it('renders login form by default', () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('john.doe@email.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('validates email format', async () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('requires password', async () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter your password/i)).toBeInTheDocument();
      });
    });

    it('calls login API with correct credentials', async () => {
      apiService.login.mockResolvedValue({
        token: 'test-token',
        patient: { id: 1, email: 'test@example.com' }
      });

      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
          rememberMe: false
        });
        expect(mockOnAuthenticated).toHaveBeenCalledWith({ id: 1, email: 'test@example.com' });
      });
    });

    it('handles login error', async () => {
      apiService.login.mockRejectedValue(new Error('Invalid credentials'));

      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'WrongPassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('toggles password visibility', async () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const toggleButton = passwordInput.parentElement.querySelector('button[type="button"]');

      expect(passwordInput).toHaveAttribute('type', 'password');
      
      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('handles two-factor authentication flow', async () => {
      apiService.login.mockResolvedValue({
        requiresTwoFactor: true
      });

      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument();
        expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
      });
    });
  });

  describe('Registration Form', () => {
    beforeEach(async () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      const signUpLink = screen.getByText(/sign up/i);
      await userEvent.click(signUpLink);
    });

    it('renders registration form', () => {
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter your full name/i)).toBeInTheDocument();
      });
    });

    it('validates password strength', async () => {
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const agreeCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await userEvent.type(firstNameInput, 'John');
      await userEvent.type(lastNameInput, 'Doe');
      await userEvent.type(emailInput, 'john@example.com');
      await userEvent.type(phoneInput, '5551234567');
      await userEvent.type(passwordInput, 'weak');
      await userEvent.type(confirmPasswordInput, 'weak');
      await userEvent.click(agreeCheckbox);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('validates password match', async () => {
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const agreeCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await userEvent.type(firstNameInput, 'John');
      await userEvent.type(lastNameInput, 'Doe');
      await userEvent.type(emailInput, 'john@example.com');
      await userEvent.type(phoneInput, '5551234567');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmPasswordInput, 'Password456!');
      await userEvent.click(agreeCheckbox);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('formats phone number automatically', async () => {
      const phoneInput = screen.getByLabelText(/phone number/i);
      
      await userEvent.type(phoneInput, '5551234567');
      
      expect(phoneInput.value).toBe('(555) 123-4567');
    });

    it('requires terms agreement', async () => {
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await userEvent.type(firstNameInput, 'John');
      await userEvent.type(lastNameInput, 'Doe');
      await userEvent.type(emailInput, 'john@example.com');
      await userEvent.type(phoneInput, '5551234567');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmPasswordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please agree to the terms/i)).toBeInTheDocument();
      });
    });

    it('successfully registers new user', async () => {
      apiService.register.mockResolvedValue({
        message: 'Registration successful'
      });

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const dobInput = screen.getByLabelText(/date of birth/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const agreeCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await userEvent.type(firstNameInput, 'John');
      await userEvent.type(lastNameInput, 'Doe');
      await userEvent.type(emailInput, 'john@example.com');
      await userEvent.type(phoneInput, '5551234567');
      await userEvent.type(dobInput, '1990-01-01');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmPasswordInput, 'Password123!');
      await userEvent.click(agreeCheckbox);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(apiService.register).toHaveBeenCalled();
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Reset', () => {
    beforeEach(async () => {
      render(<PatientAuth onAuthenticated={mockOnAuthenticated} />);
      const forgotLink = screen.getByText(/forgot password/i);
      await userEvent.click(forgotLink);
    });

    it('renders password reset form', () => {
      expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('john.doe@email.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
    });

    it('validates email before sending reset code', async () => {
      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const submitButton = screen.getByRole('button', { name: /send reset code/i });

      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('sends password reset request', async () => {
      apiService.requestPasswordReset.mockResolvedValue({
        message: 'Reset code sent'
      });

      const emailInput = screen.getByPlaceholderText('john.doe@email.com');
      const submitButton = screen.getByRole('button', { name: /send reset code/i });

      await userEvent.type(emailInput, 'john@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(apiService.requestPasswordReset).toHaveBeenCalledWith('john@example.com');
        expect(screen.getByText(/password reset code sent/i)).toBeInTheDocument();
      });
    });
  });
});