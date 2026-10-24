import { useEffect, useMemo, useState } from "react";
import { api, downloadCSV, fmt, fmtDate } from "../api";

function CopyId({ id }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="id-chip"
      title="Copiar ID"
      onClick={() => {
        navigator.clipboard?.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "¡Copiado!" : `ID ${id}`}
    </button>
  );
}

function Comment({ c, isReply }) {
  return (
    <li className={`comment ${isReply ? "reply" : ""}`}>
      <div className="comment-head">
        <b>@{c.username}</b>
        <span className="muted small">{fmtDate(c.timestamp)}</span>
      </div>
      <p>{c.text}</p>
      <div className="comment-foot">
        <span className="small">♥ {fmt(c.like_count)}</span>
        {c.hidden && <span className="small tag">oculto</span>}
        <CopyId id={c.id} />
      </div>
      {c.replies?.length > 0 && (
        <ul className="replies">
          {c.replies.map((r) => <Comment key={r.id} c={r} isReply />)}
        </ul>
      )}
    </li>
  );
}

export default function PostDetail({ id, onClose, repostsAvailable }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setPost(null);
    api.post(id).then(setPost).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!post) return [];
    const q = query.trim().toLowerCase();
    if (!q) return post.comments;
    const match = (c) => c.text?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
    return post.comments.filter((c) => match(c) || c.replies?.some(match));
  }, [post, query]);

  function exportComments() {
    const rows = post.comments.flatMap((c) => [
      { id: c.id, parent_id: "", username: c.username, text: c.text, like_count: c.like_count, timestamp: c.timestamp },
      ...c.replies.map((r) => ({ id: r.id, parent_id: c.id, username: r.username, text: r.text, like_count: r.like_count, timestamp: r.timestamp })),
    ]);
    downloadCSV(`comentarios_${post.id}.csv`, rows);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
        {error && <p className="error-text">{error}</p>}
        {!post && !error && <p className="muted">Cargando publicación…</p>}
        {post && (
          <>
            <img className="panel-img" src={post.thumbnail_url || post.media_url} alt="" />
            <div className="panel-meta">
              <CopyId id={post.id} />
              <a href={post.permalink} target="_blank" rel="noreferrer">Ver en Instagram ↗</a>
            </div>
            <p>{post.caption}</p>
            <p className="muted small">{fmtDate(post.timestamp)}</p>

            <div className="stats compact">
              <div className="stat"><span className="stat-label">Likes</span><span className="stat-value">{fmt(post.like_count)}</span></div>
              <div className="stat"><span className="stat-label">Comentarios</span><span className="stat-value">{fmt(post.comments_count)}</span></div>
              <div className="stat"><span className="stat-label">Reposteos</span><span className="stat-value">{repostsAvailable ? fmt(post.reposts_count) : "N/D"}</span></div>
              {post.shares_count !== null && (
                <div className="stat"><span className="stat-label">Compartidos</span><span className="stat-value">{fmt(post.shares_count)}</span></div>
              )}
            </div>

            <div className="section-head">
              <h3>Comentarios ({post.comments.length})</h3>
              <button className="btn ghost" onClick={exportComments} disabled={!post.comments.length}>CSV</button>
            </div>
            <input
              className="search"
              placeholder="Buscar por texto o usuario…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {filtered.length === 0 ? (
              <p className="muted">Sin comentarios{query && " que coincidan"}.</p>
            ) : (
              <ul className="comments">{filtered.map((c) => <Comment key={c.id} c={c} />)}</ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
