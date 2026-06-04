import { useEffect, useState } from 'react';
import Head from 'next/head';
import Navbar from './Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

const DashboardLayout = ({ children, title = 'B2B Platform' }) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications?limit=1').then(({ data }) => {
      if (data.success) setUnread(data.unread || 0);
    }).catch(() => {});
  }, [user]);

  return (
    <>
      <Head>
        <title>{title} — B2B Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar notifications={unread} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      </div>
    </>
  );
};

export default DashboardLayout;
