// Todas las llamadas al backend pasan por aquí.
async function request(path) {
  const res = await fetch(`/api${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  status: () => request("/status"),
  profile: () => request("/profile"),
  posts: (after) => request(`/posts?limit=12${after ? `&after=${encodeURIComponent(after)}` : ""}`),
  post: (id) => request(`/posts/${id}`),
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
