import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatDateTime } from '../../lib/api';
import { FiBell, FiCheck } from 'react-icons/fi';

export default function CustomerNotifications() {
  const { user } = useRequireAuth('customer');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const lang = user?.language || 'ru';

  const fetchNotifications = async () => {
    const { data } = await api.get('/notifications');
    if (data.success) setNotifications(data.notifications);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Уведомления' : 'Notifications'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Уведомления' : 'Notifications'}</h1>
        {notifications.some(n => !n.isRead) && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-2">
            <FiCheck /> {lang === 'ru' ? 'Все прочитано' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FiBell size={48} className="mx-auto mb-4 opacity-20" />
              <p>{lang === 'ru' ? 'Нет уведомлений' : 'No notifications'}</p>
            </div>
          ) : notifications.map((n) => (
            <div key={n._id} className={`card flex gap-4 transition-colors ${!n.isRead ? 'border-primary-200 bg-primary-50' : ''}`}>
              <div className={`p-2 rounded-full h-fit ${!n.isRead ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                <FiBell size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(n.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
              </div>
              {!n.isRead && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
