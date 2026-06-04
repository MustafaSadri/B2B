import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrderStatusBadge from '../../components/ui/OrderStatusBadge';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDateTime } from '../../lib/api';
import toast from 'react-hot-toast';

const STATUSES = ['', 'pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const { user } = useRequireAuth('admin');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const lang = user?.language || 'ru';
  const limit = 30;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/orders', { params });
      if (data.success) { setOrders(data.orders); setTotal(data.total); }
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchOrders(); }, [user, statusFilter, page]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success('Status updated');
      fetchOrders();
    } catch { toast.error('Failed to update'); }
  };

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Заказы' : 'Orders'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'ru' ? 'Все заказы' : 'All Orders'}</h1>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : (lang === 'ru' ? 'Все статусы' : 'All Statuses')}</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-wrapper card p-0">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{lang === 'ru' ? 'Клиент' : 'Customer'}</th>
                  <th>{lang === 'ru' ? 'Сотрудник' : 'Rep'}</th>
                  <th>{lang === 'ru' ? 'Сумма' : 'Amount'}</th>
                  <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{lang === 'ru' ? 'Дата' : 'Date'}</th>
                  <th>{lang === 'ru' ? 'Действие' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-xs">{o.orderNumber}</td>
                    <td>
                      <div className="font-medium">{o.customerId?.companyName || o.customerId?.name}</div>
                      <div className="text-xs text-gray-400">@{o.customerId?.username}</div>
                    </td>
                    <td>{o.salesRepId?.name || '—'}</td>
                    <td className="font-semibold">{formatCurrency(o.totalAmount)}</td>
                    <td><OrderStatusBadge status={o.status} lang={lang} /></td>
                    <td className="text-xs text-gray-400">{formatDateTime(o.createdAt)}</td>
                    <td>
                      <select
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                        value={o.status}
                        onChange={(e) => updateStatus(o._id, e.target.value)}
                      >
                        {STATUSES.filter(Boolean).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{lang === 'ru' ? `Всего: ${total}` : `Total: ${total}`}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                {lang === 'ru' ? 'Назад' : 'Prev'}
              </button>
              <span className="py-1 px-2">Page {page} / {Math.ceil(total / limit)}</span>
              <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                {lang === 'ru' ? 'Далее' : 'Next'}
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
