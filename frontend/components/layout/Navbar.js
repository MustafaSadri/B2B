import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { FiBell, FiGlobe, FiLogOut, FiUser, FiMenu, FiX } from 'react-icons/fi';

const Navbar = ({ notifications = 0 }) => {
  const { user, logout, setLanguage } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const lang = user?.language || 'ru';

  const t = {
    ru: { dashboard: 'Панель', orders: 'Заказы', products: 'Товары', customers: 'Клиенты', profile: 'Профиль', logout: 'Выйти' },
    en: { dashboard: 'Dashboard', orders: 'Orders', products: 'Products', customers: 'Customers', profile: 'Profile', logout: 'Logout' },
  }[lang];

  const adminLinks = [
    { href: '/admin', label: t.dashboard },
    { href: '/admin/inventory', label: lang === 'ru' ? 'Склад' : 'Inventory' },
    { href: '/admin/orders', label: t.orders },
    { href: '/admin/customers', label: t.customers },
    { href: '/admin/sales-reps', label: lang === 'ru' ? 'Сотрудники' : 'Sales Reps' },
    { href: '/admin/analytics', label: lang === 'ru' ? 'Аналитика' : 'Analytics' },
    { href: '/admin/settings', label: lang === 'ru' ? 'Настройки' : 'Settings' },
  ];

  const salesRepLinks = [
    { href: '/sales-rep', label: t.dashboard },
    { href: '/sales-rep/customers', label: t.customers },
    { href: '/sales-rep/orders', label: t.orders },
  ];

  const customerLinks = [
    { href: '/customer', label: t.dashboard },
    { href: '/customer/shop', label: lang === 'ru' ? 'Магазин' : 'Shop' },
    { href: '/customer/orders', label: t.orders },
    { href: '/customer/wallet', label: lang === 'ru' ? 'Кошелёк' : 'Wallet' },
  ];

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'salesRep' ? salesRepLinks : customerLinks;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href={user?.role === 'admin' ? '/admin' : user?.role === 'salesRep' ? '/sales-rep' : '/customer'}>
            <span className="text-xl font-bold text-primary-600">B2B Platform</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLanguage(lang === 'ru' ? 'en' : 'ru')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <FiGlobe size={16} />
              <span className="font-medium">{lang.toUpperCase()}</span>
            </button>

            {/* Notifications */}
            <Link href={user?.role === 'admin' ? '/admin/notifications' : user?.role === 'salesRep' ? '/sales-rep/notifications' : '/customer/notifications'} className="relative p-2 text-gray-500 hover:text-primary-600">
              <FiBell size={20} />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name || user?.username}</span>
              <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 p-2 rounded-lg transition-colors">
                <FiLogOut size={18} />
              </button>
            </div>

            {/* Mobile menu toggle */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 pt-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
