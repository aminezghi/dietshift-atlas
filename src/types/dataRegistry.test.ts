import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { type DatasetsRegistry, resolveDatasetNature } from './dataRegistry';

describe('datasets_registry.json contract', () => {
  it('validates all 19 registered datasets with pass status, aligned data_nature, and resolver checks', () => {
    const registryPath = path.resolve(process.cwd(), 'public/data/datasets_registry.json');
    const raw = fs.readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(raw) as DatasetsRegistry;

    expect(registry.total_datasets).toBe(19);
    expect(registry.validation_summary.fail).toBe(0);
    expect(registry.datasets.length).toBe(19);

    for (const ds of registry.datasets) {
      expect(ds.record_count).toBeGreaterThan(0);
      expect(ds.validation_status).toBe('pass');
      expect(['Observed', 'Estimated', 'Model Output', 'Forecast', 'Simulated', 'Manually Compiled']).toContain(
        ds.data_nature
      );
    }

    // H-01 & H-03: Registry classifications match analytical engine contracts
    expect(resolveDatasetNature(registry, 'agribalyse_31', 'Estimated')).toBe('Model Output');
    expect(resolveDatasetNature(registry, 'global_poore_nemecek_lca', 'Model Output')).toBe('Estimated');
    expect(resolveDatasetNature(registry, 'clinical_biomarker_grounding', 'Observed')).toBe('Estimated');
    expect(resolveDatasetNature(registry, 'openfoodfacts_eu', 'Estimated')).toBe('Observed');
    expect(resolveDatasetNature(registry, 'statistical_price_forecasts', 'Observed')).toBe('Forecast');
    expect(resolveDatasetNature(null, 'agribalyse_31', 'Model Output')).toBe('Model Output');
  });
});
