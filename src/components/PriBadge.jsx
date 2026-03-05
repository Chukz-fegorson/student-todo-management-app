export default function PriBadge({ p }) {
  const classByPriority = {
    Low: "badge-pri-low",
    Medium: "badge-pri-medium",
    High: "badge-pri-high",
  };

  return <span className={`badge ${classByPriority[p] || "badge-pri-medium"}`}>{p || "Medium"}</span>;
}
