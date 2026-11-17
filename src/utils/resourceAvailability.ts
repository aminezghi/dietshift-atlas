/**
 * Standardized classification and human-readable disclosure formatting for
 * missing, Track B-excluded, failed, invalid, or non-applicable datasets.
 */

export type DataAvailabilityCategory =
  | 'excluded_from_distribution'
  | 'network_or_server_error'
  | 'invalid_or_unreadable'
  | 'not_applicable'
  | 'missing_required_input';

export interface TrackBResourceMeta {
  key: string;
  label: string;
  exclusionReason: string;
}

export interface ResourceDisclosure {
  category: DataAvailabilityCategory;
  resourceLabel: string;
  headline: string;
  detail: string;
  availableSummary?: string;
  isExcludedTrackB: boolean;
  isRetryable: boolean;
  statusCode: number | null;
}

const TRACK_B_CATALOG: Record<string, TrackBResourceMeta> = {
  'data/gi_terroir_bundle.json': {
    key: 'gi_terroir_bundle.json',
    label: 'Geographical Indications (EUIPO GIview & Qualigeo) registry',
    exclusionReason:
      'Excluded from the Track A open release archive due to Fondazione Qualivita Qualigeo redistribution restrictions.',
  },
  'gi_terroir_bundle.json': {
    key: 'gi_terroir_bundle.json',
    label: 'Geographical Indications (EUIPO GIview & Qualigeo) registry',
    exclusionReason:
      'Excluded from the Track A open release archive due to Fondazione Qualivita Qualigeo redistribution restrictions.',
  },
  'data/consumer_behavior_pulse.json': {
    key: 'consumer_behavior_pulse.json',
    label: 'Composite Behavioral Discourse & GI Overlay bundle',
    exclusionReason:
      'Excluded from Track A because this composite bundle embeds third-party RSS/Hacker News headlines and restricted Qualigeo records.',
  },
  'consumer_behavior_pulse.json': {
    key: 'consumer_behavior_pulse.json',
    label: 'Composite Behavioral Discourse & GI Overlay bundle',
    exclusionReason:
      'Excluded from Track A because this composite bundle embeds third-party RSS/Hacker News headlines and restricted Qualigeo records.',
  },
  'data/empirical_microdata_bundle.json': {
    key: 'empirical_microdata_bundle.json',
    label: 'Composite Empirical Microdata bundle (MTUS Time-Use & ESS Cultural Inertia)',
    exclusionReason:
      'Excluded from Track A because this composite bundle embeds IPUMS/MTUS restricted extracts and ESS CC BY-NC-SA 4.0 survey data.',
  },
  'empirical_microdata_bundle.json': {
    key: 'empirical_microdata_bundle.json',
    label: 'Composite Empirical Microdata bundle (MTUS Time-Use & ESS Cultural Inertia)',
    exclusionReason:
      'Excluded from Track A because this composite bundle embeds IPUMS/MTUS restricted extracts and ESS CC BY-NC-SA 4.0 survey data.',
  },
  'data/gs1_immagino_bundle.json': {
    key: 'gs1_immagino_bundle.json',
    label: 'GS1 Italy Osservatorio Immagino (19th Ed.) retail dataset',
    exclusionReason:
      'Not included in the Track A open archive because commercial GS1 Italy / NielsenIQ permission is required for redistribution.',
  },
  'gs1_immagino_bundle.json': {
    key: 'gs1_immagino_bundle.json',
    label: 'GS1 Italy Osservatorio Immagino (19th Ed.) retail dataset',
    exclusionReason:
      'Not included in the Track A open archive because commercial GS1 Italy / NielsenIQ permission is required for redistribution.',
  },
  'data/pan_eu_retail_bundle.json': {
    key: 'pan_eu_retail_bundle.json',
    label: 'Pan-EU GS1 Retail Scanner extrapolation dataset',
    exclusionReason:
      'Not included in the Track A open archive because its underlying GS1 Italy reference tables require commercial permission.',
  },
  'pan_eu_retail_bundle.json': {
    key: 'pan_eu_retail_bundle.json',
    label: 'Pan-EU GS1 Retail Scanner extrapolation dataset',
    exclusionReason:
      'Not included in the Track A open archive because its underlying GS1 Italy reference tables require commercial permission.',
  },
  'data/time_use_cooking_friction.json': {
    key: 'time_use_cooking_friction.json',
    label: 'MTUS / IPUMS Time Poverty & Cooking Friction dataset',
    exclusionReason:
      'Not included in Track A due to IPUMS/MTUS terms prohibiting third-party dataset redistribution.',
  },
  'time_use_cooking_friction.json': {
    key: 'time_use_cooking_friction.json',
    label: 'MTUS / IPUMS Time Poverty & Cooking Friction dataset',
    exclusionReason:
      'Not included in Track A due to IPUMS/MTUS terms prohibiting third-party dataset redistribution.',
  },
  'data/cultural_climate_inertia.json': {
    key: 'cultural_climate_inertia.json',
    label: 'ESS ERIC / TISP Cultural & Culinary Inertia dataset',
    exclusionReason:
      'Not included in Track A because ESS ERIC source tables carry a Non-Commercial ShareAlike (CC BY-NC-SA 4.0) restriction.',
  },
  'cultural_climate_inertia.json': {
    key: 'cultural_climate_inertia.json',
    label: 'ESS ERIC / TISP Cultural & Culinary Inertia dataset',
    exclusionReason:
      'Not included in Track A because ESS ERIC source tables carry a Non-Commercial ShareAlike (CC BY-NC-SA 4.0) restriction.',
  },
  gi_terroir_registry: {
    key: 'gi_terroir_registry.parquet',
    label: 'Geographical Indications (gi_terroir_registry) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive due to Fondazione Qualivita Qualigeo redistribution restrictions.',
  },
  gs1_immagino_observatory: {
    key: 'gs1_immagino_observatory.parquet',
    label: 'GS1 Italy Immagino (gs1_immagino_observatory) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive pending GS1 Italy commercial redistribution permission.',
  },
  pan_eu_retail_scanner: {
    key: 'pan_eu_retail_scanner.parquet',
    label: 'Pan-EU Retail Scanner (pan_eu_retail_scanner) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive pending GS1 Italy commercial redistribution permission.',
  },
  time_use_cooking_friction: {
    key: 'time_use_cooking_friction.parquet',
    label: 'Time-Use Cooking Friction (time_use_cooking_friction) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive due to IPUMS/MTUS redistribution restrictions.',
  },
  cultural_climate_inertia: {
    key: 'cultural_climate_inertia.parquet',
    label: 'Cultural Climate Inertia (cultural_climate_inertia) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive under ESS CC BY-NC-SA 4.0 licensing.',
  },
  social_discourse_velocity: {
    key: 'social_discourse_velocity.parquet',
    label: 'Social Discourse Velocity (social_discourse_velocity) Parquet view',
    exclusionReason:
      'Excluded from the Track A open archive due to third-party RSS/Hacker News headline terms.',
  },
};

