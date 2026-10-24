import { fmt, fmtDate } from "../api";

const TYPE_LABEL = { IMAGE: "Imagen", VIDEO: "Video", CAROUSEL_ALBUM: "Carrusel" };

export default function PostGrid({ posts, onSelect, repostsAvailable }) {
  if (!posts.length) return <p className="muted">No hay publicaciones.</p>;
  return (
    <div className="grid">
      {posts.map((p) => (
        <button key={p.id} className="card" onClick={() => onSelect(p.id)}>
          <div className="thumb">
            <img src={p.thumbnail_url || p.media_url} alt="" loading="lazy" />
            <span className="badge">{TYPE_LABEL[p.media_type] || p.media_type}</span>
          </div>
          <div className="card-body">
            <p className="caption">{p.caption || <span className="muted">Sin descripción</span>}</p>
            <div className="metrics">
              <span title="Likes">♥ {fmt(p.like_count)}</span>
              <span title="Comentarios">💬 {fmt(p.comments_count)}</span>
              {repostsAvailable && <span title="Reposteos">⟲ {fmt(p.reposts_count)}</span>}
            </div>
            <p className="muted small">{fmtDate(p.timestamp)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
