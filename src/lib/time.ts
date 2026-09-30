export function timeAgo(date: Date, now = Date.now()) {
  const s = Math.round((now - date.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
