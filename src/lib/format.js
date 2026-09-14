/** "Wed 9/9 5:30p" — compact, Pacific time, single lowercase am/pm letter, no comma. */
export function formatKickoff(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const ampm = get("dayPeriod").toLowerCase().charAt(0);
  return `${get("weekday")} ${get("month")}/${get("day")} ${get("hour")}:${get("minute")}${ampm}`;
}

/** Always one decimal place, so an even number like -6 renders as "-6.0". */
export function formatLine(n) {
  return n == null ? "—" : n.toFixed(1);
}