export const TRACK_B_DUCKDB_VIEWS = new Set<string>([
  'gi_terroir_registry',
  'gs1_immagino_observatory',
  'pan_eu_retail_scanner',
  'time_use_cooking_friction',
  'cultural_climate_inertia',
  'social_discourse_velocity',
]);

export function findTrackBMeta(identifier: string): TrackBResourceMeta | null {
  const normalized = identifier.trim().replace(/^\/+/, '').replace(/\.parquet$/i, '');
  if (TRACK_B_CATALOG[normalized]) return TRACK_B_CATALOG[normalized];
  const base = normalized.split('/').pop() ?? normalized;
  if (TRACK_B_CATALOG[base]) return TRACK_B_CATALOG[base];
  for (const [k, meta] of Object.entries(TRACK_B_CATALOG)) {
    if (normalized.includes(k)) return meta;
  }
  return null;
}

function extractHttpStatus(err: unknown, message: string): number | null {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  const m = /\bHTTP\s+(\d{3})\b/i.exec(message);
  return m ? Number(m[1]) : null;
}

function extractRelativePath(err: unknown, message: string, fallbackPath?: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'relativePath' in err &&
    typeof (err as { relativePath?: unknown }).relativePath === 'string'
  ) {
    return (err as { relativePath: string }).relativePath;
  }
  const m = /\bfor\s+([^\s)]+)/i.exec(message);
  if (m) return m[1];
  return fallbackPath ?? '';
}

