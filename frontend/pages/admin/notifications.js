import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatDateTime } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiBell, FiSend } from 'react-icons/fi';

export default function AdminNotifications() {
  const { user } = useRequireAuth('admin');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ recipientType: 'all', title: '', body: '', channel: 'inApp' });
  const lang = user?.language || 'ru';

  const fetchNotifications = async () => {
    const { data } = await api.get('/notifications');
    if (data.success) setNotifications(data.notifications);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    try {
      await api.post('/notifications/broadcast', form);
      toast.success(lang === 'ru' ? 'Отправлено!' : 'Sent!');
      setForm({ recipientType: 'all', title: '', body: '', channel: 'inApp' });
    } catch { toast.error('Failed to send'); }
  };

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Уведомления' : 'Notifications'}>
      <h1 className="text-2xl font-bold mb-6">{lang === 'ru' ? 'Уведомления' : 'Notifications'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast Form */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiSend className="text-primary-600" />
            {lang === 'ru' ? 'Отправить уведомление' : 'Send Notification'}
          </h2>
          <form onSubmit={sendBroadcast} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {lang === 'ru' ? 'Получатели' : 'Recipients'}
              </label>
              <select className="input" value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value })}>
                <option value="all">{lang === 'ru' ? 'Все' : 'All'}</option>
                <option value="customer">{lang === 'ru' ? 'Клиенты' : 'Customers'}</option>
                <option value="salesRep">{lang === 'ru' ? 'Сотрудники' : 'Sales Reps'}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {lang === 'ru' ? 'Заголовок' : 'Title'}
              </label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {lang === 'ru' ? 'Текст' : 'Message'}
              </label>
              <textarea className="input h-24 resize-none" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full">
              {lang === 'ru' ? 'Отправить' : 'Send'}
            </button>
          </form>
        </div>

        {/* Recent Notifications */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiBell className="text-primary-600" />
            {lang === 'ru' ? 'Последние уведомления' : 'Recent Notifications'}
          </h2>
          {loading ? <LoadingSpinner size="sm" /> : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n._id} className={`p-3 rounded-lg border ${n.isRead ? 'border-gray-100 bg-white' : 'border-primary-100 bg-primary-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="badge-gray text-xs">{n.recipientType}</span>
                    <span className="badge-blue text-xs">{n.channel}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
