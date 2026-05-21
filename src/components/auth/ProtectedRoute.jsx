import { Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../shared/LoadingSpinner';

/**
 * Route guard that redirects unauthenticated users to the landing page.
 * Shows a loading spinner while auth state is being determined.
 * @param {{ children: React.ReactNode }} props
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, provisioning } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (provisioning) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-slate-500">Setting up your storage...</p>
      </div>
    );
  }

  return children;
}
