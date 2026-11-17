import { describe, expect, it } from 'vitest';
import { DataFetchError } from '../services/dataProvider';
import { classifyDuckDBSqlError, classifyResourceError } from './resourceAvailability';

describe('WP4 resourceAvailability error classification', () => {
  it('classifies HTTP 404 on Track B bundles as excluded_from_distribution without Retry button', () => {
    const err = new DataFetchError('HTTP 404 (Not Found) for data/gi_terroir_bundle.json', {
      status: 404,
      relativePath: 'data/gi_terroir_bundle.json',
    });
    const res = classifyResourceError(err, {
      availableSummary: 'Poore & Nemecek and Agribalyse remain active.',
    });

    expect(res.category).toBe('excluded_from_distribution');
    expect(res.isExcludedTrackB).toBe(true);
    expect(res.isRetryable).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.detail).toMatch(/Qualigeo/i);
    expect(res.availableSummary).toContain('Poore & Nemecek');
  });

  it('distinguishes HTTP 500 on the same resource as transient network_or_server_error (retryable)', () => {
    const err = new DataFetchError('HTTP 500 (Internal Server Error) for data/gi_terroir_bundle.json', {
      status: 500,
      relativePath: 'data/gi_terroir_bundle.json',
    });
    const res = classifyResourceError(err);

    expect(res.category).toBe('network_or_server_error');
    expect(res.isExcludedTrackB).toBe(false);
    expect(res.isRetryable).toBe(true);
    expect(res.statusCode).toBe(500);
    expect(res.headline).toContain('gi_terroir_bundle.json');
  });

  it('preserves required filename tokens in network errors such as global_benchmarks.json', () => {
    const res = classifyResourceError(
      new Error('HTTP 502 (Bad Gateway) for data/global_benchmarks.json')
    );

    expect(res.category).toBe('network_or_server_error');
    expect(res.isRetryable).toBe(true);
    expect(res.detail).toContain('global_benchmarks.json');
  });

  it('detects malformed JSON errors as invalid_or_unreadable', () => {
    const err = new DataFetchError('Invalid JSON for data/classification_mappings.json: Unexpected token <', {
      status: 200,
      relativePath: 'data/classification_mappings.json',
      isInvalidJson: true,
    });
    const res = classifyResourceError(err);

    expect(res.category).toBe('invalid_or_unreadable');
    expect(res.isRetryable).toBe(true);
  });

  it('classifies HTTP 404 on required Track A core assets as missing_required_input', () => {
    const err = new DataFetchError('HTTP 404 (Not Found) for data/classification_mappings.json', {
      status: 404,
      relativePath: 'data/classification_mappings.json',
    });
    const res = classifyResourceError(err);

    expect(res.category).toBe('missing_required_input');
    expect(res.isExcludedTrackB).toBe(false);
    expect(res.isRetryable).toBe(true);
  });

  it('classifies DuckDB missing Track B Parquet view queries cleanly', () => {
    const sqlErr = new Error('Catalog Error: Table with name gi_terroir_registry does not exist!');
    const res = classifyDuckDBSqlError(sqlErr);

    expect(res.category).toBe('excluded_from_distribution');
    expect(res.isExcludedTrackB).toBe(true);
    expect(res.isRetryable).toBe(false);
    expect(res.detail).toContain('Qualigeo');
  });
});
