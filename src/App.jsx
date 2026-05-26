import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuth from './hooks/useAuth';
import { buildPageTitle, APP_TITLE_SUFFIX } from './config/branding';
import SignInButton from './components/auth/SignInButton';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navbar from './components/shared/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';

const UploadPage = lazy(() => import('./components/upload/UploadPage'));
const HistoryPage = lazy(() => import('./components/history/HistoryPage'));
const RecordDetail = lazy(() => import('./components/history/RecordDetail'));
const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));

function Landing() {
  const { isAuthenticated, loading, error } = useAuth();
  document.title = buildPageTitle(APP_TITLE_SUFFIX);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <SignInButton />
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

/** Redirects admin users away from pages they shouldn't access. */
function AdminGuard({ children }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Layout wrapper that adds Navbar above page content. */
function ProtectedLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedLayout><DashboardPage /></ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <ProtectedLayout><UploadPage /></ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <ProtectedLayout><HistoryPage /></ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:recordId"
          element={
            <ProtectedRoute>
              <ProtectedLayout><RecordDetail /></ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AdminGuard>
                <ProtectedLayout><SettingsPage /></ProtectedLayout>
              </AdminGuard>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
