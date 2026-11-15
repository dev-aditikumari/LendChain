const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function getToken() {
  return sessionStorage.getItem("token");
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.issues?.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(detail || data.code || data.error || "Request failed");
  }
  return data;
}

export const rupees = (paise: number) =>
  "Rs " + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const date = (d: string) => new Date(d).toLocaleDateString("en-IN");
