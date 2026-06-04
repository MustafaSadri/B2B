import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiPlus, FiX } from 'react-icons/fi';

export default function AdminSalesReps() {
  const { user } = useRequireAuth('admin');
  const [reps, setReps] = useState([]);
  const [msEmployees, setMsEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', phone: '', moyskladEmployeeId: '' });
  const lang = user?.language || 'ru';

  const fetchReps = async () => {
    setLoading(true);
    const { data } = await api.get('/salesreps');
    if (data.success) setReps(data.salesReps);
    setLoading(false);
  };

  const fetchMsEmployees = async () => {
    try {
      const { data } = await api.get('/salesreps/ms-employees');
      if (data.success) setMsEmployees(data.employees);
    } catch {
      toast.error('Could not load MoySklad employees');
    }
  };

  useEffect(() => { if (user) { fetchReps(); fetchMsEmployees(); } }, [user]);

  const openForm = () => {
    setForm({ username: '', password: '', name: '', email: '', phone: '', moyskladEmployeeId: '' });
    setShowForm(true);
  };

  const createRep = async (e) => {
    e.preventDefault();
    if (!form.moyskladEmployeeId) {
      toast.error(lang === 'ru' ? 'Выберите сотрудника МойСклад' : 'Select a MoySklad employee');
      return;
    }
    try {
      await api.post('/salesreps', form);
      toast.success(lang === 'ru' ? 'Сотрудник создан' : 'Sales rep created');
      setShowForm(false);
      fetchReps();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const toggleActive = async (id, isActive) => {
    await api.patch(`/salesreps/${id}`, { isActive: !isActive });
    toast.success('Updated');
    fetchReps();
  };

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Сотрудники' : 'Sales Reps'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Сотрудники' : 'Sales Representatives'}</h1>
        <button onClick={openForm} className="btn-primary flex items-center gap-2">
          <FiPlus /> {lang === 'ru' ? 'Добавить' : 'Add'}
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{lang === 'ru' ? 'Новый сотрудник' : 'New Sales Rep'}</h2>
              <button onClick={() => setShowForm(false)}><FiX className="text-gray-400" /></button>
            </div>
            <form onSubmit={createRep} className="space-y-3">
              {[
                { key: 'name', label: lang === 'ru' ? 'Имя' : 'Name', required: true },
                { key: 'username', label: lang === 'ru' ? 'Логин' : 'Username', required: true },
                { key: 'password', label: lang === 'ru' ? 'Пароль' : 'Password', required: true, type: 'password' },
                { key: 'email', label: 'Email', required: false },
                { key: 'phone', label: lang === 'ru' ? 'Телефон' : 'Phone', required: false },
              ].map(({ key, label, required, type }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                  <input
                    className="input"
                    type={type || 'text'}
                    required={required}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}

              {/* MoySklad Employee — required */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {lang === 'ru' ? 'Сотрудник МойСклад' : 'MoySklad Employee'} <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={form.moyskladEmployeeId}
                  onChange={(e) => setForm({ ...form, moyskladEmployeeId: e.target.value })}
                  required
                >
                  <option value="">{lang === 'ru' ? '— Выберите сотрудника —' : '— Select employee —'}</option>
                  {msEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                {msEmployees.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    {lang === 'ru' ? 'Нет данных из МойСклад' : 'No MoySklad employees found'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{lang === 'ru' ? 'Создать' : 'Create'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">{lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reps.map((rep) => {
            const linkedEmp = msEmployees.find((e) => e.id === rep.moyskladEmployeeId);
            return (
              <div key={rep._id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{rep.name}</h3>
                    <p className="text-sm text-gray-400">@{rep.username}</p>
                    {linkedEmp ? (
                      <p className="text-xs text-blue-500 mt-0.5">
                        {lang === 'ru' ? 'МойСклад: ' : 'MoySklad: '}{linkedEmp.name}
                      </p>
                    ) : (
                      <p className="text-xs text-red-400 mt-0.5">
                        {lang === 'ru' ? 'Не привязан к МойСклад' : 'Not linked to MoySklad'}
                      </p>
                    )}
                  </div>
                  <span className={rep.isActive ? 'badge-green' : 'badge-red'}>
                    {rep.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center border-t border-gray-50 pt-3 mt-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{rep.customerCount || 0}</p>
                    <p className="text-xs text-gray-400">{lang === 'ru' ? 'Клиентов' : 'Customers'}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{rep.orderCount || 0}</p>
                    <p className="text-xs text-gray-400">{lang === 'ru' ? 'Заказов' : 'Orders'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(rep.totalRevenue)}</p>
                    <p className="text-xs text-gray-400">{lang === 'ru' ? 'Выручка' : 'Revenue'}</p>
                  </div>
                </div>
                <button onClick={() => toggleActive(rep._id, rep.isActive)} className="btn-secondary w-full mt-3 text-xs">
                  {rep.isActive ? (lang === 'ru' ? 'Деактивировать' : 'Deactivate') : (lang === 'ru' ? 'Активировать' : 'Activate')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
