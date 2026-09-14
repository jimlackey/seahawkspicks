// Team codes + primary brand color (a plain fact, not copyrighted
// artwork) used to render a compact colored badge in place of a logo —
// see PickRow.jsx's TeamBadge. Real logo images are intentionally not
// used here; add your own image assets later if you want them instead.
const TEAM_INFO = {
  "Arizona Cardinals": { code: "ARI", color: "#97233F" },
  "Atlanta Falcons": { code: "ATL", color: "#A71930" },
  "Baltimore Ravens": { code: "BAL", color: "#241773" },
  "Buffalo Bills": { code: "BUF", color: "#00338D" },
  "Carolina Panthers": { code: "CAR", color: "#0085CA" },
  "Chicago Bears": { code: "CHI", color: "#0B162A" },
  "Cincinnati Bengals": { code: "CIN", color: "#FB4F14" },
  "Cleveland Browns": { code: "CLE", color: "#492A13" },
  "Dallas Cowboys": { code: "DAL", color: "#003594" },
  "Denver Broncos": { code: "DEN", color: "#FB4F14" },
  "Detroit Lions": { code: "DET", color: "#0076B6" },
  "Green Bay Packers": { code: "GB", color: "#203731" },
  "Houston Texans": { code: "HOU", color: "#03202F" },
  "Indianapolis Colts": { code: "IND", color: "#002C5F" },
  "Jacksonville Jaguars": { code: "JAX", color: "#006778" },
  "Kansas City Chiefs": { code: "KC", color: "#E31837" },
  "Las Vegas Raiders": { code: "LV", color: "#000000" },
  "Los Angeles Chargers": { code: "LAC", color: "#0080C6" },
  "Los Angeles Rams": { code: "LAR", color: "#003594" },
  "Miami Dolphins": { code: "MIA", color: "#008E97" },
  "Minnesota Vikings": { code: "MIN", color: "#4F2683" },
  "New England Patriots": { code: "NE", color: "#002244" },
  "New Orleans Saints": { code: "NO", color: "#9F8449" },
  "New York Giants": { code: "NYG", color: "#0B2265" },
  "New York Jets": { code: "NYJ", color: "#125740" },
  "Philadelphia Eagles": { code: "PHI", color: "#004C54" },
  "Pittsburgh Steelers": { code: "PIT", color: "#8a6d16" },
  "Seattle Seahawks": { code: "SEA", color: "#69BE28" },
  "San Francisco 49ers": { code: "SF", color: "#AA0000" },
  "Tampa Bay Buccaneers": { code: "TB", color: "#D50A0A" },
  "Tennessee Titans": { code: "TEN", color: "#0C2340" },
  "Washington Commanders": { code: "WAS", color: "#5A1414" },
};

const FALLBACK = { color: "#7a7a7a" };

/** Falls back to the first 3 letters (uppercased) + neutral grey for any unmapped name. */
export function teamInfo(fullName) {
  if (!fullName) return { code: "—", color: FALLBACK.color };
  return TEAM_INFO[fullName] ?? { code: fullName.slice(0, 3).toUpperCase(), color: FALLBACK.color };
}
