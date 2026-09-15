import { createContext, useContext, useEffect, useRef, useState } from 'react';

const AuthContext = createContext();
const API = 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  function storeSession(data) {
    tokenRef.current = data.access_token;
    setAccessToken(data.access_token);
    setCurrentUser(data.user);
    setNeedsSetup(!data.user.upi_setup_completed);
    return data.user;
  }

  async function refresh() {
    const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Session expired');
    return storeSession(await res.json());
  }

  useEffect(() => {
    refresh().catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function apiFetch(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
    if (res.status === 401 && retry && path !== '/auth/refresh') {
      try {
        await refresh();
        return apiFetch(path, options, false);
      } catch {
        logout();
      }
    }
    return res;
  }

  async function login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return storeSession(data);
  }

  async function register(formData) {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return storeSession(data);
  }

  async function completeSetup(setupData) {
    const res = await apiFetch('/auth/pin', { method: 'POST', body: JSON.stringify(setupData) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save PIN');
    setCurrentUser(data.user);
    setNeedsSetup(false);
  }

  async function verifyPin(pin) {
    const res = await apiFetch('/auth/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) });
    if (!res.ok) return false;
    return (await res.json()).valid === true;
  }

  async function logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }, false); } catch {}
    tokenRef.current = null;
    setAccessToken(null);
    setCurrentUser(null);
    setNeedsSetup(false);
  }

  return (
    <AuthContext.Provider value={{
      currentUser, needsSetup, loading, accessToken,
      login, register, completeSetup, verifyPin, logout, apiFetch
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}