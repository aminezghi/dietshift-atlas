export type DataTier = 'raw' | 'processed' | 'harmonized' | 'analytical' | 'forecast';

export type DataNature =
  | 'Observed'
  | 'Estimated'
  | 'Model Output'
  | 'Forecast'
  | 'Simulated'
  | 'Manually Compiled';

export type UpdatePolicy =
  | 'auto_api'
  | 'manual'
  | 'static_reference'
  | 'credentials_required'
  | 'archived';

export interface DatasetSchemaColumn {
  name: string;
  type: string;
  null_count: number;
  null_pct: number;
}

export interface DatasetIssue {
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  file_path: string;
  view_name: string;
  tier: DataTier;
  data_nature: DataNature;
  update_policy: UpdatePolicy;
  update_cadence: string;
  source_name: string;
  source_urls: string[];
  license: string;
  retrieved_at: string;
  version: string;
  geographic_coverage: string;
  temporal_coverage: string;
  primary_key: string[];
  limitations: string;
  record_count: number;
  column_count: number;
  bytes: number;
  sha256: string;
  freshness_days: number;
  missingness_pct: number;
  duplicate_key_count: number;
  validation_status: 'pass' | 'warn' | 'fail';
  issues: DatasetIssue[];
  schema: DatasetSchemaColumn[];
}

export interface DatasetsRegistry {
  schema_version: string;
  generated_at_utc: string;
  total_datasets: number;
  total_records: number;
  total_bytes: number;
  summary_by_tier: Record<DataTier, number>;
  summary_by_nature: Record<DataNature, number>;
  validation_summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  version_diff: Array<{
    table: string;
    change: 'added' | 'updated' | 'removed';
    rows_before?: number;
    rows_after?: number;
    sha256_changed?: boolean;
  }>;
  datasets: DatasetMetadata[];
}

/**
 * Resolves authoritative data_nature from datasets_registry.json when loaded,
 * falling back to explicit typed classification only before registry fetch completes.
 */
export function resolveDatasetNature(
  registry: DatasetsRegistry | null | undefined,
  datasetId: string,
  fallback: DataNature
): DataNature {
  const match = registry?.datasets?.find((d) => d.id === datasetId);
  return match?.data_nature ?? fallback;
}
