import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const useRequireAuth = (requiredRole) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      router.push('/unauthorized');
    }
  }, [user, loading, requiredRole]);

  return { user, loading };
};

export default useRequireAuth;
