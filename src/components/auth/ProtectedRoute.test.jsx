import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import ProtectedRoute from './ProtectedRoute';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  default: vi.fn(),
}));

import useAuth from '../../hooks/useAuth';

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true, provisioning: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to / when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false, provisioning: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows provisioning spinner when provisioning', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false, provisioning: true });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders children when authenticated and not provisioning', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false, provisioning: false });
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
