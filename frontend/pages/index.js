import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    const redirects = { admin: '/admin', salesRep: '/sales-rep', customer: '/customer' };
    router.push(redirects[user.role] || '/login');
  }, [user, loading]);

  return <LoadingSpinner fullPage />;
}
