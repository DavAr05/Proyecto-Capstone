import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!getToken()) { setLoading(false); return undefined; }
    api.me().then((u) => alive && setUser(u)).catch(() => setToken(null)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (userId) => {
    const r = await api.login(userId);
    setToken(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);
  const refresh = useCallback(async () => setUser(await api.me()), []);

  return <Ctx.Provider value={{ user, loading, login, logout, refresh, setUser }}>{children}</Ctx.Provider>;
}
