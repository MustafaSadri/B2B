import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useRequireAuth from '../../hooks/useRequireAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { FiSave, FiGift, FiStar, FiPackage } from 'react-icons/fi';

export default function AdminSettings() {
  const { user } = useRequireAuth('admin');
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/admin/settings').then(({ data }) => {
      if (data.success) setSettings(data.settings);
    });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch('/admin/settings', {
        signupBonusPoints: settings.signupBonusPoints,
        globalLoyaltyPercentage: settings.globalLoyaltyPercentage,
        defaultMinOrderQty: settings.defaultMinOrderQty,
      });
      if (data.success) {
        setSettings(data.settings);
        toast.success('Settings saved');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  if (!user || !settings) return <LoadingSpinner fullPage />;

  return (
    <DashboardLayout title="Platform Settings">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Settings</h1>
        <p className="text-sm text-gray-400 mb-8">These settings apply platform-wide. Per-product loyalty can be overridden in the Products page.</p>

        <form onSubmit={save} className="space-y-6">

          {/* Signup bonus */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiGift className="text-purple-600" size={18} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Welcome Bonus</h2>
                <p className="text-xs text-gray-400">Loyalty points awarded to every new customer on signup</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number" min="0" max="10000" step="1"
                className="input max-w-[140px] text-lg font-bold text-center"
                value={settings.signupBonusPoints}
                onChange={e => set('signupBonusPoints', Number(e.target.value))}
              />
              <span className="text-sm text-gray-500">points per new customer</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Set to 0 to disable the welcome bonus.</p>
          </div>

          {/* Global loyalty % */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
                <FiStar className="text-yellow-500" size={18} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Global Loyalty Rate</h2>
                <p className="text-xs text-gray-400">Default % of order value awarded as loyalty points. Can be overridden per product.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number" min="0" max="100" step="0.5"
                className="input max-w-[140px] text-lg font-bold text-center"
                value={settings.globalLoyaltyPercentage}
                onChange={e => set('globalLoyaltyPercentage', Number(e.target.value))}
              />
              <span className="text-sm text-gray-500">% of order value</span>
            </div>
            <div className="mt-3 p-3 bg-yellow-50 rounded-xl text-sm text-yellow-800">
              Example: order of ₽10,000 → customer earns <strong>{Math.round(10000 * settings.globalLoyaltyPercentage / 100).toLocaleString()} points</strong>
            </div>
          </div>

          {/* Default min order qty */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiPackage className="text-blue-600" size={18} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Default Min Order Quantity</h2>
                <p className="text-xs text-gray-400">Minimum units per product in an order. Can be overridden per product in the Products page.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number" min="1" max="1000" step="1"
                className="input max-w-[140px] text-lg font-bold text-center"
                value={settings.defaultMinOrderQty}
                onChange={e => set('defaultMinOrderQty', Number(e.target.value))}
              />
              <span className="text-sm text-gray-500">units minimum</span>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-8">
            <FiSave size={16} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
