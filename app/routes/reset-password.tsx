import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams, useNavigate } from '@remix-run/react';
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api';

export const meta: MetaFunction = () => {
  return [{ title: 'CodeNexus - Reset Password' }, { name: 'description', content: 'Reset your password' }];
};

export const loader = () => json({});

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No reset token provided');
      setValidatingToken(false);
      return;
    }

    // Verify token validity
    verifyToken(token);
  }, [token]);

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
      const data = (await res.json()) as { success?: boolean; message?: string };

      if (res.ok && data.success) {
        setTokenValid(true);
      } else {
        setError(data.message || 'Invalid or expired reset token');
        setTokenValid(false);
      }
    } catch (e: any) {
      setError('Failed to verify reset token');
      setTokenValid(false);
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword || isSubmitting) {
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = (await res.json()) as { message?: string; success?: boolean };

      if (!res.ok) {
        throw new Error(data?.message || `Request failed (${res.status})`);
      }

      setSuccess(true);

      // Redirect to home with login prompt after 2 seconds
      setTimeout(() => {
        navigate('/?showLogin=true');
      }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <img src="/icons/CodeNexus-logo.png" alt="CodeNexus Logo" className="w-16 h-16 object-contain" />
            <span className="font-bold text-2xl text-white">CodeNexus</span>
          </div>

          <h1 className="text-[26px] font-bold text-white mb-2 tracking-tight">Reset Your Password</h1>
          <p className="text-[13px] text-gray-400 font-medium">Enter your new password below</p>
        </div>

        {validatingToken ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-400 text-sm mt-4">Verifying reset token...</p>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error || 'Invalid or expired reset token'}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-colors text-orange-500 bg-[#1c140a] border border-orange-500/20 hover:bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            >
              Back to Home
            </button>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm font-medium">✓ Password reset successfully!</p>
              <p className="text-green-300 text-xs mt-2">Redirecting to login page in 2 seconds...</p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-300 tracking-wide">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-300 tracking-wide">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!newPassword || !confirmPassword || isSubmitting}
              onClick={handleSubmit}
              className="w-full py-3 mt-4 rounded-lg font-semibold text-sm transition-colors text-orange-500 bg-[#1c140a] border border-orange-500/20 hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            >
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <p className="mt-6 text-center text-[13px] text-gray-400 font-medium">
              Remember your password?
              <span
                className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors ml-1"
                onClick={() => navigate('/')}
              >
                Back to login
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