export function classifyResourceError(
  err: unknown,
  options?: {
    resourcePath?: string;
    resourceLabel?: string;
    availableSummary?: string;
  }
): ResourceDisclosure {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const statusCode = extractHttpStatus(err, rawMessage);
  const resolvedPath = extractRelativePath(err, rawMessage, options?.resourcePath);
  const fileToken = resolvedPath.split('/').pop() || resolvedPath || options?.resourceLabel || 'dataset resource';
  const trackBMeta = findTrackBMeta(resolvedPath) || (options?.resourcePath ? findTrackBMeta(options.resourcePath) : null);
  const resourceLabel = options?.resourceLabel || trackBMeta?.label || fileToken;

  const isInvalidJson =
    (err instanceof Error && err.name === 'SyntaxError') ||
    Boolean(err && typeof err === 'object' && 'isInvalidJson' in err && (err as { isInvalidJson?: boolean }).isInvalidJson) ||
    /Unexpected token|JSON\.parse|invalid json|Malformed JSON/i.test(rawMessage);

  if (isInvalidJson) {
    return {
      category: 'invalid_or_unreadable',
      resourceLabel,
      headline: `Unreadable or invalid dataset format (${fileToken})`,
      detail: `${resourceLabel} returned malformed or non-JSON data and was rejected without fabricating fallback values.`,
      availableSummary: options?.availableSummary,
      isExcludedTrackB: false,
      isRetryable: true,
      statusCode,
    };
  }

  if (statusCode === 404 && trackBMeta) {
    return {
      category: 'excluded_from_distribution',
      resourceLabel: trackBMeta.label,
      headline: `Dataset not included in this open Track A distribution`,
      detail: `${trackBMeta.label}: ${trackBMeta.exclusionReason} Affected fields remain explicitly absent rather than replaced with synthetic proxies.`,
      availableSummary: options?.availableSummary,
      isExcludedTrackB: true,
      isRetryable: false,
      statusCode: 404,
    };
  }

  if (statusCode === 404) {
    return {
      category: 'missing_required_input',
      resourceLabel,
      headline: `Required resource unavailable (${fileToken})`,
      detail: `${resourceLabel} (${fileToken}) returned HTTP 404 and is currently unavailable for analysis.`,
      availableSummary: options?.availableSummary,
      isExcludedTrackB: false,
      isRetryable: true,
      statusCode: 404,
    };
  }

  const statusTag = statusCode !== null ? ` (HTTP ${statusCode})` : '';
  return {
    category: 'network_or_server_error',
    resourceLabel,
    headline: `Temporary data retrieval error for ${fileToken}${statusTag}`,
    detail: `Could not retrieve ${resourceLabel} (${fileToken}${statusTag}) due to a temporary server or network error. No cached fallback values were substituted.`,
    availableSummary: options?.availableSummary,
    isExcludedTrackB: false,
    isRetryable: true,
    statusCode,
  };
}

export function classifyDuckDBSqlError(err: unknown): ResourceDisclosure {
  const rawMessage = err instanceof Error ? err.message : String(err);

  for (const viewName of TRACK_B_DUCKDB_VIEWS) {
    if (
      new RegExp(`\\b${viewName}(?:\\.parquet)?\\b`, 'i').test(rawMessage) &&
      /(does not exist|Catalog Error|404|HTTP|No files found|Could not open|No magic bytes|Invalid Input Error)/i.test(rawMessage)
    ) {
      const meta = findTrackBMeta(viewName)!;
      return {
        category: 'excluded_from_distribution',
        resourceLabel: meta.label,
        headline: `Query references a dataset omitted from Track A open archive`,
        detail: `${meta.label}: ${meta.exclusionReason}`,
        availableSummary:
          'All 13 Track A open Parquet tables (Agribalyse 3.1, EFSA FoodEx2, Open Food Facts, NSI Quintiles, Eurostat/ONS Forecasts, Poore & Nemecek LCA, World Bank CoHD, Open Prices EU, NHANES, GCNF School Meals, Rosetta Crosswalk, and Classification Mappings) remain queryable.',
        isExcludedTrackB: true,
        isRetryable: false,
        statusCode: 404,
      };
    }
  }

  return {
    category: 'network_or_server_error',
    resourceLabel: 'DuckDB SQL query execution',
    headline: 'SQL query could not be completed',
    detail: rawMessage.split('\n')[0] || 'Query failed against browser DuckDB-Wasm engine.',
    isExcludedTrackB: false,
    isRetryable: true,
    statusCode: null,
  };
}
