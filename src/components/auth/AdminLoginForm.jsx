import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth';

/**
 * Admin login form with username and password fields.
 * Uses Service Account authentication to access the shared Google Drive/Sheets.
 */
export default function AdminLoginForm() {
  const { t } = useTranslation();
  const { adminSignIn, loading, adminLoginPhase } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLocalError(t('auth.enterBothFields'));
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await adminSignIn(username.trim(), password);
    } catch (err) {
      setLocalError(err.message || t('auth.signInFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = loading || submitting;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
      <div>
        <label htmlFor="admin-username" className="block text-sm font-medium text-slate-700">
          {t('auth.username')}
        </label>
        <input
          id="admin-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isDisabled}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={t('auth.enterUsername')}
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
          {t('auth.password')}
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isDisabled}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={t('auth.enterPassword')}
        />
      </div>

      {localError && <p className="text-sm text-red-600">{localError}</p>}

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full cursor-pointer rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adminLoginPhase === 'verifying'
          ? t('auth.verifyingCredentials')
          : adminLoginPhase === 'google-signin'
            ? t('auth.connectingGoogle')
            : adminLoginPhase === 'provisioning'
              ? t('auth.settingUpStorage')
              : submitting
                ? t('auth.signingIn')
                : t('auth.signInAsAdmin')}
      </button>

      {adminLoginPhase === 'google-signin' && (
        <p className="text-xs text-slate-500 text-center">{t('auth.googleSignInPopupHint')}</p>
      )}
    </form>
  );
}
