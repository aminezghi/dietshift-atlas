import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDataProviderCache,
  fetchCachedJson,
  fetchConsumerBehaviorPulse,
  fetchGiTerroirBundle,
  fetchLiveResearchBundle,
  getDataProviderStats,
} from './dataProvider';
import { escapeCsvCell, serializeCsvTable } from '../utils/exportDownload';

describe('Phase 5B dataProvider & exportDownload reliability suite', () => {
  beforeEach(() => {
    clearDataProviderCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent in-flight requests and caches resolved JSON across calls (M-01)', async () => {
    let calls = 0;
    const payload = { ok: true, rows: [1, 2, 3] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 15));
        return new Response(JSON.stringify(payload), { status: 200 });
      })
    );

    const [a, b] = await Promise.all([
      fetchCachedJson<typeof payload>('data/global_benchmarks.json'),
      fetchCachedJson<typeof payload>('data/global_benchmarks.json'),
    ]);
    const c = await fetchCachedJson<typeof payload>('data/global_benchmarks.json');

    expect(calls).toBe(1);
    expect(a).toEqual(payload);
    expect(b).toBe(a);
    expect(c).toBe(a);

    const stats = getDataProviderStats();
    expect(stats.networkFetchCount).toBe(1);
    expect(stats.inFlightDedupCount).toBe(1);
    expect(stats.cacheHitCount).toBe(1);
    expect(stats.cachedPaths).toContain('data/global_benchmarks.json');
  });

  it('does not cache failed HTTP responses and recovers cleanly on retry (L-01)', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          return new Response('Server Error', { status: 500, statusText: 'Internal Server Error' });
        }
        return new Response(JSON.stringify({ recovered: true }), { status: 200 });
      })
    );

    await expect(fetchCachedJson('data/classification_mappings.json')).rejects.toThrow(/HTTP 500/);
    expect(getDataProviderStats().cachedPaths).not.toContain('data/classification_mappings.json');

    const retried = await fetchCachedJson<{ recovered: boolean }>('data/classification_mappings.json');
    expect(retried.recovered).toBe(true);
    expect(attempt).toBe(2);
  });

  it('reuses identical 6,845-row GI array between consumer_behavior_pulse and gi_terroir_bundle (M-01)', async () => {
    const sharedRows = Array.from({ length: 10 }, (_, idx) => ({ gi_id: `GI-${idx}` }));
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('gi_terroir_bundle.json')) {
        return new Response(JSON.stringify({ total_gi_records: 10, gi_terroir_records: sharedRows }), { status: 200 });
      }
      if (url.includes('consumer_behavior_pulse.json')) {
        return new Response(
          JSON.stringify({
            generated_at: '2026-01-01',
            gi_total_count: 10,
            gi_terroir_records: sharedRows.map((r) => ({ ...r })),
            country_behavior_profiles: [],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const giBundle = await fetchGiTerroirBundle();
    const pulse = await fetchConsumerBehaviorPulse();
    expect(pulse.gi_terroir_records).toBe(giBundle.gi_terroir_records);

    // Reverse load order: loading pulse first satisfies gi_terroir_bundle with zero second HTTP call
    clearDataProviderCache();
    fetchMock.mockClear();
    const pulse2 = await fetchConsumerBehaviorPulse();
    const giFromPulse = await fetchGiTerroirBundle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(giFromPulse.gi_terroir_records).toBe(pulse2.gi_terroir_records);
  });

  it('strips deprecated 500-item agribalyse preview slice from live_research_bundle (H-06)', async () => {
    const truncated = Array.from({ length: 500 }, (_, i) => ({ Code_AGB: `AGB-${i}` }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            metadata: { note: 'test' },
            agribalyse_count: 500,
            agribalyse: truncated,
            openfoodfacts: [],
            eurostat: {},
            openalex: {},
            efsa_surveys: [],
          }),
          { status: 200 }
        )
      )
    );

    const cleaned = await fetchLiveResearchBundle();
    expect(cleaned.agribalyse).toEqual([]);
  });

  it('escapes commas, double quotes, linebreaks, and nulls consistently in shared CSV serializer (M-05)', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');

    const csv = serializeCsvTable(
      ['Code', 'Description', 'Notes'],
      [['IT', 'Extra virgin, "cold" oil', null]],
      ['# Phase 5B provenance header']
    );
    expect(csv).toBe('# Phase 5B provenance header\nCode,Description,Notes\nIT,"Extra virgin, ""cold"" oil",');
  });

  it('rejects malformed JSON payloads cleanly without polluting session cache (Phase 5C)', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return new Response('{broken-json', { status: 200 });
        }
        return new Response(JSON.stringify({ valid: true }), { status: 200 });
      })
    );

    await expect(fetchCachedJson('data/bad_payload.json')).rejects.toThrow();
    expect(getDataProviderStats().cachedPaths).not.toContain('data/bad_payload.json');

    const ok = await fetchCachedJson<{ valid: boolean }>('data/bad_payload.json', { forceRetry: true });
    expect(ok.valid).toBe(true);
    expect(call).toBe(2);
  });
});
