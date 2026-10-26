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

function Comment({ c, isReply, onToggleHidden, onDelete }) {
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
        <button className="btn ghost small" onClick={() => onToggleHidden(c)}>
          {c.hidden ? "Mostrar" : "Ocultar"}
        </button>
        <button className="btn ghost small" onClick={() => onDelete(c)}>Eliminar</button>
      </div>
      {c.replies?.length > 0 && (
        <ul className="replies">
          {c.replies.map((r) => (
            <Comment key={r.id} c={r} isReply onToggleHidden={onToggleHidden} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Aplica `change` al comentario con ese id (sea de primer nivel o respuesta)
const patchComment = (list, id, change) =>
  list.map((c) =>
    c.id === id ? { ...c, ...change } : { ...c, replies: c.replies?.map((r) => (r.id === id ? { ...r, ...change } : r)) }
  );

// Quita el comentario (y sus respuestas si es de primer nivel)
const removeComment = (list, id) =>
  list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies?.filter((r) => r.id !== id) }));

const countWithReplies = (list, id) => {
  const top = list.find((c) => c.id === id);
  return top ? 1 + (top.replies?.length ?? 0) : 1;
};

export default function PostDetail({ id, onClose, repostsAvailable }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setError(null);
    api.post(id).then((p) => !cancelled && setPost(p)).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setComments([]);
    setCursor(null);
    setCommentsError(null);
    setActionError(null);
    setLoadingComments(true);
    api.comments(id)
      .then((page) => {
        if (cancelled) return;
        setComments(page.data);
        setCursor(page.next_cursor);
      })
      .catch((e) => !cancelled && setCommentsError(e.message))
      .finally(() => !cancelled && setLoadingComments(false));
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadMoreComments() {
    setLoadingComments(true);
    setCommentsError(null);
    try {
      const page = await api.comments(id, cursor);
      setComments((prev) => [...prev, ...page.data]);
      setCursor(page.next_cursor);
    } catch (e) {
      setCommentsError(e.message);
    } finally {
      setLoadingComments(false);
    }
  }

  // Optimista: se refleja al instante y se revierte si Instagram rechaza la acción
  async function toggleHidden(comment) {
    const hidden = !comment.hidden;
    setActionError(null);
    setComments((prev) => patchComment(prev, comment.id, { hidden }));
    try {
      await api.hideComment(comment.id, hidden);
    } catch (e) {
      setComments((prev) => patchComment(prev, comment.id, { hidden: comment.hidden }));
      setActionError(e.message);
    }
  }

  // Eliminar es irreversible: se espera la confirmación de Instagram antes de quitarlo de la UI
  async function deleteComment(comment) {
    const hasReplies = comment.replies?.length > 0;
    const warning = hasReplies ? " También se eliminarán sus respuestas." : "";
    if (!window.confirm(`¿Eliminar el comentario de @${comment.username}? No se puede deshacer.${warning}`)) return;
    setActionError(null);
    try {
      await api.deleteComment(comment.id);
      const removed = countWithReplies(comments, comment.id);
      setComments((prev) => removeComment(prev, comment.id));
      setPost((prev) => prev && prev.comments_count !== null
        ? { ...prev, comments_count: Math.max(0, prev.comments_count - removed) }
        : prev);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function toggleCommentsEnabled() {
    const enabled = !post.is_comment_enabled;
    setActionError(null);
    try {
      await api.setCommentsEnabled(post.id, enabled);
      setPost((prev) => ({ ...prev, is_comment_enabled: enabled }));
    } catch (e) {
      setActionError(e.message);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comments;
    const match = (c) => c.text?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
    return comments.filter((c) => match(c) || c.replies?.some(match));
  }, [comments, query]);

  function exportComments() {
    const rows = comments.flatMap((c) => [
      { id: c.id, parent_id: "", username: c.username, text: c.text, like_count: c.like_count, hidden: c.hidden, timestamp: c.timestamp },
      ...c.replies.map((r) => ({ id: r.id, parent_id: c.id, username: r.username, text: r.text, like_count: r.like_count, hidden: r.hidden, timestamp: r.timestamp })),
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
              <h3>Comentarios ({fmt(post.comments_count ?? comments.length)})</h3>
              <div>
                {typeof post.is_comment_enabled === "boolean" && (
                  <button className="btn ghost" onClick={toggleCommentsEnabled}>
                    {post.is_comment_enabled ? "Desactivar comentarios" : "Activar comentarios"}
                  </button>
                )}{" "}
                <button className="btn ghost" onClick={exportComments} disabled={!comments.length}>CSV</button>
              </div>
            </div>
            {actionError && <p className="error-text">{actionError}</p>}
            <input
              className="search"
              placeholder="Buscar por texto o usuario…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {filtered.length === 0 && !loadingComments ? (
              <p className="muted">Sin comentarios{query && " que coincidan"}.</p>
            ) : (
              <ul className="comments">
                {filtered.map((c) => (
                  <Comment key={c.id} c={c} onToggleHidden={toggleHidden} onDelete={deleteComment} />
                ))}
              </ul>
            )}
            <div className="center">
              {loadingComments && <p className="muted">Cargando comentarios…</p>}
              {commentsError && <p className="error-text">{commentsError}</p>}
              {!loadingComments && cursor && <button className="btn" onClick={loadMoreComments}>Cargar más comentarios</button>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
