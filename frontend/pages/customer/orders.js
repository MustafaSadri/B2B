import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDateTime } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiEye, FiX, FiCheckCircle, FiTruck, FiPackage, FiClock, FiExternalLink } from 'react-icons/fi';

const STEPS = [
  { key: 'confirmed',       labelRu: 'Принят',            labelEn: 'Accepted',          icon: FiCheckCircle },
  { key: 'processing',      labelRu: 'Подготовка',        labelEn: 'Preparing',         icon: FiPackage },
  { key: 'readyToDispatch', labelRu: 'Готов к отгрузке',  labelEn: 'Ready to Dispatch', icon: FiPackage },
  { key: 'dispatched',      labelRu: 'Отгружен',          labelEn: 'Dispatched',        icon: FiTruck },
  { key: 'delivered',       labelRu: 'Доставлен',         labelEn: 'Delivered',         icon: FiCheckCircle },
];

const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'readyToDispatch', 'dispatched', 'delivered', 'cancelled'];

function OrderStepper({ order, lang }) {
  if (order.status === 'pending' || order.status === 'cancelled') return null;

  const currentIdx = STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="mt-4 mb-2">
      {/* MoySklad state label */}
      {order.moyskladStateName && (
        <p className="text-xs text-blue-500 font-medium mb-3">
          {lang === 'ru' ? 'Статус в МойСклад: ' : 'MoySklad status: '}
          <span className="font-semibold">{order.moyskladStateName}</span>
        </p>
      )}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-300'
                } ${active ? 'ring-2 ring-primary-300' : ''}`}>
                  <Icon size={15} />
                </div>
                <span className={`text-xs text-center leading-tight max-w-[56px] ${done ? 'text-primary-700 font-medium' : 'text-gray-400'}`}>
                  {lang === 'ru' ? step.labelRu : step.labelEn}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < currentIdx ? 'bg-primary-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerOrders() {
  const { user } = useRequireAuth('customer');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const lang = user?.language || 'ru';
  const limit = 20;

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await api.get(`/orders?page=${page}&limit=${limit}`);
    if (data.success) { setOrders(data.orders); setTotal(data.total); }
    setLoading(false);
  };

  const syncFromMoysklad = async () => {
    try {
      await api.post('/orders/sync-moysklad');
      await fetchOrders();
    } catch {
      // silent — sync failure should not block the UI
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchOrders().then(() => syncFromMoysklad());
  }, [user, page]);

  const requestCancel = async (orderId) => {
    const reason = prompt(lang === 'ru' ? 'Причина отмены:' : 'Cancellation reason:');
    if (!reason) return;
    try {
      await api.post(`/orders/${orderId}/cancel-request`, { reason });
      toast.success(lang === 'ru' ? 'Запрос отправлен' : 'Request sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const statusLabel = (o) => {
    if (o.status === 'pending')          return { ru: 'Ожидает подтверждения',  en: 'Awaiting acceptance',    color: 'badge-yellow' };
    if (o.status === 'confirmed')        return { ru: 'Принят',                 en: 'Accepted',               color: 'badge-blue' };
    if (o.status === 'processing')       return { ru: 'Подготовка',             en: 'Preparing',              color: 'badge-blue' };
    if (o.status === 'readyToDispatch')  return { ru: 'Готов к отгрузке',       en: 'Ready to Dispatch',      color: 'badge-yellow' };
    if (o.status === 'dispatched')       return { ru: 'Отгружен — в пути',      en: 'Dispatched — on the way', color: 'badge-green' };
    if (o.status === 'delivered')        return { ru: 'Доставлен',              en: 'Delivered',              color: 'badge-green' };
    if (o.status === 'cancelled')        return { ru: 'Отменён',                en: 'Cancelled',              color: 'badge-red' };
    return { ru: o.status, en: o.status, color: 'badge-gray' };
  };

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Мои заказы' : 'My Orders'}>
      <h1 className="text-2xl font-bold mb-6">{lang === 'ru' ? 'Мои заказы' : 'My Orders'} ({total})</h1>

      {/* Order Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold">{selected.orderNumber}</h2>
                <p className="text-sm text-gray-400">{formatDateTime(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)}><FiX className="text-gray-400" size={22} /></button>
            </div>
            <div className="p-6">
              {/* Status stepper */}
              <OrderStepper order={selected} lang={lang} />

              {selected.status === 'pending' && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <FiClock className="text-yellow-500" size={18} />
                  <p className="text-sm text-yellow-800 font-medium">
                    {lang === 'ru' ? 'Ожидает подтверждения менеджера' : 'Waiting for manager acceptance'}
                  </p>
                </div>
              )}

              {/* Tracking info */}
              {selected.status === 'dispatched' && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <FiTruck className="text-blue-600" size={18} />
                    <p className="text-sm font-bold text-blue-800">
                      {lang === 'ru' ? 'Заказ отправлен' : 'Order dispatched'}
                    </p>
                  </div>
                  {selected.trackingUrl ? (
                    <a href={selected.trackingUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors mt-1">
                      <FiExternalLink size={14} />
                      {lang === 'ru' ? 'Отследить посылку' : 'Track your order'}
                      {selected.trackingNumber && <span className="opacity-70 text-xs">({selected.trackingNumber})</span>}
                    </a>
                  ) : selected.trackingNumber ? (
                    <p className="text-sm text-blue-700 mt-1">
                      {lang === 'ru' ? 'Трек-номер:' : 'Tracking number:'} <span className="font-mono font-bold">{selected.trackingNumber}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-blue-500 mt-1">
                      {lang === 'ru' ? 'Данные отслеживания будут добавлены менеджером' : 'Tracking info will be added by your manager'}
                    </p>
                  )}
                </div>
              )}

              {(selected.shippingAddress || selected.notes) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4 text-sm mt-4">
                  {selected.shippingAddress && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">{lang === 'ru' ? 'Адрес доставки' : 'Delivery address'}</p>
                      <p className="text-gray-700 whitespace-pre-line">{selected.shippingAddress}</p>
                    </div>
                  )}
                  {selected.notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">{lang === 'ru' ? 'Особые пожелания' : 'Special instructions'}</p>
                      <p className="text-gray-700 whitespace-pre-line">{selected.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <h3 className="font-semibold text-gray-700 mb-3">{lang === 'ru' ? 'Состав заказа' : 'Order Items'}</h3>
              <div className="space-y-2 mb-4">
                {(selected.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(item.totalPrice)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {selected.discountAmount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{lang === 'ru' ? 'Скидка' : 'Discount'}</span><span className="text-green-600">-{formatCurrency(selected.discountAmount)}</span></div>
                )}
                {selected.loyaltyCreditsUsed > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{lang === 'ru' ? 'Бонусы' : 'Credits'}</span><span className="text-purple-600">-{formatCurrency(selected.loyaltyCreditsUsed)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span>{lang === 'ru' ? 'Итого' : 'Total'}</span>
                  <span className="text-primary-600">{formatCurrency(selected.totalAmount)}</span>
                </div>
              </div>
              {['pending', 'confirmed'].includes(selected.status) && (
                <button onClick={() => requestCancel(selected._id)} className="btn-danger w-full mt-4 text-sm">
                  {lang === 'ru' ? 'Запросить отмену' : 'Request Cancellation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FiX size={48} className="mx-auto mb-4 opacity-20" />
              <p>{lang === 'ru' ? 'Заказов пока нет' : 'No orders yet'}</p>
            </div>
          )}
          {orders.map((o) => {
            const sl = statusLabel(o);
            return (
              <div key={o._id} className="card hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-mono text-sm font-bold text-gray-800">{o.orderNumber}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(o.createdAt)}</p>
                      <p className="text-xs text-gray-400">{o.items?.length || 0} {lang === 'ru' ? 'позиций' : 'items'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
                      <span className={`badge ${sl.color} text-xs`}>{sl[lang]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.status === 'dispatched' && o.trackingUrl && (
                        <a href={o.trackingUrl} target="_blank" rel="noreferrer"
                          className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
                          <FiExternalLink size={12} /> {lang === 'ru' ? 'Трекинг' : 'Track'}
                        </a>
                      )}
                      <button onClick={() => setSelected(o)} className="btn-secondary text-xs flex items-center gap-1">
                        <FiEye size={14} /> {lang === 'ru' ? 'Детали' : 'Details'}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Inline stepper on card for confirmed+ orders */}
                {!['pending', 'cancelled'].includes(o.status) && (
                  <OrderStepper order={o} lang={lang} />
                )}
              </div>
            );
          })}
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
    </DashboardLayout>
  );
}
