import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { FullPageLoader } from '../components/full-page-loader';

export function PublicOnlyRoute() {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return <FullPageLoader />;
  }

  return user ? <Navigate to="/quotes" replace /> : <Outlet />;
}
