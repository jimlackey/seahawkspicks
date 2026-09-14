const BASE_TABS = [
  { id: "picks", label: "Picks" },
  { id: "results", label: "Results" },
  { id: "standings", label: "Standings" },
];

export default function TabBar({ active, onChange, isAdmin }) {
  const tabs = isAdmin ? [...BASE_TABS, { id: "admin", label: "Admin" }] : BASE_TABS;
  return (
    <nav className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={t.id === active ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
