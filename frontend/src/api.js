// Todas las llamadas al backend pasan por aquí.
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  status: () => request("/status"),
  profile: () => request("/profile"),
  posts: (after) => request(`/posts?limit=12${after ? `&after=${encodeURIComponent(after)}` : ""}`),
  post: (id) => request(`/posts/${id}`),
  comments: (id, after) => request(`/posts/${id}/comments?limit=50${after ? `&after=${encodeURIComponent(after)}` : ""}`),
  hideComment: (id, hidden) => request(`/comments/${id}/hide`, { method: "POST", body: { hidden } }),
  deleteComment: (id) => request(`/comments/${id}`, { method: "DELETE" }),
  setCommentsEnabled: (id, enabled) => request(`/posts/${id}/comments/enabled`, { method: "POST", body: { enabled } }),
};

// Exporta filas a CSV (útil para analizar luego en pandas/Excel)
export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const fmt = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("es-CO"));
export const fmtDate = (iso) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
