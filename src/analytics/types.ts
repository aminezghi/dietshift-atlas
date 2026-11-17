export type DataNature =
  | 'Observed'
  | 'Estimated'
  | 'Model Output'
  | 'Forecast'
  | 'Simulated'
  | 'Manually Compiled';

export interface AnalyticalProvenance {
  module: string;
  version: string;
  dataNature: DataNature | 'Mixed';
  sources: string[];
  assumptions: string[];
}

export interface MissingnessStats {
  totalRecords: number;
  includedRecords: number;
  missingOrExcludedRecords: number;
}

export interface AnalyticalResult<T> {
  data: T;
  unit: string;
  provenance: AnalyticalProvenance;
  missingness: MissingnessStats;
}
