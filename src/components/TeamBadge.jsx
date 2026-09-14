import { teamInfo } from "../lib/teams.js";

export default function TeamBadge({ fullName }) {
  const { code, color } = teamInfo(fullName);
  return (
    <span className="team-cell">
      <span className="team-badge" style={{ background: color }}>
        {code}
      </span>
      <span className="team-full">{fullName ?? "—"}</span>
    </span>
  );
}
