import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatDate } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiSearch } from 'react-icons/fi';

export default function AdminCustomers() {
  const { user } = useRequireAuth('admin');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const lang = user?.language || 'ru';
  const limit = 20;

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      const { data } = await api.get('/customers', { params });
      if (data.success) { setCustomers(data.customers); setTotal(data.total); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchCustomers(); }, [user, page]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchCustomers(); }, 400); return () => clearTimeout(t); }, [search]);

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Клиенты' : 'Customers'}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Все клиенты' : 'All Customers'}</h1>
        <div className="relative max-w-xs w-full">
          <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input pl-9" placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-wrapper card p-0">
          <table>
            <thead>
              <tr>
                <th>{lang === 'ru' ? 'Клиент' : 'Customer'}</th>
                <th>{lang === 'ru' ? 'Компания' : 'Company'}</th>
                <th>{lang === 'ru' ? 'Сотрудник' : 'Sales Rep'}</th>
                <th>{lang === 'ru' ? 'Прайс-лист' : 'Price List'}</th>
                <th>{lang === 'ru' ? 'Телефон' : 'Phone'}</th>
                <th>{lang === 'ru' ? 'Дата' : 'Date'}</th>
                <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-400">@{c.username}</div>
                  </td>
                  <td>{c.companyName || '—'}</td>
                  <td>{c.salesRepId?.name || '—'}</td>
                  <td>{c.priceListId?.name || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td className="text-xs text-gray-400">{formatDate(c.createdAt)}</td>
                  <td>
                    <span className={c.isActive ? 'badge-green' : 'badge-red'}>
                      {c.isActive ? (lang === 'ru' ? 'Активен' : 'Active') : (lang === 'ru' ? 'Неактивен' : 'Inactive')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
        <span>{total} {lang === 'ru' ? 'клиентов' : 'customers'}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">←</button>
          <span className="py-1 px-2">{page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">→</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
