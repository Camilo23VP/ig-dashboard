import { useEffect, useMemo, useState } from "react";
import { api, downloadCSV } from "./api";
import ProfileHeader from "./components/ProfileHeader";
import StatsBar from "./components/StatsBar";
import PostGrid from "./components/PostGrid";
import PostDetail from "./components/PostDetail";

export default function App() {
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    Promise.all([api.status(), api.profile(), api.posts()])
      .then(([s, p, page]) => {
        setStatus(s);
        setProfile(p);
        setPosts(page.data);
        setCursor(page.next_cursor);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await api.posts(cursor);
      setPosts((prev) => [...prev, ...page.data]);
      setCursor(page.next_cursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const sum = (k) => posts.reduce((acc, p) => acc + (p[k] ?? 0), 0);
    return { likes: sum("like_count"), comments: sum("comments_count"), reposts: sum("reposts_count") };
  }, [posts]);

  function exportPosts() {
    downloadCSV(
      "publicaciones.csv",
      posts.map(({ id, timestamp, media_type, like_count, comments_count, reposts_count, permalink, caption }) => ({
        id, timestamp, media_type, like_count, comments_count, reposts_count, permalink, caption,
      }))
    );
  }

  if (error && !profile) {
    return (
      <main className="container">
        <div className="error-box">
          <strong>No se pudo conectar con el backend</strong>
          <p>{error}</p>
          <p className="muted">Revisa que FastAPI esté corriendo en el puerto 8000 y que el token sea válido.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      {status && status.mode === "mock" && (
        <div className="banner">Modo demo: datos de prueba. Cambia <code>IG_MODE</code> en el <code>.env</code> para usar tu cuenta.</div>
      )}
      {profile && <ProfileHeader profile={profile} />}
      <StatsBar loaded={posts.length} total={profile?.media_count} totals={totals} repostsAvailable={status?.reposts_available} />

      <div className="section-head">
        <h2>Publicaciones</h2>
        <button className="btn ghost" onClick={exportPosts} disabled={!posts.length}>Exportar CSV</button>
      </div>

      <PostGrid posts={posts} onSelect={setSelectedId} repostsAvailable={status?.reposts_available} />

      <div className="center">
        {loading && <p className="muted">Cargando…</p>}
        {!loading && cursor && <button className="btn" onClick={loadMore}>Cargar más</button>}
        {error && profile && <p className="error-text">{error}</p>}
      </div>

      {selectedId && (
        <PostDetail id={selectedId} onClose={() => setSelectedId(null)} repostsAvailable={status?.reposts_available} />
      )}
    </main>
  );
}
