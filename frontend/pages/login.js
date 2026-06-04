import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Head from 'next/head';
import { FiUser, FiLock, FiEye, FiEyeOff, FiGlobe } from 'react-icons/fi';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [lang, setLang] = useState('ru');

  const t = {
    ru: {
      brand: 'B2B Платформа',
      subtitle: 'Добро пожаловать',
      desc: 'Войдите в свой аккаунт для продолжения',
      username: 'Имя пользователя',
      password: 'Пароль',
      submit: 'Войти',
      loading: 'Вход…',
      footer: 'Только для авторизованных пользователей',
    },
    en: {
      brand: 'B2B Platform',
      subtitle: 'Welcome back',
      desc: 'Sign in to your account to continue',
      username: 'Username',
      password: 'Password',
      submit: 'Sign In',
      loading: 'Signing in…',
      footer: 'Authorized users only',
    },
  }[lang];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error(lang === 'ru' ? 'Заполните все поля' : 'Fill all fields');
    setLoading(true);
    try {
      const data = await login(form.username, form.password);
      if (!data.success) toast.error(data.message || (lang === 'ru' ? 'Неверные данные' : 'Invalid credentials'));
    } catch (err) {
      toast.error(err.response?.data?.message || (lang === 'ru' ? 'Неверные данные' : 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>{t.brand} — Login</title></Head>

      <div className="min-h-screen flex">

        {/* ── Left panel (decorative) ─────────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-700 via-primary-600 to-blue-500 flex-col items-center justify-center p-12 overflow-hidden">
          {/* Background circles */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white opacity-5 rounded-full" />
          <div className="absolute -bottom-32 -right-16 w-[500px] h-[500px] bg-white opacity-5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white opacity-[0.03] rounded-full" />

          {/* Content */}
          <div className="relative z-10 text-center text-white max-w-sm">
            {/* Logo mark */}
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm border border-white border-opacity-30 shadow-2xl">
              <span className="text-3xl font-black text-white">B2B</span>
            </div>

            <h1 className="text-4xl font-black mb-4 leading-tight">
              {lang === 'ru' ? 'Управляйте бизнесом' : 'Manage your'}<br />
              <span className="text-blue-200">{lang === 'ru' ? 'эффективно' : 'business efficiently'}</span>
            </h1>
            <p className="text-blue-100 text-base leading-relaxed opacity-90">
              {lang === 'ru'
                ? 'Единая платформа для заказов, клиентов и аналитики вашего бизнеса'
                : 'One platform for orders, customers and analytics for your business'}
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {(lang === 'ru'
                ? ['📦 Заказы', '👥 Клиенты', '📊 Аналитика', '🔗 МойСклад']
                : ['📦 Orders', '👥 Customers', '📊 Analytics', '🔗 MoySklad']
              ).map(f => (
                <span key={f} className="bg-white bg-opacity-15 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white border-opacity-20 backdrop-blur-sm">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel (form) ──────────────────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-sm">

            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-xl font-black text-white">B2B</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t.brand}</h1>
            </div>

            {/* Form card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200 border border-gray-100 p-8">

              {/* Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-black text-gray-900">{t.subtitle}</h2>
                <p className="text-gray-400 text-sm mt-1">{t.desc}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t.username}
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent focus:bg-white transition-all placeholder-gray-300"
                      placeholder={lang === 'ru' ? 'ваш_логин' : 'your_username'}
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t.password}
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent focus:bg-white transition-all placeholder-gray-300"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-primary-200 hover:shadow-primary-300 disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t.loading}
                    </>
                  ) : t.submit}
                </button>
              </form>

              {/* Language toggle */}
              <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-100">
                <FiGlobe size={13} className="text-gray-400" />
                <button
                  onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
                  className="text-xs text-gray-400 hover:text-primary-600 font-medium transition-colors"
                >
                  {lang === 'ru' ? 'Switch to English' : 'Переключить на Русский'}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-5">{t.footer}</p>
          </div>
        </div>

      </div>
    </>
  );
}
