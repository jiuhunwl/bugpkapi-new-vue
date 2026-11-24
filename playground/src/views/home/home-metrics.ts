import type { HomeApi } from '#/api/home';

/** The homepage traffic metrics whose value depends on the rollup pipeline. */
export const HOME_STAT_FIELDS = [
  'enabledApiTotal',
  'calls24h',
  'availabilityPercent',
  'peakQps24h',
] as const;

export type HomeStatField = (typeof HOME_STAT_FIELDS)[number];

export interface HomeStatAvailability {
  /** False when the backend refused to certify any traffic metric. */
  analyticsReady: boolean;
  available: Record<HomeStatField, boolean>;
  unavailable: HomeStatField[];
}

/**
 * Resolves which homepage traffic metrics the backend actually certified.
 *
 * The overview answers with a truth envelope: `analyticsReady` plus the exact
 * `unavailableFields` list. A metric the backend could not measure — because
 * the rollup worker is disabled, the snapshot has not been primed, or the
 * aggregation stalled — must render as unavailable rather than as a real zero.
 *
 * The named list is authoritative, because the backend degrades only the fields
 * derived from call traffic and keeps the live counters (`enabledApiTotal`)
 * trustworthy. A `false` verdict with no names at all carries no detail, so it
 * degrades every metric, matching the admin workbench fallback. A response from
 * a backend that predates the envelope keeps working, since `analyticsReady` is
 * read as "not explicitly false" and the list is then empty.
 */
export function resolveHomeStatAvailability(
  stats?: HomeApi.PlatformStats,
): HomeStatAvailability {
  const analyticsReady = stats?.analyticsReady !== false;
  const listed = new Set<string>(stats?.unavailableFields ?? []);
  const degradeAll = !analyticsReady && listed.size === 0;
  const available = {} as Record<HomeStatField, boolean>;
  const unavailable: HomeStatField[] = [];
  for (const field of HOME_STAT_FIELDS) {
    const ok = !(degradeAll || listed.has(field));
    available[field] = ok;
    if (!ok) unavailable.push(field);
  }
  return { analyticsReady, available, unavailable };
}

/**
 * Downgrades a metric to "no value" unless the backend certified it. Returning
 * `undefined` is what lets the view fall back to its placeholder; a certified
 * zero still returns `0` and is rendered as a real zero.
 */
export function certifyHomeStatValue(
  field: HomeStatField,
  value: number | string | undefined,
  availability: HomeStatAvailability,
): number | string | undefined {
  return availability.available[field] ? value : undefined;
}

/** Converts a metric into a finite number, or undefined when it carries none. */
export function numericHomeStat(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
