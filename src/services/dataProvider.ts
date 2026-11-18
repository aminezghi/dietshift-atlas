import { assetUrl } from '../utils/assetPath';
import type { AgribalyseItem, LiveResearchBundle } from '../types/research';

/**
 * Shared browser session asset cache & in-flight request deduplicator (Phase 5B M-01 / H-06 / L-01).
 * Ensures each static JSON asset is fetched over HTTP at most once per session unless explicitly retried,
 * deduplicates overlapping GI records between gi_terroir_bundle and consumer_behavior_pulse,
 * and drops the legacy 500-item Agribalyse slice inside live_research_bundle in favor of full 2,451 items.
 */

interface CacheEntry<T> {
  data?: T;
  promise?: Promise<T>;
  error?: string;
}

const assetCache = new Map<string, CacheEntry<unknown>>();
let networkFetchCount = 0;
let cacheHitCount = 0;
let inFlightDedupCount = 0;

export interface DataProviderStats {
  cachedPaths: string[];
  networkFetchCount: number;
  cacheHitCount: number;
  inFlightDedupCount: number;
}

export function getDataProviderStats(): DataProviderStats {
  return {
    cachedPaths: Array.from(assetCache.entries())
      .filter(([, e]) => e.data !== undefined)
      .map(([k]) => k)
      .sort(),
    networkFetchCount,
    cacheHitCount,
    inFlightDedupCount,
  };
}

export function clearDataProviderCache(): void {
  assetCache.clear();
  networkFetchCount = 0;
  cacheHitCount = 0;
  inFlightDedupCount = 0;
}

export function invalidateCachedAsset(relativePath: string): void {
  assetCache.delete(relativePath);
}

export class DataFetchError extends Error {
  readonly status: number | null;
  readonly relativePath: string;
  readonly isInvalidJson: boolean;

  constructor(
    message: string,
    options: { status?: number | null; relativePath: string; isInvalidJson?: boolean }
  ) {
    super(message);
    this.name = 'DataFetchError';
    this.status = options.status ?? null;
    this.relativePath = options.relativePath;
    this.isInvalidJson = Boolean(options.isInvalidJson);
  }
}

export async function fetchCachedJson<T>(
  relativePath: string,
  options?: { forceRetry?: boolean }
): Promise<T> {
  if (options?.forceRetry) {
    assetCache.delete(relativePath);
  }

  const existing = assetCache.get(relativePath) as CacheEntry<T> | undefined;
  if (existing?.data !== undefined) {
    cacheHitCount += 1;
    return existing.data;
  }
  if (existing?.promise) {
    inFlightDedupCount += 1;
    return existing.promise;
  }

  const entry: CacheEntry<T> = {};
  networkFetchCount += 1;
  const url = assetUrl(relativePath);

  const reqPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new DataFetchError(
          `HTTP ${res.status} (${res.statusText || 'Fetch failed'}) for ${relativePath}`,
          { status: res.status, relativePath }
        );
      }
      const contentType = res.headers?.get?.('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('text/html')) {
        throw new DataFetchError(
          `HTTP 404 (HTML fallback returned; resource absent) for ${relativePath}`,
          { status: 404, relativePath }
        );
      }
      try {
        return (await res.json()) as T;
      } catch (parseErr: unknown) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        throw new DataFetchError(
          `Invalid JSON for ${relativePath}: ${parseMsg}`,
          { status: res.status, relativePath, isInvalidJson: true }
        );
      }
    })
    .then((parsed) => {
      entry.data = parsed;
      delete entry.promise;
      delete entry.error;
      return parsed;
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      entry.error = msg;
      delete entry.promise;
      assetCache.delete(relativePath);
      if (err instanceof DataFetchError) {
        throw err;
      }
      throw new DataFetchError(msg, { relativePath });
    });

  entry.promise = reqPromise;
  assetCache.set(relativePath, entry as CacheEntry<unknown>);
  return reqPromise;
}

export interface GiTerroirBundleShape<R = object, S = object> {
  generated_at?: string;
  total_gi_records?: number;
  gi_total_count?: number;
  giview_official_count?: number;
  qualigeo_official_count?: number;
  gi_country_summary?: S[];
  gi_terroir_records?: R[];
}

