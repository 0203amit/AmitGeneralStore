import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Upload,
  History,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import LanguageSelector from './LanguageSelector';
import { BUSINESS_NAME } from '../../config/branding';

const NAV_LINKS = [
  { to: '/dashboard', labelKey: 'navbar.dashboard', icon: LayoutDashboard },
  { to: '/upload', labelKey: 'navbar.upload', icon: Upload },
  { to: '/history', labelKey: 'navbar.history', icon: History },
  { to: '/settings', labelKey: 'navbar.settings', icon: Settings },
];

/**
 * Top navigation bar with store wordmark, nav links, user avatar,
 * and sign-out dropdown. Collapses into a hamburger menu on mobile.
 */
export default function Navbar() {
  const { user, signOut, isAdmin } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const profileRef = useRef(null);

  async function handleSignOut() {
    setShowSignOutConfirm(false);
    setProfileOpen(false);
    setMenuOpen(false);
    try {
      await signOut();
      addToast({ type: 'success', message: t('auth.signedOutSuccess') });
    } catch {
      addToast({ type: 'error', message: t('auth.signOutFailed') });
    }
  }

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Wordmark */}
        <div className="flex flex-col">
          <span className="font-heading text-lg font-bold leading-tight text-brand-primary">
            {BUSINESS_NAME}
          </span>
          <span className="text-xs text-slate-500">{t('branding.tagline')}</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.filter(({ to }) => !isAdmin || to !== '/settings').map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-brand-primary/10 text-brand-primary'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </div>

        {/* Language selector + User avatar (desktop) */}
        <div className="hidden items-center gap-3 md:flex" ref={profileRef}>
          <LanguageSelector />
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex cursor-pointer items-center gap-2 rounded-full p-1 transition-colors duration-200 hover:bg-slate-100"
            aria-label="User menu"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-medium text-white">
                {(user?.name || '?')[0].toUpperCase()}
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-4 top-14 z-40 min-w-[200px] animate-fadeIn rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
              <div className="border-b border-slate-100 px-4 pb-2">
                <p className="text-sm font-medium text-slate-900">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setShowSignOutConfirm(true);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                {t('common.signOut')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="cursor-pointer rounded-md p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-slideDown border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.filter(({ to }) => !isAdmin || to !== '/settings').map(({ to, labelKey, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </NavLink>
            ))}
          </div>

          {/* Language selector (mobile) */}
          <div className="mt-3 flex justify-center border-t border-slate-200 pt-3">
            <LanguageSelector />
          </div>

          {/* Mobile user info + sign-out */}
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-3 px-3 pb-2">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-medium text-white">
                  {(user?.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                setShowSignOutConfirm(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {t('common.signOut')}
            </button>
          </div>
        </div>
      )}
      {showSignOutConfirm && (
        <ConfirmDialog
          title={t('auth.signOutConfirmTitle')}
          message={t('auth.signOutConfirmMessage')}
          confirmLabel={t('common.signOut')}
          confirmClassName="bg-red-600 text-white hover:bg-red-700"
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
    </nav>
  );
}
