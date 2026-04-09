import {
  format,
  parseISO,
  isValid,
  isThisYear,
  isFuture,
  isToday,
  isYesterday,
  differenceInDays,
  differenceInHours,
  formatDistanceToNowStrict,
} from "date-fns";

function parse(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    // TMDB dates are "YYYY-MM-DD" — parseISO treats them as local midnight
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/** "Apr 9, 2026" — always shows year */
export function formatReleaseDate(dateStr: string | undefined | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  return format(d, "MMM d, yyyy");
}

/** Just the 4-digit year */
export function formatYear(dateStr: string | undefined | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  return format(d, "yyyy");
}

/**
 * Smart label — picks the most human-readable label for a release date
 * relative to today (April 9, 2026 at time of build, always dynamic).
 *
 * Future:
 *   within 7 days  → "Coming Apr 10"
 *   beyond 7 days  → "Coming Apr 30"
 *
 * Past:
 *   today           → "New Today"
 *   yesterday       → "New Yesterday"
 *   2–6 days ago    → "Released 3 days ago"
 *   7–29 days ago   → "Released 2 weeks ago"
 *   30–364 days ago → "Apr 9" (month + day, same year)
 *   older           → "2024" (just the year)
 */
export function smartReleaseLabel(dateStr: string | undefined | null): string {
  const d = parse(dateStr);
  if (!d) return "";

  if (isFuture(d)) {
    return `Coming ${format(d, "MMM d")}`;
  }

  if (isToday(d)) return "New Today";
  if (isYesterday(d)) return "New Yesterday";

  const daysAgo = differenceInDays(new Date(), d);

  if (daysAgo < 7) {
    return `Released ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
  }

  if (daysAgo < 30) {
    const weeks = Math.floor(daysAgo / 7);
    return `Released ${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }

  if (isThisYear(d)) {
    return format(d, "MMM d");
  }

  return format(d, "yyyy");
}

/** Episode air date: "Apr 9, 2026" or "Upcoming" if in future */
export function formatAirDate(dateStr: string | undefined | null): string {
  const d = parse(dateStr);
  if (!d) return "";
  if (isFuture(d)) return "Upcoming";
  if (isToday(d)) return "Today";
  return format(d, "MMM d, yyyy");
}

/** Returns true if the date is in the future and within N days */
export function isComingSoon(dateStr: string | undefined | null, withinDays = 90): boolean {
  const d = parse(dateStr);
  if (!d || !isFuture(d)) return false;
  return differenceInDays(d, new Date()) <= withinDays;
}
