import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency } from '../../lib/api';
import toast from 'react-hot-toast';
import { FiShoppingCart, FiSearch, FiMinus, FiPlus, FiTrash2, FiPackage, FiX } from 'react-icons/fi';

const PLACEHOLDER_COLORS = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-green-400 to-green-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
];

function ProductImage({ product, className = '' }) {
  const [failed, setFailed] = useState(false);
  const img = product.images?.[0];
  const colorIdx = product.name?.ru?.charCodeAt(0) % PLACEHOLDER_COLORS.length || 0;

  if (img && !failed) {
    return (
      <img
        src={img}
        alt={product.name?.ru}
        className={`w-full h-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[colorIdx]} flex items-center justify-center`}>
      <span className="text-white text-3xl font-bold opacity-80 select-none">
        {(product.name?.ru || product.name?.en || '?')[0].toUpperCase()}
      </span>
    </div>
  );
}

export default function CustomerShop() {
  const { user } = useRequireAuth('customer');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loyaltyToUse, setLoyaltyToUse] = useState(0);
  const searchRef = useRef(null);
  const lang = user?.language || 'ru';
  const limit = 60;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (selectedCat) params.category = selectedCat;
      const [prodRes, catRes] = await Promise.all([
        api.get('/products', { params }),
        api.get('/categories'),
      ]);
      if (prodRes.data.success) { setProducts(prodRes.data.products); setTotal(prodRes.data.total); }
      if (catRes.data.success) setCategories(catRes.data.categories);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchData(); }, [user, page, selectedCat]);
  useEffect(() => {
    if (user?.address && !shippingAddress) setShippingAddress(user.address);
    if (user?.phone && !phone) setPhone(user.phone);
    if (user) {
      api.get('/loyalty/wallet').then(({ data }) => {
        if (data.success) setWalletBalance(data.wallet?.balance || 0);
      }).catch(() => {});
    }
  }, [user]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const setQty = (id, qty, min = 1) => {
    if (qty <= 0) { removeFromCart(id); return; }
    setCart(c => ({ ...c, [id]: Math.max(qty, min) }));
  };
  const removeFromCart = (id) => setCart(c => { const n = { ...c }; delete n[id]; return n; });

  const cartItems = products.filter(p => cart[p._id]);
  const cartTotal = cartItems.reduce((s, p) => s + (p.displayPrice || p.basePrice || 0) * (cart[p._id] || 0), 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const placeOrder = async () => {
    if (!cartItems.length) return toast.error(lang === 'ru' ? 'Корзина пуста' : 'Cart is empty');
    if (!shippingAddress.trim()) return toast.error(lang === 'ru' ? 'Укажите адрес доставки' : 'Delivery address is required');
    if (!phone.trim()) return toast.error(lang === 'ru' ? 'Укажите номер телефона' : 'Phone number is required');
    setPlacing(true);
    try {
      const items = cartItems.map(p => ({ productId: p._id, quantity: cart[p._id] }));
      const { data } = await api.post('/orders', {
        items,
        couponCode: coupon || undefined,
        loyaltyCreditsToUse: loyaltyToUse || 0,
        shippingAddress: shippingAddress.trim(),
        notes: orderNotes.trim() || undefined,
        phone: phone.trim(),
      });
      toast.success(lang === 'ru' ? `Заказ ${data.order.orderNumber} оформлен!` : `Order ${data.order.orderNumber} placed!`);
      setCart({});
      setShowCart(false);
      setCoupon('');
      setOrderNotes('');
      setLoyaltyToUse(0);
      setWalletBalance(prev => Math.max(0, prev - loyaltyToUse));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setPlacing(false); }
  };

  if (!user) return <LoadingSpinner fullPage />;

  const grouped = !search && !selectedCat
    ? (() => {
        const result = categories.reduce((acc, cat) => {
          const catProducts = products.filter(p => {
            const catId = p.categoryId?._id || p.categoryId;
            return catId && String(catId) === String(cat._id);
          });
          if (catProducts.length) acc.push({ cat, products: catProducts });
          return acc;
        }, []);
        const uncategorized = products.filter(p => !p.categoryId);
        if (uncategorized.length) result.push({ cat: { _id: 'none', name: { ru: 'Без категории', en: 'Uncategorized' } }, products: uncategorized });
        return result;
      })()
    : null;

  const ProductCard = ({ p }) => {
    const qty = cart[p._id] || 0;
    const price = p.displayPrice || p.basePrice || 0;
    const outOfStock = p.stock === 0;
    const lowStock = !outOfStock && p.stock > 0 && p.stock < 10;

    return (
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${outOfStock ? 'opacity-60' : ''}`}>
        {/* Image */}
        <div className="relative h-44 bg-gray-50 overflow-hidden">
          <ProductImage product={p} />
          {outOfStock && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <span className="text-white text-sm font-semibold bg-black bg-opacity-60 px-3 py-1 rounded-full">
                {lang === 'ru' ? 'Нет в наличии' : 'Out of stock'}
              </span>
            </div>
          )}
          {lowStock && !outOfStock && (
            <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
              {lang === 'ru' ? 'Мало' : 'Low'}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 p-3 gap-2">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
            {p.name?.[lang] || p.name?.ru}
          </p>
          {p.sku && (
            <p className="text-xs text-gray-400 font-mono">SKU: {p.sku}</p>
          )}
          <p className={`text-base font-bold ${price > 0 ? 'text-primary-600' : 'text-gray-300'}`}>
            {price > 0 ? formatCurrency(price) : (lang === 'ru' ? 'Цена по запросу' : 'Price on request')}
          </p>

          {/* Cart control */}
          {!outOfStock && (
            qty === 0 ? (
              <button
                onClick={() => setQty(p._id, p.minOrderQty || 1, p.minOrderQty)}
                className="btn-primary w-full py-2 text-sm mt-auto"
              >
                {lang === 'ru' ? 'В корзину' : 'Add to Cart'}
              </button>
            ) : (
              <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-2 py-1 mt-auto">
                <button onClick={() => setQty(p._id, qty - 1, p.minOrderQty)} className="w-7 h-7 flex items-center justify-center text-primary-600 hover:bg-primary-100 rounded-lg transition-colors">
                  <FiMinus size={13} />
                </button>
                <input
                  type="number"
                  className="w-12 text-center text-sm font-bold text-primary-700 bg-transparent border-0 outline-none"
                  value={qty}
                  min={p.minOrderQty || 1}
                  onChange={e => setQty(p._id, parseInt(e.target.value) || 0, p.minOrderQty)}
                />
                <button onClick={() => setQty(p._id, qty + 1, p.minOrderQty)} className="w-7 h-7 flex items-center justify-center text-primary-600 hover:bg-primary-100 rounded-lg transition-colors">
                  <FiPlus size={13} />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title={lang === 'ru' ? 'Каталог' : 'Shop'}>

      {/* ── Top bar: search + cart ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            ref={searchRef}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent placeholder-gray-400 transition"
            placeholder={lang === 'ru' ? 'Поиск по названию или артикулу…' : 'Search by name or SKU…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <FiX size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-3 rounded-2xl shadow-sm transition-colors flex-shrink-0"
        >
          <FiShoppingCart size={18} />
          <span className="hidden sm:inline">{lang === 'ru' ? 'Корзина' : 'Cart'}</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => { setSelectedCat(''); setPage(1); }}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            !selectedCat
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
          }`}
        >
          {lang === 'ru' ? 'Все' : 'All'}
          <span className="ml-1.5 text-xs opacity-70">({total})</span>
        </button>
        {categories.map(c => (
          <button
            key={c._id}
            onClick={() => { setSelectedCat(c._id); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedCat === c._id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {c.name?.[lang] || c.name?.ru}
            {c.productCount ? <span className="ml-1.5 text-xs opacity-70">({c.productCount})</span> : null}
          </button>
        ))}
      </div>

      {/* ── Product grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {grouped ? (
            <div className="space-y-10">
              {grouped.length === 0 ? (
                <div className="text-center py-24 text-gray-400">
                  <FiPackage size={52} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">{lang === 'ru' ? 'Товары не найдены' : 'No products found'}</p>
                  <p className="text-sm mt-1">{lang === 'ru' ? 'Попробуйте другой поиск' : 'Try a different search'}</p>
                </div>
              ) : grouped.map(({ cat, products: ps }) => (
                <div key={cat._id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-gray-800">{cat.name?.[lang] || cat.name?.ru}</h2>
                    <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{ps.length}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {ps.map(p => <ProductCard key={p._id} p={p} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.length === 0 ? (
                <div className="col-span-5 text-center py-24 text-gray-400">
                  <FiSearch size={52} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">{lang === 'ru' ? 'Ничего не найдено' : 'No results found'}</p>
                </div>
              ) : products.map(p => <ProductCard key={p._id} p={p} />)}
            </div>
          )}

          {total > limit && (
            <div className="flex items-center justify-between mt-8 text-sm text-gray-500">
              <span>{total} {lang === 'ru' ? 'товаров' : 'products'}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1.5 px-4 disabled:opacity-40">←</button>
                <span className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg">{page} / {Math.ceil(total / limit)}</span>
                <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1.5 px-4 disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Cart drawer ───────────────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">

            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <FiShoppingCart size={20} className="text-primary-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  {lang === 'ru' ? 'Корзина' : 'Cart'}
                  {cartCount > 0 && <span className="ml-2 text-sm text-gray-400 font-normal">({cartCount} {lang === 'ru' ? 'шт.' : 'items'})</span>}
                </h2>
              </div>
              <button onClick={() => setShowCart(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                  <FiShoppingCart size={48} className="mb-4 opacity-20" />
                  <p className="font-medium">{lang === 'ru' ? 'Корзина пуста' : 'Cart is empty'}</p>
                  <p className="text-sm mt-1">{lang === 'ru' ? 'Добавьте товары из каталога' : 'Add items from the catalogue'}</p>
                </div>
              ) : cartItems.map(p => {
                const price = p.displayPrice || p.basePrice || 0;
                return (
                  <div key={p._id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                      <ProductImage product={p} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{p.name?.[lang] || p.name?.ru}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(price)} × {cart[p._id]}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(price * cart[p._id])}</p>
                      <button onClick={() => removeFromCart(p._id)} className="text-red-300 hover:text-red-500 transition-colors">
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart footer */}
            <div className="px-4 py-4 border-t space-y-3 bg-gray-50">
              {/* Loyalty points */}
              {walletBalance > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">⭐</span>
                      <span className="text-sm font-semibold text-purple-800">
                        {lang === 'ru' ? 'Бонусные баллы' : 'Loyalty Points'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {lang === 'ru' ? 'Баланс:' : 'Balance:'} {walletBalance.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range" min="0" max={Math.min(walletBalance, cartTotal)}
                    step="1" value={loyaltyToUse}
                    onChange={e => setLoyaltyToUse(Number(e.target.value))}
                    className="w-full accent-purple-600 mb-1"
                  />
                  <div className="flex justify-between text-xs text-purple-600">
                    <span>0</span>
                    <span className="font-bold">
                      {loyaltyToUse > 0
                        ? `${lang === 'ru' ? 'Применить' : 'Apply'} ${loyaltyToUse.toLocaleString()} pts → -${formatCurrency(loyaltyToUse)}`
                        : (lang === 'ru' ? 'Передвиньте для применения' : 'Slide to apply')}
                    </span>
                    <span>{Math.min(walletBalance, cartTotal).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <input
                className="input text-sm"
                placeholder={lang === 'ru' ? 'Промокод (необязательно)…' : 'Coupon code (optional)…'}
                value={coupon}
                onChange={e => setCoupon(e.target.value)}
              />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {lang === 'ru' ? 'Телефон' : 'Phone'} <span className="text-red-400">*</span>
                </label>
                <input className="input text-sm" placeholder="+7 (___) ___-__-__" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {lang === 'ru' ? 'Адрес доставки' : 'Delivery address'} <span className="text-red-400">*</span>
                </label>
                <textarea
                  className="input text-sm min-h-[72px] resize-none"
                  placeholder={lang === 'ru' ? 'Улица, дом, подъезд, этаж' : 'Street, house, entrance, floor'}
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {lang === 'ru' ? 'Особые пожелания' : 'Special instructions'}
                </label>
                <textarea
                  className="input text-sm min-h-[56px] resize-none"
                  placeholder={lang === 'ru' ? 'Время доставки, комментарии…' : 'Delivery time, comments…'}
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                />
              </div>

              {loyaltyToUse > 0 && (
                <div className="flex items-center justify-between text-sm text-purple-600">
                  <span>⭐ {lang === 'ru' ? 'Бонусные баллы' : 'Loyalty discount'}</span>
                  <span className="font-semibold">-{formatCurrency(loyaltyToUse)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-bold pt-1 border-t border-gray-100">
                <span className="text-gray-700">{lang === 'ru' ? 'Итого:' : 'Total:'}</span>
                <span className="text-primary-600 text-xl">{formatCurrency(Math.max(0, cartTotal - loyaltyToUse))}</span>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing || !cartItems.length}
                className="btn-primary w-full py-3.5 text-base font-semibold rounded-2xl disabled:opacity-50"
              >
                {placing ? '…' : (lang === 'ru' ? 'Оформить заказ' : 'Place Order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
