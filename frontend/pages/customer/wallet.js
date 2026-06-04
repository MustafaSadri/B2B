import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api, { formatCurrency, formatDate } from '../../lib/api';
import { FiGift, FiArrowUp, FiArrowDown } from 'react-icons/fi';

export default function CustomerWallet() {
  const { user } = useRequireAuth('customer');
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const lang = user?.language || 'ru';

  useEffect(() => {
    if (!user) return;
    api.get('/loyalty/wallet').then(({ data }) => {
      if (data.success) setWallet(data);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user || loading) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title={lang === 'ru' ? 'Бонусный кошелёк' : 'Loyalty Wallet'}>
      <h1 className="text-2xl font-bold mb-6">{lang === 'ru' ? 'Бонусный кошелёк' : 'Loyalty Wallet'}</h1>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-8 text-white mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FiGift size={24} />
          <span className="text-primary-200 text-sm">{lang === 'ru' ? 'Ваш баланс' : 'Your balance'}</span>
        </div>
        <p className="text-5xl font-bold mb-1">₽{wallet.balance?.toFixed(0) || 0}</p>
        <p className="text-primary-200 text-sm">
          {lang === 'ru' ? 'Накопленные бонусы за заказы' : 'Accumulated order rewards'}
        </p>
      </div>

      {/* Info box */}
      <div className="card mb-6 bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-700">
          {lang === 'ru'
            ? `💡 Вы получаете ${process.env.NEXT_PUBLIC_LOYALTY_PCT || 5}% от суммы каждого заказа в виде бонусов. Бонусы можно использовать для оплаты будущих заказов.`
            : `💡 You earn ${process.env.NEXT_PUBLIC_LOYALTY_PCT || 5}% of each order as loyalty credits. Credits can be applied to future orders.`}
        </p>
      </div>

      {/* Transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{lang === 'ru' ? 'История транзакций' : 'Transaction History'}</h2>
        {wallet.transactions?.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">{lang === 'ru' ? 'Транзакций нет' : 'No transactions yet'}</p>
        ) : (
          <div className="space-y-3">
            {[...wallet.transactions].reverse().map((t, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${t.type === 'earn' ? 'bg-green-50 text-green-600' : t.type === 'redeem' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                    {t.type === 'earn' ? <FiArrowDown size={16} /> : <FiArrowUp size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.description || t.type}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
                  </div>
                </div>
                <p className={`font-semibold ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
