import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api, { saveTokens, clearTokens } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchMe();
  }, []);

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data.success) setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    if (data.success) {
      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      const redirects = { admin: '/admin', salesRep: '/sales-rep', customer: '/customer' };
      router.push(redirects[data.user.role] || '/');
    }
    return data;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    clearTokens();
    setUser(null);
    router.push('/login');
  };

  const setLanguage = async (lang) => {
    await api.patch('/auth/language', { language: lang });
    setUser((u) => ({ ...u, language: lang }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setLanguage, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
