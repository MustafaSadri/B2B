import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDateTime } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiExternalLink, FiTruck, FiX, FiCheck } from 'react-icons/fi';

const STATUSES = ['', 'pending', 'confirmed', 'processing', 'readyToDispatch', 'dispatched', 'delivered', 'cancelled'];

const STATUS_LABELS = {
  ru: { pending: 'Ожидает', confirmed: 'Принят', processing: 'Подготовка', readyToDispatch: 'Готов к отгрузке', dispatched: 'Отгружен', delivered: 'Доставлен', cancelled: 'Отменён' },
  en: { pending: 'Pending', confirmed: 'Accepted', processing: 'Preparing', readyToDispatch: 'Ready to Dispatch', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' },
};

const STATUS_COLORS = {
  pending: 'badge-yellow', confirmed: 'badge-blue', processing: 'badge-blue',
  readyToDispatch: 'badge-yellow', dispatched: 'badge-green', delivered: 'badge-green', cancelled: 'badge-red',
};

export default function SalesRepOrders() {
  const { user } = useRequireAuth('salesRep');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Tracking modal
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);

  const lang = user?.language || 'ru';
  const limit = 20;

  const fetchOrders = async () => {
    setLoading(true);
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    const { data } = await api.get('/orders', { params });
    if (data.success) { setOrders(data.orders); setTotal(data.total); }
    setLoading(false);
  };

  useEffect(() => { if (user) fetchOrders(); }, [user, statusFilter, page]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success(lang === 'ru' ? 'Статус обновлён' : 'Status updated');
      fetchOrders();
    } catch { toast.error(lang === 'ru' ? 'Ошибка' : 'Failed'); }
  };

  const acceptOrder = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'confirmed' });
      toast.success(lang === 'ru' ? 'Заказ принят и отправлен в МойСклад' : 'Order accepted and pushed to MoySklad');
      fetchOrders();
    } catch { toast.error(lang === 'ru' ? 'Ошибка' : 'Failed'); }
  };

  const openTracking = (order) => {
    setTrackingOrder(order);
    setTrackingUrl(order.trackingUrl || '');
    setTrackingNumber(order.trackingNumber || '');
  };

  const saveTracking = async () => {
    setSavingTracking(true);
    try {
      await api.patch(`/orders/${trackingOrder._id}/tracking`, { trackingUrl, trackingNumber });
      toast.success(lang === 'ru' ? 'Трекинг сохранён' : 'Tracking saved');
      setTrackingOrder(null);
      fetchOrders();
    } catch { toast.error('Failed'); }
    finally { setSavingTracking(false); }
  };

  if (!user) return <LoadingSpinner fullPage />;

  const labels = STATUS_LABELS[lang];

  return (
    <DashboardLayout title={lang === 'ru' ? 'Заказы' : 'Orders'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Заказы клиентов' : 'Customer Orders'} ({total})</h1>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? labels[s] || s : (lang === 'ru' ? 'Все статусы' : 'All Statuses')}</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-wrapper card p-0">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>{lang === 'ru' ? 'Клиент' : 'Customer'}</th>
                <th>{lang === 'ru' ? 'Сумма' : 'Amount'}</th>
                <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                <th>{lang === 'ru' ? 'Дата' : 'Date'}</th>
                <th>{lang === 'ru' ? 'Трекинг' : 'Tracking'}</th>
                <th>{lang === 'ru' ? 'Действие' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  {lang === 'ru' ? 'Заказов нет' : 'No orders'}
                </td></tr>
              )}
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="font-mono text-xs">{o.orderNumber}</td>
                  <td>
                    <div className="font-medium">{o.customerId?.companyName || o.customerId?.name}</div>
                    <div className="text-xs text-gray-400">@{o.customerId?.username}</div>
                  </td>
                  <td className="font-semibold">{formatCurrency(o.totalAmount)}</td>
                  <td>
                    <div>
                      <span className={`badge ${STATUS_COLORS[o.status] || 'badge-gray'}`}>
                        {labels[o.status] || o.status}
                      </span>
                      {o.moyskladStateName && (
                        <p className="text-xs text-blue-400 mt-0.5">{o.moyskladStateName}</p>
                      )}
                    </div>
                  </td>
                  <td className="text-xs text-gray-400">{formatDateTime(o.createdAt)}</td>

                  {/* Tracking cell */}
                  <td>
                    {o.status === 'dispatched' || o.status === 'delivered' ? (
                      <div className="flex items-center gap-1.5">
                        {o.trackingUrl ? (
                          <a href={o.trackingUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            <FiExternalLink size={12} />
                            {o.trackingNumber || (lang === 'ru' ? 'Трекинг' : 'Track')}
                          </a>
                        ) : o.trackingNumber ? (
                          <span className="font-mono text-xs text-gray-600">{o.trackingNumber}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                        {o.status === 'dispatched' && (
                          <button onClick={() => openTracking(o)}
                            className="text-xs text-gray-400 hover:text-primary-500 underline ml-1">
                            {o.trackingUrl || o.trackingNumber
                              ? (lang === 'ru' ? 'Изменить' : 'Edit')
                              : (lang === 'ru' ? '+ Добавить' : '+ Add')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-200">—</span>
                    )}
                  </td>

                  {/* Action cell */}
                  <td>
                    {o.status === 'pending' ? (
                      <button onClick={() => acceptOrder(o._id)} className="btn-primary text-xs py-1 px-3">
                        {lang === 'ru' ? '✓ Принять' : '✓ Accept'}
                      </button>
                    ) : o.status === 'dispatched' ? (
                      <button onClick={() => updateStatus(o._id, 'delivered')}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded-lg transition-colors flex items-center gap-1">
                        <FiCheck size={11} /> {lang === 'ru' ? 'Доставлен' : 'Delivered'}
                      </button>
                    ) : o.status === 'delivered' || o.status === 'cancelled' ? (
                      <span className="text-xs text-gray-400 italic">—</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        {lang === 'ru' ? 'Ожидание МойСклад' : 'Awaiting MoySklad'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
        <span>{total} {lang === 'ru' ? 'заказов' : 'orders'}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">←</button>
          <span className="py-1 px-2">{page} / {Math.max(1, Math.ceil(total / limit))}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">→</button>
        </div>
      </div>

      {/* Tracking modal */}
      {trackingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FiTruck className="text-primary-600" size={18} />
                <h2 className="font-bold text-gray-900">
                  {lang === 'ru' ? 'Данные отслеживания' : 'Tracking Info'}
                </h2>
              </div>
              <button onClick={() => setTrackingOrder(null)}><FiX className="text-gray-400" /></button>
            </div>

            <p className="text-xs text-gray-400 mb-4">{trackingOrder.orderNumber} — {trackingOrder.customerId?.companyName || trackingOrder.customerId?.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  {lang === 'ru' ? 'Номер отслеживания' : 'Tracking Number'}
                </label>
                <input
                  className="input text-sm"
                  placeholder="RU123456789"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  {lang === 'ru' ? 'Ссылка для отслеживания' : 'Tracking URL'}
                </label>
                <input
                  className="input text-sm"
                  placeholder="https://track.example.com/..."
                  value={trackingUrl}
                  onChange={e => setTrackingUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'ru' ? 'Клиент увидит эту ссылку как кнопку "Отследить"' : 'Customer will see this as a "Track" button'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={saveTracking} disabled={savingTracking} className="btn-primary flex-1">
                {savingTracking ? '…' : (lang === 'ru' ? 'Сохранить' : 'Save')}
              </button>
              <button onClick={() => setTrackingOrder(null)} className="btn-secondary flex-1">
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
