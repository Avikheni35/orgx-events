import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { M2UserRole } from '../types';

interface Props { roles: M2UserRole[]; }

export default function ProtectedRoute({ roles }: Props) {
  const { isAuthenticated, isInitializing, user } = useAuthStore();
  if (isInitializing) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
