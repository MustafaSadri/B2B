import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiSearch, FiPlus, FiX, FiCheck, FiTag, FiEdit2, FiTrash2, FiImage } from 'react-icons/fi';
import PhotoUploadModal from '../../components/ui/PhotoUploadModal';

export default function AdminProducts() {
  const { user } = useRequireAuth('admin');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(new Set());

  // Image / product edit modal
  const [editingImage, setEditingImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [editMinQty, setEditMinQty] = useState(5);
  const [editLoyaltyPct, setEditLoyaltyPct] = useState('');

  // Photo upload (now handled by PhotoUploadModal)
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const openImageEdit = (p) => {
    setEditingImage(p);
    setImageUrl(p.images?.[0] || '');
    setEditMinQty(p.minOrderQty ?? 5);
    setEditLoyaltyPct(p.loyaltyPercentage ?? '');
  };

  const onPhotoSaved = (url) => {
    const images = url ? [url] : [];
    setProducts(prev => prev.map(p => p._id === editingImage._id ? { ...p, images } : p));
    setShowPhotoModal(false);
  };

  const saveProductSettings = async () => {
    const payload = {
      minOrderQty: Number(editMinQty) || 5,
      loyaltyPercentage: editLoyaltyPct !== '' ? Number(editLoyaltyPct) : null,
    };
    await api.patch(`/products/${editingImage._id}`, payload);
    toast.success('Product updated');
    setEditingImage(null);
    setProducts(prev => prev.map(p => p._id === editingImage._id ? { ...p, ...payload } : p));
  };

  // Category modals
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ nameRu: '', nameEn: '', displayOrder: 0 });
  const [showCatPanel, setShowCatPanel] = useState(false);

  // Bulk assign
  const [bulkCat, setBulkCat] = useState('');

  const lang = user?.language || 'ru';
  const limit = 50;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (filterCat) params.category = filterCat;
      const { data } = await api.get('/products', { params });
      if (data.success) { setProducts(data.products); setTotal(data.total); }
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [page, search, filterCat]);

  const fetchCategories = async () => {
    const { data } = await api.get('/categories?all=true');
    if (data.success) setCategories(data.categories);
  };

  useEffect(() => { if (user) { fetchProducts(); fetchCategories(); } }, [user, page, filterCat]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchProducts(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Sync ────────────────────────────────────────────────────────────────────
  const syncAll = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/products/sync');
      toast.success(data.message);
      setSelected(new Set());
      await Promise.all([fetchProducts(), fetchCategories()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally { setSyncing(false); }
  };

  // ─── Category CRUD ────────────────────────────────────────────────────────────
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
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const deleteCat = async (id) => {
    if (!confirm('Remove this category? Products will become uncategorized.')) return;
    await api.delete(`/categories/${id}`);
    toast.success('Removed');
    fetchCategories();
    fetchProducts();
  };

  // ─── Product category assignment ──────────────────────────────────────────────
  const assignCategory = async (productId, categoryId) => {
    await api.patch(`/products/${productId}`, { categoryId: categoryId || null });
    setProducts((prev) =>
      prev.map((p) =>
        p._id === productId
          ? { ...p, categoryId: categories.find((c) => c._id === categoryId) || null }
          : p
      )
    );
  };

  const bulkAssign = async () => {
    if (selected.size === 0) return toast.error('Select products first');
    await api.post('/products/bulk-category', {
      productIds: [...selected],
      categoryId: bulkCat || null,
    });
    toast.success(`Assigned ${selected.size} products`);
    setSelected(new Set());
    fetchProducts();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p._id)));
  };

  if (!user) return <LoadingSpinner fullPage />;

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <DashboardLayout title="Products">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Products <span className="text-gray-400 text-lg font-normal">({total})</span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowCatPanel(!showCatPanel)} className="btn-secondary flex items-center gap-2 text-sm">
            <FiTag size={14} /> Categories ({categories.length})
          </button>
          <button onClick={syncAll} disabled={syncing} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync MoySklad'}
          </button>
        </div>
      </div>

      {/* ── Category Panel ──────────────────────────────────────────────────── */}
      {showCatPanel && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Category Management</h2>
            <button onClick={() => openCatForm()} className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
              <FiPlus size={12} /> New Category
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.map((c) => (
              <div key={c._id} className={`flex items-center justify-between p-3 rounded-lg border ${c.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name?.ru}</p>
                  <p className="text-xs text-gray-400">{c.productCount || 0} products</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openCatForm(c)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                    <FiEdit2 size={13} />
                  </button>
                  <button onClick={() => deleteCat(c._id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 col-span-3 py-4 text-center">
                No categories yet. Click "New Category" or sync MoySklad to import folders.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-2.5 text-gray-400" size={15} />
          <input className="input pl-9 text-sm" placeholder="Search by name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm max-w-xs" value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          <option value="none">— Uncategorized</option>
          {activeCategories.map((c) => <option key={c._id} value={c._id}>{c.name?.ru}</option>)}
        </select>
      </div>

      {/* ── Bulk assign bar ──────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl">
          <span className="text-sm font-medium text-primary-700">{selected.size} selected</span>
          <select className="input text-sm max-w-xs" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
            <option value="">— Remove category</option>
            {activeCategories.map((c) => <option key={c._id} value={c._id}>{c.name?.ru}</option>)}
          </select>
          <button onClick={bulkAssign} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1">
            <FiCheck size={14} /> Assign
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* ── Product Table ────────────────────────────────────────────────────── */}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-wrapper card p-0">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0}
                      onChange={toggleAll} className="rounded" />
                  </th>
                  <th>Photo</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                    No products found. Click <strong>Sync MoySklad</strong> to import.
                  </td></tr>
                )}
                {products.map((p) => (
                  <tr key={p._id} className={selected.has(p._id) ? 'bg-primary-50' : ''}>
                    <td>
                      <input type="checkbox" checked={selected.has(p._id)}
                        onChange={() => toggleSelect(p._id)} className="rounded" />
                    </td>
                    <td>
                      <button onClick={() => openImageEdit(p)} className="relative group w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-50 hover:border-primary-400 transition-colors">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          : <FiImage size={16} className="text-gray-300 group-hover:text-primary-400 transition-colors" />}
                      </button>
                    </td>
                    <td>
                      <div className="font-medium text-gray-900 leading-snug">{p.name?.ru || p.name?.en}</div>
                      {p.isVariant && <span className="text-xs text-purple-500 font-medium">variant</span>}
                    </td>
                    <td className="font-mono text-xs text-gray-400">{p.sku || '—'}</td>
                    <td>
                      {/* Inline category selector */}
                      <select
                        className="text-xs border border-gray-200 rounded px-2 py-1 max-w-[160px]"
                        value={p.categoryId?._id || p.categoryId || ''}
                        onChange={(e) => assignCategory(p._id, e.target.value)}
                      >
                        <option value="">— None</option>
                        {activeCategories.map((c) => (
                          <option key={c._id} value={c._id}>{c.name?.ru}</option>
                        ))}
                      </select>
                    </td>
                    <td className="font-semibold">
                      {p.basePrice > 0 ? `₽${p.basePrice.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.stock === 0 ? 'bg-red-100 text-red-700'
                          : p.stock < 10 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td>
                      <span className={p.isActive ? 'badge-green' : 'badge-gray'}>
                        {p.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">← Prev</button>
              <span className="py-1 px-2">Page {page} / {Math.max(1, Math.ceil(total / limit))}</span>
              <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </>
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
                <label className="text-sm font-medium text-gray-700 block mb-1">Name (RU) *</label>
                <input className="input" required value={catForm.nameRu} onChange={(e) => setCatForm({ ...catForm, nameRu: e.target.value })} placeholder="e.g. Электронные сигареты" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name (EN)</label>
                <input className="input" value={catForm.nameEn} onChange={(e) => setCatForm({ ...catForm, nameEn: e.target.value })} placeholder="e.g. E-cigarettes" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Display Order</label>
                <input className="input" type="number" value={catForm.displayOrder} onChange={(e) => setCatForm({ ...catForm, displayOrder: Number(e.target.value) })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingCat ? 'Save' : 'Create'}</button>
                <button type="button" onClick={() => setShowCatForm(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Product Settings Modal (min qty + loyalty %) ─────────────────────── */}
      {editingImage && !showPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Product Settings</h2>
              <button onClick={() => setEditingImage(null)}><FiX className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-400 mb-4 truncate">{editingImage.name?.ru}</p>

            {/* Photo row */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-white flex-shrink-0">
                {editingImage.images?.[0]
                  ? <img src={editingImage.images[0]} alt="" className="w-full h-full object-cover" />
                  : <FiImage size={18} className="text-gray-300" />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-600">Product Photo</p>
                <p className="text-xs text-gray-400">{editingImage.images?.[0] ? 'Photo set' : 'No photo yet'}</p>
              </div>
              <button onClick={() => setShowPhotoModal(true)} className="text-xs btn-secondary py-1.5 px-3">
                {editingImage.images?.[0] ? 'Change' : 'Upload'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">Min Order Qty</label>
                <input type="number" min="1" className="input text-sm" value={editMinQty}
                  onChange={e => setEditMinQty(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                  Loyalty % <span className="text-gray-300 normal-case font-normal">(blank=global)</span>
                </label>
                <input type="number" min="0" max="100" step="0.5" className="input text-sm"
                  placeholder="e.g. 3" value={editLoyaltyPct}
                  onChange={e => setEditLoyaltyPct(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={saveProductSettings} className="btn-primary flex-1">Save</button>
              <button onClick={() => setEditingImage(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Upload Modal ───────────────────────────────────────────────── */}
      {editingImage && showPhotoModal && (
        <PhotoUploadModal product={editingImage} onSave={onPhotoSaved} onClose={() => setShowPhotoModal(false)} />
      )}
    </DashboardLayout>
  );
}
