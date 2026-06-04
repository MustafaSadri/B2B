import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrderStatusBadge from '../../components/ui/OrderStatusBadge';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDate } from '../../lib/api';
import { FiUsers, FiShoppingCart, FiDollarSign, FiTrendingUp, FiPackage, FiAlertTriangle } from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useRequireAuth('admin');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lang = user?.language || 'ru';

  const t = {
    ru: {
      title: 'Панель администратора',
      revenue: 'Выручка (месяц)',
      orders: 'Заказов',
      customers: 'Клиентов',
      salesReps: 'Сотрудников',
      pending: 'Ожидают',
      recentOrders: 'Последние заказы',
      lowStock: 'Заканчивается',
      topCustomers: 'Топ клиентов',
      repPerformance: 'Эффективность сотрудников',
    },
    en: {
      title: 'Admin Dashboard',
      revenue: 'Revenue (month)',
      orders: 'Orders',
      customers: 'Customers',
      salesReps: 'Sales Reps',
      pending: 'Pending',
      recentOrders: 'Recent Orders',
      lowStock: 'Low Stock',
      topCustomers: 'Top Customers',
      repPerformance: 'Rep Performance',
    },
  }[lang];

  useEffect(() => {
    if (!user) return;
    api.get('/admin/dashboard').then(({ data }) => {
      if (data.success) setData(data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) return <LoadingSpinner fullPage />;

  const s = data?.summary || {};

  return (
    <DashboardLayout title={t.title}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title={t.revenue} value={formatCurrency(s.thisMonthRevenue)} icon={FiDollarSign} color="green" trend={s.revenueGrowth} />
        <StatCard title={t.orders} value={s.totalOrders?.toLocaleString()} icon={FiShoppingCart} color="blue" />
        <StatCard title={t.customers} value={s.totalCustomers?.toLocaleString()} icon={FiUsers} color="purple" />
        <StatCard title={t.pending} value={s.pendingOrders?.toLocaleString()} icon={FiAlertTriangle} color="yellow" />
      </div>

      {/* Revenue Chart */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Выручка за 30 дней' : '30-Day Revenue'}</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data?.trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `₽${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Customers */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{t.topCustomers}</h2>
          <div className="space-y-3">
            {(data?.topCustomers || []).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-700">{c.customerName || c.customerUsername}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(c.totalRevenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiAlertTriangle className="text-yellow-500" />
            {t.lowStock}
          </h2>
          <div className="space-y-2">
            {(data?.lowStock || []).slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{p.name?.ru || p.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.stock} {p.unit || 'шт'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{t.recentOrders}</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{lang === 'ru' ? 'Заказ' : 'Order'}</th>
                <th>{lang === 'ru' ? 'Клиент' : 'Customer'}</th>
                <th>{lang === 'ru' ? 'Сотрудник' : 'Sales Rep'}</th>
                <th>{lang === 'ru' ? 'Сумма' : 'Amount'}</th>
                <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                <th>{lang === 'ru' ? 'Дата' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders || []).map((o) => (
                <tr key={o._id}>
                  <td className="font-mono text-xs">{o.orderNumber}</td>
                  <td>{o.customerId?.companyName || o.customerId?.name || '—'}</td>
                  <td>{o.salesRepId?.name || '—'}</td>
                  <td className="font-semibold">{formatCurrency(o.totalAmount)}</td>
                  <td><OrderStatusBadge status={o.status} lang={lang} /></td>
                  <td className="text-gray-400">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
