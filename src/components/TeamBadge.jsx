import { teamInfo } from "../lib/teams.js";

export default function TeamBadge({ fullName, compact }) {
  const { code, color } = teamInfo(fullName);
  if (compact) {
    return (
      <span className="team-badge" style={{ background: color }}>
        {code}
      </span>
    );
  }
  return (
    <span className="team-cell">
      <span className="team-badge" style={{ background: color }}>
        {code}
      </span>
      <span className="team-full">{fullName ?? "—"}</span>
    </span>
  );
}
