import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import {
  FiRefreshCw, FiSearch, FiEye, FiEyeOff, FiTag,
  FiPlus, FiX, FiEdit2, FiTrash2, FiPackage, FiImage,
} from 'react-icons/fi';
import PhotoUploadModal from '../../components/ui/PhotoUploadModal';

export default function AdminInventory() {
  const { user } = useRequireAuth('admin');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | published | hidden

  // selection
  const [selected, setSelected] = useState(new Set());

  // bulk action
  const [bulkCat, setBulkCat] = useState('');

  // category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ nameRu: '', nameEn: '', displayOrder: 0 });

  // last synced time
  const [lastSynced, setLastSynced] = useState(null);

  // photo modal
  const [photoProduct, setPhotoProduct] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  // ─── fetch ─────────────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/inventory/live');
      if (data.success) {
        setProducts(data.products);
        setCategories(data.categories);
        setLastSynced(new Date());
      }
    } catch (err) {
      toast.error('Failed to load inventory: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchInventory(); }, [user]);

  // ─── sync from MoySklad ────────────────────────────────────────────────────
  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/admin/inventory/sync-now');
      toast.success(data.message);
      await fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally { setSyncing(false); }
  };

  // ─── publish / hide ────────────────────────────────────────────────────────
  const setPublished = async (ids, isActive) => {
    await api.patch('/admin/inventory/publish', { productIds: ids, isActive });
    setProducts(prev => prev.map(p => ids.includes(p._id) ? { ...p, isActive } : p));
    setSelected(new Set());
    toast.success(`${ids.length} product(s) ${isActive ? 'published' : 'hidden'}`);
  };

  // ─── category assign ───────────────────────────────────────────────────────
  const assignCategory = async (productId, categoryId) => {
    await api.patch('/admin/inventory/categorise', { productIds: [productId], categoryId });
    const cat = categories.find(c => c._id === categoryId) || null;
    setProducts(prev => prev.map(p => p._id === productId ? { ...p, categoryId: cat } : p));
  };

  const bulkAssign = async () => {
    if (!selected.size) return toast.error('Select products first');
    await api.patch('/admin/inventory/categorise', { productIds: [...selected], categoryId: bulkCat || null });
    const cat = categories.find(c => c._id === bulkCat) || null;
    setProducts(prev => prev.map(p => selected.has(p._id) ? { ...p, categoryId: cat } : p));
    setSelected(new Set());
    toast.success(`Category assigned to ${selected.size} products`);
  };

  // ─── category CRUD ─────────────────────────────────────────────────────────
  const openCatForm = (cat = null) => {
    setEditingCat(cat);
    setCatForm(cat ? { nameRu: cat.name?.ru || '', nameEn: cat.name?.en || '', displayOrder: cat.displayOrder || 0 } : { nameRu: '', nameEn: '', displayOrder: 0 });
    setShowCatForm(true);
  };

  const saveCat = async (e) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await api.patch(`/categories/${editingCat._id}`, catForm);
        toast.success('Category updated');
      } else {
        await api.post('/categories', catForm);
        toast.success('Category created');
      }
      setShowCatForm(false);
      await fetchInventory();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openPhoto = (p) => { setPhotoProduct(p); };

  const onPhotoSaved = (url) => {
    const images = url ? [url] : [];
    setProducts(prev => prev.map(p => p._id === photoProduct._id ? { ...p, images } : p));
    setPhotoProduct(null);
  };

  const deleteCat = async (id) => {
    if (!confirm('Remove category? Products will become uncategorized.')) return;
    await api.delete(`/categories/${id}`);
    toast.success('Category removed');
    await fetchInventory();
  };

  // ─── selection helpers ─────────────────────────────────────────────────────
  const filtered = products.filter(p => {
    if (filterStatus === 'published' && !p.isActive) return false;
    if (filterStatus === 'hidden' && p.isActive) return false;
    if (filterCat && String(p.categoryId?._id || p.categoryId || '') !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.name?.ru || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(p => p._id)));

  // stats
  const publishedCount = products.filter(p => p.isActive).length;
  const hiddenCount = products.length - publishedCount;
  const lowStockCount = products.filter(p => p.liveStock > 0 && p.liveStock < 20).length;
  const outOfStockCount = products.filter(p => p.liveStock <= 0).length;

  if (!user) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title="Inventory">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Inventory</h1>
          {lastSynced && (
            <p className="text-xs text-gray-400 mt-0.5">Last synced: {lastSynced.toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => openCatForm()} className="btn-secondary flex items-center gap-2 text-sm">
            <FiTag size={14} /> Manage Categories
          </button>
          <button onClick={fetchInventory} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={syncNow} disabled={syncing} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing MoySklad…' : 'Sync MoySklad'}
          </button>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Products', value: products.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Published', value: publishedCount, color: 'bg-green-50 text-green-700' },
          { label: 'Hidden', value: hiddenCount, color: 'bg-gray-50 text-gray-600' },
          { label: 'Low Stock (<20)', value: lowStockCount, color: 'bg-yellow-50 text-yellow-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Categories panel ────────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FiTag size={16} /> Categories</h2>
          <button onClick={() => openCatForm()} className="text-xs btn-primary py-1.5 px-3 flex items-center gap-1">
            <FiPlus size={12} /> New
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">No categories yet. Create one or sync MoySklad folders.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <div key={c._id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-700">{c.name?.ru}</span>
                <span className="text-xs text-gray-400">({products.filter(p => String(p.categoryId?._id || p.categoryId) === String(c._id)).length})</span>
                <button onClick={() => openCatForm(c)} className="text-gray-300 hover:text-primary-500 ml-1"><FiEdit2 size={11} /></button>
                <button onClick={() => deleteCat(c._id)} className="text-gray-300 hover:text-red-500"><FiTrash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <FiSearch className="absolute left-3 top-2.5 text-gray-400" size={14} />
          <input className="input pl-9 text-sm" placeholder="Search name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm max-w-[180px]" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          <option value="none">— Uncategorized</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.name?.ru}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[['all','All'],['published','Published'],['hidden','Hidden']].map(([val,label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-3 py-2 font-medium transition-colors ${filterStatus === val ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl">
          <span className="text-sm font-semibold text-primary-700">{selected.size} selected</span>

          <button onClick={() => setPublished([...selected], true)}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            <FiEye size={13} /> Publish
          </button>
          <button onClick={() => setPublished([...selected], false)}
            className="flex items-center gap-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            <FiEyeOff size={13} /> Hide
          </button>

          <div className="flex items-center gap-2 border-l border-primary-200 pl-3">
            <select className="input text-xs py-1.5 max-w-[160px]" value={bulkCat} onChange={e => setBulkCat(e.target.value)}>
              <option value="">— No category</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name?.ru}</option>)}
            </select>
            <button onClick={bulkAssign} className="flex items-center gap-1 btn-primary text-xs py-1.5 px-3">
              <FiTag size={12} /> Assign
            </button>
          </div>

          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Clear</button>
        </div>
      )}

      {/* ── Product Table ────────────────────────────────────────────────────── */}
      {loading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="rounded"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>Photo</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Live Stock</th>
                  <th className="text-right">Price</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Visible</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-400">
                      <FiPackage size={36} className="mx-auto mb-3 opacity-20" />
                      <p>{search || filterCat ? 'No products match filter' : 'No products — click Sync MoySklad'}</p>
                    </td>
                  </tr>
                )}
                {filtered.map(p => {
                  const catId = p.categoryId?._id || p.categoryId || '';
                  const stock = p.liveStock ?? p.stock ?? 0;
                  return (
                    <tr key={p._id} className={`${selected.has(p._id) ? 'bg-primary-50' : ''} ${!p.isActive ? 'opacity-50' : ''}`}>
                      <td>
                        <input type="checkbox" className="rounded" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} />
                      </td>
                      {/* Photo cell */}
                      <td>
                        <button onClick={() => openPhoto(p)}
                          className="relative group w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-50 hover:border-primary-400 transition-colors">
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt="" className="w-full h-full object-cover"
                                onError={e => { e.target.style.display = 'none'; }} />
                            : <FiImage size={15} className="text-gray-300 group-hover:text-primary-400 transition-colors" />}
                        </button>
                      </td>
                      <td>
                        <div className="font-medium text-gray-900 leading-snug">{p.name?.ru}</div>
                        {p.sku && <div className="text-xs text-gray-400 font-mono">{p.sku}</div>}
                        {p.isVariant && <span className="text-xs text-purple-400">variant</span>}
                      </td>
                      <td>
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 max-w-[150px] focus:outline-none focus:ring-1 focus:ring-primary-400"
                          value={catId}
                          onChange={e => assignCategory(p._id, e.target.value)}
                        >
                          <option value="">— None</option>
                          {categories.map(c => <option key={c._id} value={c._id}>{c.name?.ru}</option>)}
                        </select>
                      </td>
                      <td className="text-right">
                        <span className={`text-sm font-bold ${stock === 0 ? 'text-red-500' : stock < 20 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="text-right text-sm font-semibold text-gray-700">
                        {p.basePrice > 0 ? `₽${p.basePrice.toLocaleString()}` : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      <td className="text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          stock === 0 ? 'bg-red-100 text-red-600'
                          : stock < 20 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                        }`}>
                          {stock === 0 ? 'Out' : stock < 20 ? 'Low' : 'In Stock'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => setPublished([p._id], !p.isActive)}
                          className={`p-1.5 rounded-lg transition-colors ${p.isActive ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                          title={p.isActive ? 'Click to hide from customers' : 'Click to publish to customers'}
                        >
                          {p.isActive ? <FiEye size={15} /> : <FiEyeOff size={15} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
            <span>Showing {filtered.length} of {products.length} products</span>
            <span>{publishedCount} published · {hiddenCount} hidden · {outOfStockCount} out of stock</span>
          </div>
        </div>
      )}

      {photoProduct && (
        <PhotoUploadModal product={photoProduct} onSave={onPhotoSaved} onClose={() => setPhotoProduct(null)} />
      )}

      {/* ── Category Form Modal ──────────────────────────────────────────────── */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingCat ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowCatForm(false)}><FiX className="text-gray-400" /></button>
            </div>
            <form onSubmit={saveCat} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
                <input className="input" required placeholder="e.g. Одноразки 15000" value={catForm.nameRu}
                  onChange={e => setCatForm({ ...catForm, nameRu: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name (English)</label>
                <input className="input" placeholder="e.g. Disposables 15000" value={catForm.nameEn}
                  onChange={e => setCatForm({ ...catForm, nameEn: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Display Order</label>
                <input className="input" type="number" value={catForm.displayOrder}
                  onChange={e => setCatForm({ ...catForm, displayOrder: Number(e.target.value) })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingCat ? 'Save Changes' : 'Create'}</button>
                <button type="button" onClick={() => setShowCatForm(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
