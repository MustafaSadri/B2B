import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrderStatusBadge from '../../components/ui/OrderStatusBadge';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDate } from '../../lib/api';
import { FiShoppingBag, FiCreditCard, FiGift, FiClock, FiTruck, FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';

export default function CustomerDashboard() {
  const { user } = useRequireAuth('customer');
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const lang = user?.language || 'ru';

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/orders?limit=5'),
      api.get('/loyalty/wallet'),
    ]).then(([ordRes, walRes]) => {
      if (ordRes.data.success) setOrders(ordRes.data.orders);
      if (walRes.data.success) setWallet(walRes.data);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user || loading) return <LoadingSpinner fullPage />;

  const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length;
  const dispatchedOrders = orders.filter(o => o.status === 'dispatched');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const totalSpend = orders.reduce((sum, o) => o.status !== 'cancelled' ? sum + o.totalAmount : sum, 0);

  return (
    <DashboardLayout title={lang === 'ru' ? 'Личный кабинет' : 'Dashboard'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === 'ru' ? `Добрый день, ${user.name || user.username}!` : `Hello, ${user.name || user.username}!`}
        </h1>
        {user.companyName && <p className="text-gray-500 mt-1">{user.companyName}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title={lang === 'ru' ? 'Всего заказов' : 'Total Orders'} value={orders.length} icon={FiShoppingBag} color="blue" />
        <StatCard title={lang === 'ru' ? 'В обработке' : 'In Progress'} value={pendingOrders} icon={FiClock} color="yellow" />
        <StatCard title={lang === 'ru' ? 'Потрачено' : 'Total Spent'} value={formatCurrency(totalSpend)} icon={FiCreditCard} color="green" />
        <StatCard title={lang === 'ru' ? 'Бонусы' : 'Loyalty Points'} value={`₽${wallet.balance?.toFixed(0)}`} icon={FiGift} color="purple" />
      </div>

      {/* Dispatched orders alert */}
      {dispatchedOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiTruck className="text-blue-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-blue-800">
              {lang === 'ru' ? `${dispatchedOrders.length} заказ(а) в пути!` : `${dispatchedOrders.length} order(s) on the way!`}
            </p>
            <p className="text-sm text-blue-600 mt-0.5">
              {dispatchedOrders.map(o => o.orderNumber).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Recently delivered */}
      {deliveredOrders.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-green-800">
              {lang === 'ru' ? `${deliveredOrders.length} заказ(а) доставлен` : `${deliveredOrders.length} order(s) delivered`}
            </p>
            <p className="text-sm text-green-600 mt-0.5">
              {deliveredOrders.map(o => o.orderNumber).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/customer/shop" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="p-3 bg-primary-50 rounded-xl text-primary-600"><FiShoppingBag size={24} /></div>
          <div>
            <p className="font-semibold text-gray-900">{lang === 'ru' ? 'Оформить заказ' : 'Place Order'}</p>
            <p className="text-xs text-gray-400">{lang === 'ru' ? 'Перейти в каталог' : 'Browse catalogue'}</p>
          </div>
        </Link>
        <Link href="/customer/orders" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="p-3 bg-green-50 rounded-xl text-green-600"><FiClock size={24} /></div>
          <div>
            <p className="font-semibold text-gray-900">{lang === 'ru' ? 'Мои заказы' : 'My Orders'}</p>
            <p className="text-xs text-gray-400">{lang === 'ru' ? 'История и статусы' : 'History & status'}</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{lang === 'ru' ? 'Последние заказы' : 'Recent Orders'}</h2>
          <Link href="/customer/orders" className="text-sm text-primary-600 hover:underline">
            {lang === 'ru' ? 'Все заказы →' : 'All orders →'}
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">{lang === 'ru' ? 'Заказов пока нет' : 'No orders yet'}</p>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map((o) => (
              <div key={o._id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">{formatDate(o.createdAt)} · {o.items?.length || 0} {lang === 'ru' ? 'позиций' : 'items'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{formatCurrency(o.totalAmount)}</span>
                  <OrderStatusBadge status={o.status} lang={lang} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