/**
 * Loads gi_terroir_bundle.json ONCE across Overview Map, Environment Panel,
 * Sensitivity Lab, Integrated Robustness, and Consumer Behavior Pulse.
 * If consumer_behavior_pulse.json was already loaded, reuses its identical 6,845 GI records directly.
 */
export async function fetchGiTerroirBundle<T extends GiTerroirBundleShape<object, object> = GiTerroirBundleShape>(
  options?: { forceRetry?: boolean }
): Promise<T> {
  if (!options?.forceRetry) {
    const pulseCached = assetCache.get('data/consumer_behavior_pulse.json')?.data as
      | GiTerroirBundleShape
      | undefined;
    if (pulseCached?.gi_terroir_records?.length && !assetCache.get('data/gi_terroir_bundle.json')?.data) {
      const derived: GiTerroirBundleShape = {
        generated_at: pulseCached.generated_at,
        total_gi_records: pulseCached.gi_total_count ?? pulseCached.gi_terroir_records.length,
        giview_official_count: pulseCached.giview_official_count,
        qualigeo_official_count: pulseCached.qualigeo_official_count,
        gi_country_summary: pulseCached.gi_country_summary ?? [],
        gi_terroir_records: pulseCached.gi_terroir_records,
      };
      assetCache.set('data/gi_terroir_bundle.json', { data: derived });
      cacheHitCount += 1;
      return derived as T;
    }
  }
  return fetchCachedJson<T>('data/gi_terroir_bundle.json', options);
}

/**
 * Loads consumer_behavior_pulse.json once and deduplicates its embedded 6,845 GI array
 * against the already-cached gi_terroir_bundle reference when present to avoid heap duplication.
 */
export async function fetchConsumerBehaviorPulse<T extends GiTerroirBundleShape<object, object>>(
  options?: { forceRetry?: boolean }
): Promise<T> {
  const pulse = await fetchCachedJson<T>('data/consumer_behavior_pulse.json', options);
  const giCached = assetCache.get('data/gi_terroir_bundle.json')?.data as GiTerroirBundleShape | undefined;
  if (
    giCached?.gi_terroir_records &&
    pulse.gi_terroir_records &&
    giCached.gi_terroir_records.length === pulse.gi_terroir_records.length
  ) {
    // Share identical immutable reference in memory instead of holding two 6,845-element allocations
    pulse.gi_terroir_records = giCached.gi_terroir_records;
  } else if (pulse.gi_terroir_records?.length && !giCached) {
    assetCache.set('data/gi_terroir_bundle.json', {
      data: {
        generated_at: pulse.generated_at,
        total_gi_records: pulse.gi_total_count ?? pulse.gi_terroir_records.length,
        giview_official_count: pulseCachedFallback(pulse).giview_official_count,
        qualigeo_official_count: pulseCachedFallback(pulse).qualigeo_official_count,
        gi_country_summary: pulse.gi_country_summary ?? [],
        gi_terroir_records: pulse.gi_terroir_records,
      },
    });
  }
  return pulse;
}

function pulseCachedFallback(p: GiTerroirBundleShape<object, object>): GiTerroirBundleShape<object, object> {
  return p;
}

/**
 * Loads live_research_bundle.json while discarding its deprecated 500-item Agribalyse preview slice
 * so all consumers strictly use full 2,451-row agribalyse_full.json (H-06).
 */
export async function fetchLiveResearchBundle(
  options?: { forceRetry?: boolean }
): Promise<LiveResearchBundle> {
  const bundle = await fetchCachedJson<LiveResearchBundle>('data/live_research_bundle.json', options);
  if (Array.isArray(bundle.agribalyse) && bundle.agribalyse.length > 0 && bundle.agribalyse.length < 2451) {
    return {
      ...bundle,
      agribalyse: [], // Prevent silent fallback to truncated 500-item preview slice
    };
  }
  return bundle;
}

export async function fetchFullAgribalyse(
  options?: { forceRetry?: boolean }
): Promise<AgribalyseItem[]> {
  return fetchCachedJson<AgribalyseItem[]>('data/agribalyse_full.json', options);
}

export async function fetchGiStatutoryZones<T = unknown>(
  options?: { forceRetry?: boolean }
): Promise<T> {
  return fetchCachedJson<T>('data/gi_statutory_zones.json', options);
}
