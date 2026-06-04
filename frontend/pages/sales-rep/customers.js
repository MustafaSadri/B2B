import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiX, FiEdit2, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';

const EMPTY_FORM = { username: '', password: '', name: '', email: '', phone: '', companyName: '', address: '', taxId: '', language: 'ru' };

export default function SalesRepCustomers() {
  const { user } = useRequireAuth('salesRep');
  const [customers, setCustomers] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [showCreatePass, setShowCreatePass] = useState(false);

  const [editCustomer, setEditCustomer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showEditPass, setShowEditPass] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [priceModal, setPriceModal] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const lang = user?.language || 'ru';
  const limit = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      const [custRes, plRes] = await Promise.all([
        api.get('/customers', { params }),
        api.get('/admin/pricelists').catch(() => ({ data: { priceLists: [] } })),
      ]);
      if (custRes.data.success) { setCustomers(custRes.data.customers); setTotal(custRes.data.total); }
      if (plRes.data.priceLists) setPriceLists(plRes.data.priceLists);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchData(); }, [user, page]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchData(); }, 400); return () => clearTimeout(t); }, [search]);

  // ── Create ────────────────────────────────────────────────────────────────
  const createCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', createForm);
      toast.success(lang === 'ru' ? 'Клиент создан' : 'Customer created');
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (c) => {
    setEditCustomer(c);
    setEditForm({
      name: c.name || '',
      username: c.username || '',
      email: c.email || '',
      phone: c.phone || '',
      companyName: c.companyName || '',
      address: c.address || '',
      taxId: c.taxId || '',
      language: c.language || 'ru',
      password: '',
    });
    setShowEditPass(false);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await api.patch(`/customers/${editCustomer._id}`, payload);
      toast.success(lang === 'ru' ? 'Данные сохранены' : 'Saved');
      setEditCustomer(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSavingEdit(false); }
  };

  // ── Price list ────────────────────────────────────────────────────────────
  const assignPriceList = async (customerId, priceListId) => {
    try {
      await api.patch(`/customers/${customerId}/pricelist`, { priceListId });
      toast.success(lang === 'ru' ? 'Прайс-лист назначен' : 'Price list assigned');
      setPriceModal(null);
      fetchData();
    } catch { toast.error('Failed'); }
  };

  if (!user) return <LoadingSpinner fullPage />;

  // ── Shared form fields config ─────────────────────────────────────────────
  const fields = (form, setForm, showPass, setShowPass, isEdit = false) => (
    <div className="grid grid-cols-2 gap-3">
      {/* Name */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'Имя' : 'Name'} *</label>
        <input className="input text-sm" required value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      {/* Company */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'Компания' : 'Company'}</label>
        <input className="input text-sm" value={form.companyName}
          onChange={e => setForm({ ...form, companyName: e.target.value })} />
      </div>
      {/* Username */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Username *</label>
        <input className="input text-sm" required value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })} />
      </div>
      {/* Password */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
          {lang === 'ru' ? 'Пароль' : 'Password'} {isEdit && <span className="text-gray-300 normal-case font-normal">(оставьте пустым)</span>}
          {!isEdit && ' *'}
        </label>
        <div className="relative">
          <input className="input text-sm pr-9" type={showPass ? 'text' : 'password'}
            required={!isEdit} value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPass ? <FiEyeOff size={14} /> : <FiEye size={14} />}
          </button>
        </div>
      </div>
      {/* Email */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Email</label>
        <input className="input text-sm" type="email" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })} />
      </div>
      {/* Phone */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'Телефон' : 'Phone'}</label>
        <input className="input text-sm" value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })} />
      </div>
      {/* Tax ID */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'ИНН' : 'Tax ID'}</label>
        <input className="input text-sm" value={form.taxId}
          onChange={e => setForm({ ...form, taxId: e.target.value })} />
      </div>
      {/* Language */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'Язык' : 'Language'}</label>
        <select className="input text-sm" value={form.language}
          onChange={e => setForm({ ...form, language: e.target.value })}>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
      {/* Address — full width */}
      <div className="col-span-2">
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{lang === 'ru' ? 'Адрес доставки' : 'Delivery Address'}</label>
        <input className="input text-sm" value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })} />
      </div>
    </div>
  );

  return (
    <DashboardLayout title={lang === 'ru' ? 'Клиенты' : 'Customers'}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{lang === 'ru' ? 'Мои клиенты' : 'My Customers'} ({total})</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <FiPlus /> {lang === 'ru' ? 'Добавить клиента' : 'Add Customer'}
        </button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <FiSearch className="absolute left-3 top-2.5 text-gray-400" size={15} />
        <input className="input pl-9" placeholder={lang === 'ru' ? 'Поиск по имени или компании…' : 'Search by name or company…'}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Create modal ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{lang === 'ru' ? 'Новый клиент' : 'New Customer'}</h2>
              <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}><FiX className="text-gray-400" /></button>
            </div>
            <form onSubmit={createCustomer} className="space-y-4">
              {fields(createForm, setCreateForm, showCreatePass, setShowCreatePass, false)}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">{lang === 'ru' ? 'Создать' : 'Create'}</button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }} className="btn-secondary flex-1">{lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">{lang === 'ru' ? 'Редактировать клиента' : 'Edit Customer'}</h2>
              <button onClick={() => setEditCustomer(null)}><FiX className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-400 mb-5">@{editCustomer.username}</p>

            <form onSubmit={saveEdit} className="space-y-4">
              {fields(editForm, setEditForm, showEditPass, setShowEditPass, true)}

              {/* Active toggle */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700 flex-1">
                  {lang === 'ru' ? 'Аккаунт активен' : 'Account active'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isActive !== false ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.isActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingEdit} className="btn-primary flex-1">
                  {savingEdit ? '…' : (lang === 'ru' ? 'Сохранить' : 'Save')}
                </button>
                <button type="button" onClick={() => setEditCustomer(null)} className="btn-secondary flex-1">
                  {lang === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Price list modal ──────────────────────────────────────────────── */}
      {priceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">{lang === 'ru' ? 'Назначить прайс-лист' : 'Assign Price List'}</h2>
            <div className="space-y-2">
              {priceLists.filter(pl => pl.isActive).map((pl) => (
                <button key={pl._id} onClick={() => assignPriceList(priceModal.customerId, pl._id)}
                  className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-colors ${String(priceModal.current) === String(pl._id) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-primary-300'}`}>
                  {pl.name}
                </button>
              ))}
              {priceLists.filter(pl => pl.isActive).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{lang === 'ru' ? 'Прайс-листы не найдены' : 'No price lists found'}</p>
              )}
            </div>
            <button onClick={() => setPriceModal(null)} className="btn-secondary w-full mt-4 text-sm">{lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* ── Customer cards ────────────────────────────────────────────────── */}
      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <FiUser size={40} className="mx-auto mb-3 opacity-20" />
              <p>{lang === 'ru' ? 'Клиентов пока нет' : 'No customers yet'}</p>
            </div>
          )}
          {customers.map((c) => (
            <div key={c._id} className="card hover:shadow-md transition-shadow">
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 font-bold text-sm">{(c.name || c.username)[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">{c.name}</h3>
                    {c.companyName && <p className="text-xs text-gray-500">{c.companyName}</p>}
                    <p className="text-xs text-gray-400">@{c.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`badge ${c.isActive ? 'badge-green' : 'badge-red'} text-xs`}>
                    {c.isActive ? (lang === 'ru' ? 'Активен' : 'Active') : (lang === 'ru' ? 'Неактивен' : 'Inactive')}
                  </span>
                  <button onClick={() => openEdit(c)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title={lang === 'ru' ? 'Редактировать' : 'Edit'}>
                    <FiEdit2 size={14} />
                  </button>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1 mb-3">
                {c.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5">📞 {c.phone}</p>}
                {c.email && <p className="text-xs text-gray-500 flex items-center gap-1.5">✉️ {c.email}</p>}
                {c.address && <p className="text-xs text-gray-400 truncate">📍 {c.address}</p>}
              </div>

              {/* Price list row */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{lang === 'ru' ? 'Прайс-лист' : 'Price List'}</p>
                  <p className="text-sm font-semibold text-primary-600">{c.priceListId?.name || <span className="text-gray-400 font-normal">{lang === 'ru' ? 'Не назначен' : 'None'}</span>}</p>
                </div>
                <button onClick={() => setPriceModal({ customerId: c._id, current: c.priceListId?._id })}
                  className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 transition-colors">
                  <FiEdit2 size={11} /> {lang === 'ru' ? 'Изменить' : 'Change'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-5 text-sm text-gray-500">
        <span>{total} {lang === 'ru' ? 'клиентов' : 'customers'}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">←</button>
          <span className="py-1 px-2">{page} / {Math.max(1, Math.ceil(total / limit))}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">→</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
