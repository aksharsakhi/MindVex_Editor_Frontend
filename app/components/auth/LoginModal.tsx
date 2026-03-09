import React, { useState } from 'react';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';
import { GitHubButton } from './GitHubButton';
import { Eye, EyeOff } from 'lucide-react';
import { setAuth } from '~/lib/stores/authStore';

// Use the configured backend URL from environment
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    email.trim().length > 3 && password.trim().length >= 6 && (isSignUp ? fullName.trim().length > 0 : true);
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const path = isSignUp ? '/auth/register' : '/auth/login';
      const body = isSignUp ? { email, password, fullName } : { email, password };
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { token?: string; refreshToken?: string; user?: any; message?: string };

      if (!res.ok) {
        throw new Error(data?.message || `Request failed (${res.status})`);
      }

      if (data?.token && data?.user) {
        setAuth(data.token, data.user);
        onClose?.();
      } else {
        throw new Error('Invalid response: missing token or user');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog
        showCloseButton={false}
        className="w-full max-w-[400px] bg-[#1a1a1a] border-[#2a2a2a] !rounded-xl !p-0 overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col items-center text-center w-full px-8 py-10">
          <h2 className="text-[26px] font-bold text-white mb-2 tracking-tight">Welcome Back</h2>
          <p className="text-[13px] text-gray-400 mb-8 font-medium">Sign in to continue to MindVex</p>

          {/* GitHub Button Container */}
          <div className="w-full mb-8">
            <GitHubButton />
          </div>

          <div className="w-full flex items-center justify-center gap-4 mb-8">
            <div className="h-px bg-[#2a2a2a] flex-1" />
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Or continue with email</span>
            <div className="h-px bg-[#2a2a2a] flex-1" />
          </div>

          <form className="w-full flex flex-col gap-4 text-left" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-300 tracking-wide">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {isSignUp && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-gray-300 tracking-wide">Full name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                />
              </div>
            )}

            <div className="flex flex-col gap-2 relative">
              <label className="text-[11px] font-bold text-gray-300 tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600 pr-10"
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

            <button
              type="button"
              disabled={!canSubmit || isSubmitting}
              onClick={handleSubmit}
              className="w-full py-3 mt-4 rounded-lg font-semibold text-sm transition-colors text-orange-500 bg-[#1c140a] border border-orange-500/20 hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            >
              {isSignUp
                ? isSubmitting
                  ? 'Creating account...'
                  : 'Sign Up'
                : isSubmitting
                  ? 'Signing in...'
                  : 'Sign In'}
            </button>
            {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
          </form>

          <p className="mt-8 text-[13px] text-gray-400 font-medium">
            {isSignUp ? (
              <>
                Already have an account?
                <span
                  className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors ml-1"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                >
                  Sign in
                </span>
              </>
            ) : (
              <>
                Don't have an account?
                <span
                  className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors ml-1"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                >
                  Sign up
                </span>
              </>
            )}
          </p>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
