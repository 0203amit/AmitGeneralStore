import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import { buildPageTitle } from './config/branding';
import SignInButton from './components/auth/SignInButton';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navbar from './components/shared/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';
import UploadPage from './components/upload/UploadPage';
import DriveTestPage from './components/upload/DriveTestPage';
import HistoryPage from './components/history/HistoryPage';
import RecordDetail from './components/history/RecordDetail';
import DashboardPage from './components/dashboard/DashboardPage';
import SettingsPage from './components/settings/SettingsPage';

function Landing() {
  const { isAuthenticated, loading, error } = useAuth();
  document.title = buildPageTitle('landing');

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
            <ProtectedLayout><SettingsPage /></ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drive-test"
        element={
          <ProtectedRoute>
            <ProtectedLayout><DriveTestPage /></ProtectedLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
