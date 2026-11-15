import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  entityId?: string;
}

const Ctx = createContext<{ user: User | null; login: (e: string, p: string) => Promise<void>; logout: () => void }>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  async function login(email: string, password: string) {
    const r = await api("/auth/login", { body: { email, password } });
    sessionStorage.setItem("token", r.token);
    sessionStorage.setItem("user", JSON.stringify(r.user));
    setUser(r.user);
  }

  function logout() {
    api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    sessionStorage.clear();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
