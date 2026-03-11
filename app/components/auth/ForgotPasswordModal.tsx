import React, { useState } from 'react';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { message?: string; success?: boolean };

      if (!res.ok) {
        throw new Error(data?.message || `Request failed (${res.status})`);
      }

      setSuccess(true);
      setEmail('');
    } catch (e: any) {
      setError(e?.message || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog
        showCloseButton={true}
        onClose={handleClose}
        className="w-full max-w-[400px] bg-[#1a1a1a] border-[#2a2a2a] !rounded-xl !p-0 overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col items-center text-center w-full px-8 py-10">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <img src="/icons/CodeNexus-logo.png" alt="CodeNexus Logo" className="w-16 h-16 object-contain" />
            <span className="font-bold text-2xl text-white">CodeNexus</span>
          </div>

          <h2 className="text-[26px] font-bold text-white mb-2 tracking-tight">Forgot Password?</h2>
          <p className="text-[13px] text-gray-400 mb-8 font-medium">Enter your email and we'll send you a reset link</p>

          {success ? (
            <div className="w-full">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                <p className="text-green-400 text-sm">
                  ✓ If the email exists, a password reset link has been sent. Please check your inbox.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-colors text-orange-500 bg-[#1c140a] border border-orange-500/20 hover:bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
              >
                Close
              </button>
            </div>
          ) : (
            <form className="w-full flex flex-col gap-4 text-left" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-gray-300 tracking-wide">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                  autoFocus
                />
              </div>

              <button
                type="button"
                disabled={!email.trim() || isSubmitting}
                onClick={handleSubmit}
                className="w-full py-3 mt-4 rounded-lg font-semibold text-sm transition-colors text-orange-500 bg-[#1c140a] border border-orange-500/20 hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(249,115,22,0.1)]"
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <p className="mt-4 text-[13px] text-gray-400 font-medium">
                Remember your password?
                <span
                  className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors ml-1"
                  onClick={handleClose}
                >
                  Back to login
                </span>
              </p>
            </form>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
}
