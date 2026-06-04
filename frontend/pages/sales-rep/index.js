import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrderStatusBadge from '../../components/ui/OrderStatusBadge';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDate } from '../../lib/api';
import { FiUsers, FiShoppingCart, FiDollarSign, FiTrendingUp, FiClock, FiTruck } from 'react-icons/fi';
import Link from 'next/link';

export default function SalesRepDashboard() {
  const { user } = useRequireAuth('salesRep');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lang = user?.language || 'ru';

  useEffect(() => {
    if (!user) return;
    api.get(`/salesreps/${user.id}/dashboard`).then(({ data }) => {
      if (data.success) setData(data);
    }).finally(() => setLoading(false));
  }, [user]);

  const markDelivered = async (orderId) => {
    await api.patch(`/orders/${orderId}/status`, { status: 'delivered' });
    const { data: fresh } = await api.get(`/salesreps/${user.id}/dashboard`);
    if (fresh.success) setData(fresh);
  };

  if (!user || loading) return <LoadingSpinner fullPage />;

  const s = data?.stats || {};
  const pendingOrders = data?.pendingOrders || [];
  const dispatchedOrders = data?.dispatchedOrders || [];

  return (
    <DashboardLayout title={lang === 'ru' ? 'Панель управления' : 'Dashboard'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === 'ru' ? `Добро пожаловать, ${user.name || user.username}!` : `Welcome, ${user.name || user.username}!`}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{lang === 'ru' ? 'Ваша панель продаж' : 'Your sales dashboard'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title={lang === 'ru' ? 'Выручка (месяц)' : 'Revenue (month)'} value={formatCurrency(s.thisMonthRevenue)} icon={FiDollarSign} color="green" trend={s.revenueGrowth} />
        <StatCard title={lang === 'ru' ? 'Заказов (месяц)' : 'Orders (month)'} value={s.thisMonthOrders} icon={FiShoppingCart} color="blue" />
        <StatCard title={lang === 'ru' ? 'Клиентов' : 'Customers'} value={s.customers} icon={FiUsers} color="purple" />
        <StatCard title={lang === 'ru' ? 'Всего заказов' : 'Total Orders'} value={s.totalOrders} icon={FiTrendingUp} color="yellow" />
      </div>

      {/* Dispatched — awaiting delivery confirmation */}
      {dispatchedOrders.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FiTruck className="text-green-600" size={20} />
            <h2 className="font-bold text-green-800">
              {lang === 'ru'
                ? `${dispatchedOrders.length} заказ(а) отгружен — подтвердите получение`
                : `${dispatchedOrders.length} order(s) dispatched — confirm delivery`}
            </h2>
          </div>
          <div className="space-y-2">
            {dispatchedOrders.map((o) => (
              <div key={o._id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-green-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">{o.customerId?.companyName || o.customerId?.name}</p>
                </div>
                <button
                  onClick={() => markDelivered(o._id)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 px-4 rounded-lg transition-colors"
                >
                  {lang === 'ru' ? '✓ Доставлен' : '✓ Mark Delivered'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending orders — need acceptance */}
      {pendingOrders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FiClock className="text-yellow-600" size={20} />
            <h2 className="font-bold text-yellow-800">
              {lang === 'ru'
                ? `${pendingOrders.length} новых заказ(а) ожидают подтверждения`
                : `${pendingOrders.length} new order(s) awaiting your acceptance`}
            </h2>
          </div>
          <Link href="/sales-rep/orders" className="text-sm text-yellow-700 font-medium underline">
            {lang === 'ru' ? 'Перейти к заказам →' : 'Go to orders →'}
          </Link>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Последние заказы' : 'Recent Orders'}</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>{lang === 'ru' ? 'Клиент' : 'Customer'}</th>
                <th>{lang === 'ru' ? 'Сумма' : 'Amount'}</th>
                <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                <th>{lang === 'ru' ? 'Дата' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders || []).map((o) => (
                <tr key={o._id}>
                  <td className="font-mono text-xs">{o.orderNumber}</td>
                  <td>{o.customerId?.companyName || o.customerId?.name}</td>
                  <td className="font-semibold">{formatCurrency(o.totalAmount)}</td>
                  <td><OrderStatusBadge status={o.status} lang={lang} /></td>
                  <td className="text-gray-400 text-xs">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
