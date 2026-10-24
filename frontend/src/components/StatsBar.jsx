import { fmt } from "../api";

export default function StatsBar({ loaded, total, totals, repostsAvailable }) {
  const items = [
    { label: "Likes", value: fmt(totals.likes) },
    { label: "Comentarios", value: fmt(totals.comments) },
    { label: "Reposteos", value: repostsAvailable ? fmt(totals.reposts) : "No disponible" },
    { label: "Publicaciones cargadas", value: `${loaded}${total ? ` / ${total}` : ""}` },
  ];
  return (
    <section className="stats">
      {items.map((i) => (
        <div key={i.label} className="stat">
          <span className="stat-label">{i.label}</span>
          <span className="stat-value">{i.value}</span>
        </div>
      ))}
      <p className="muted small stats-note">Totales sobre las publicaciones cargadas.</p>
    </section>
  );
}
