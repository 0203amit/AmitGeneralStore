import { useState } from 'react';
import useAuth from '../../hooks/useAuth';

/**
 * Admin login form with username and password fields.
 * Uses Service Account authentication to access the shared Google Drive/Sheets.
 */
export default function AdminLoginForm() {
  const { adminSignIn, loading, adminLoginPhase } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLocalError('Please enter both username and password');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await adminSignIn(username.trim(), password);
    } catch (err) {
      setLocalError(err.message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = loading || submitting;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
      <div>
        <label htmlFor="admin-username" className="block text-sm font-medium text-slate-700">
          Username
        </label>
        <input
          id="admin-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isDisabled}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Enter username"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isDisabled}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Enter password"
        />
      </div>

      {localError && (
        <p className="text-sm text-red-600">{localError}</p>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adminLoginPhase === 'verifying'
          ? 'Verifying credentials...'
          : adminLoginPhase === 'google-signin'
            ? 'Connecting to Google...'
            : adminLoginPhase === 'provisioning'
              ? 'Setting up storage...'
              : submitting
                ? 'Signing in...'
                : 'Sign in as Admin'}
      </button>

      {adminLoginPhase === 'google-signin' && (
        <p className="text-xs text-slate-500 text-center">
          A Google sign-in popup may appear for first-time setup.
        </p>
      )}
    </form>
  );
}
