import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) {
      api("/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    }
    const onLogout = () => setUser(null);
    window.addEventListener("vm-logout", onLogout);
    return () => window.removeEventListener("vm-logout", onLogout);
  }, []);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };
  // Registration sends a verification code; the account is usable after verifyEmail().
  const register = (name, email, password) => api("/auth/register", { method: "POST", body: { name, email, password } });
  const verifyEmail = async (email, code) => {
    const data = await api("/auth/verify-email", { method: "POST", body: { email, code } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };
  const refresh = () => api("/auth/me").then(setUser);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, verifyEmail, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
