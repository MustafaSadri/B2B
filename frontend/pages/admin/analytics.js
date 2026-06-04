import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency } from '../../lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart } from 'recharts';

export default function AdminAnalytics() {
  const { user } = useRequireAuth('admin');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const lang = user?.language || 'ru';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get(`/admin/analytics?days=${days}`).then(({ data }) => {
      if (data.success) setData(data);
    }).finally(() => setLoading(false));
  }, [user, days]);

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Аналитика' : 'Analytics'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Аналитика' : 'Analytics'}</h1>
        <select className="input max-w-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>{lang === 'ru' ? '7 дней' : '7 days'}</option>
          <option value={30}>{lang === 'ru' ? '30 дней' : '30 days'}</option>
          <option value={90}>{lang === 'ru' ? '90 дней' : '90 days'}</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-6">
          {/* Revenue Trend */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Динамика выручки' : 'Revenue Trend'}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `₽${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => name === 'revenue' ? formatCurrency(v) : v} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                <Bar yAxisId="right" dataKey="orders" fill="#22c55e" opacity={0.7} name="Orders" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Топ клиентов' : 'Top Customers'}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(data?.topCustomers || []).map(c => ({ name: c.customerName?.split(' ')[0] || 'N/A', revenue: c.totalRevenue }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₽${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sales Rep Performance */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Эффективность сотрудников' : 'Rep Performance'}</h2>
              <div className="space-y-3">
                {(data?.repPerformance || []).map((r, i) => {
                  const maxRev = data.repPerformance[0]?.totalRevenue || 1;
                  const pct = (r.totalRevenue / maxRev) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{r.repName}</span>
                        <span className="text-gray-500">{formatCurrency(r.totalRevenue)}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400 mt-1">
                        <span>{r.orderCount} {lang === 'ru' ? 'заказов' : 'orders'}</span>
                        <span>{r.customerCount} {lang === 'ru' ? 'клиентов' : 'clients'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Growth Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'Итоги роста' : 'Growth Summary'}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: lang === 'ru' ? 'Этот месяц' : 'This Month', value: formatCurrency(data?.growth?.thisMonthRevenue) },
                { label: lang === 'ru' ? 'Прошлый месяц' : 'Last Month', value: formatCurrency(data?.growth?.lastMonthRevenue) },
                { label: lang === 'ru' ? 'Рост' : 'Growth', value: `${data?.growth?.revenueGrowth > 0 ? '+' : ''}${data?.growth?.revenueGrowth}%` },
                { label: lang === 'ru' ? 'Всего клиентов' : 'Total Customers', value: data?.growth?.totalCustomers },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
