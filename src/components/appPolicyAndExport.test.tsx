// @vitest-environment jsdom
import '../test/setupDom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Papa from 'papaparse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { clearDataProviderCache } from '../services/dataProvider';
import { evaluatePolicyScenario } from '../analytics/policyScenarioModel';
import { COUNTRY_PROFILES } from '../types/research';
import {
  FIXTURE_AGRIBALYSE_ITEMS,
  FIXTURE_DATASETS_REGISTRY,
  FIXTURE_HICP_DATA,
  FIXTURE_OFF_PRODUCTS,
  FIXTURE_POORE_ITEMS,
} from '../test/fixtures/atlasFixtures';

vi.mock('./ThemedEChart', () => ({
  default: ({
    ariaLabel,
    dataTableFallback,
  }: {
    ariaLabel?: string;
    dataTableFallback?: { caption?: string };
  }) => (
    <div data-testid="app-mock-chart" aria-label={ariaLabel}>
      {dataTableFallback?.caption && <span>{dataTableFallback.caption}</span>}
    </div>
  ),
}));

vi.mock('./InteractiveChoroplethMap', () => ({
  InteractiveChoroplethMap: ({ selectedCountry }: { selectedCountry: string }) => (
    <div data-testid="mock-choropleth">Map:{selectedCountry}</div>
  ),
}));

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('Phase 5C App Policy Controls, NOVA NULL Toggle, Error Retry & CSV Export Parity', () => {
  beforeEach(() => {
    clearDataProviderCache();
    window.location.hash = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubAppFetch(failGlobalBenchmarksOnce = false) {
    let gbFailed = failGlobalBenchmarksOnce;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input);
        if (u.includes('live_research_bundle.json')) {
          return new Response(
            JSON.stringify({
              metadata: { generated_at: '2026-11-16' },
              agribalyse_count: 500,
              agribalyse: FIXTURE_AGRIBALYSE_ITEMS,
              openfoodfacts: FIXTURE_OFF_PRODUCTS,
              eurostat: { IT: FIXTURE_HICP_DATA, EU27_2020: FIXTURE_HICP_DATA },
              openalex: { 'Planetary Health': { '2025': 120 } },
              efsa_surveys: [],
            }),
            { status: 200 }
          );
        }
        if (u.includes('agribalyse_full.json')) {
          return new Response(JSON.stringify(FIXTURE_AGRIBALYSE_ITEMS), { status: 200 });
        }
        if (u.includes('econometric_calibration.json')) {
          return new Response(
            JSON.stringify({
              IT: {
                country_code: 'IT',
                empirical_own_price_elasticity: -0.62,
                hbs_q1_food_share_pct: 18.3,
                hbs_q5_food_share_pct: 14.4,
                eurostat_food_ppp_index_eu27_100: 100.3,
              },
            }),
            { status: 200 }
          );
        }
        if (u.includes('global_benchmarks.json')) {
          if (gbFailed) {
            gbFailed = false;
            return new Response('Benchmarks fail', { status: 500 });
          }
          return new Response(
            JSON.stringify({
              poore_nemecek_lca: FIXTURE_POORE_ITEMS,
              cohd_latest_by_country: [],
            }),
            { status: 200 }
          );
        }
        if (u.includes('datasets_registry.json')) {
          return new Response(JSON.stringify(FIXTURE_DATASETS_REGISTRY), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      })
    );
  }

  it('recovers from non-blocking fetch failure, syncs Policy slider UI with engine & CSV export, and audits NOVA NULL toggle', async () => {
    const capturedBlobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      capturedBlobs.push(b as Blob);
      return `blob:app-${capturedBlobs.length}`;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    stubAppFetch(true);
    render(<App />);

    // Non-blocking error alert shown on Overview; retry recovers cleanly
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/global_benchmarks\.json: HTTP 500/i);
    fireEvent.click(screen.getByRole('button', { name: /Retry Failed Streams/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // Policy sliders: move Plant-protein substitution slider from 35% -> 60% and verify UI & CSV export match evaluatePolicyScenario
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '60' } });

    const expectedPolicy = evaluatePolicyScenario(
      COUNTRY_PROFILES.IT,
      { empirical_own_price_elasticity: -0.62, hbs_q1_food_share_pct: 18.3, hbs_q5_food_share_pct: 14.4 },
      { simPlantShiftPct: 60, simUpfReductionPct: 25, simCarbonTaxEurT: 50, simWasteCutPct: 20 }
    ).data;

    expect(screen.getByText(String(expectedPolicy.newCarbon))).toBeInTheDocument();
    expect(screen.getByText(`€${expectedPolicy.newCost}`)).toBeInTheDocument();

    // Select Country Simulation CSV export and verify exported CSV row === expectedPolicy
    const exportSelect = screen.getByTitle('Select dataset to export as CSV');
    fireEvent.change(exportSelect, { target: { value: 'country_profile' } });
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));

    const policyCsvText = await readBlobText(capturedBlobs[capturedBlobs.length - 1]);
    const policyRows = Papa.parse<Record<string, string>>(policyCsvText, { header: true }).data;
    expect(policyRows).toHaveLength(1);
    expect(Number(policyRows[0].Simulated_CO2_kg_d)).toBe(expectedPolicy.newCarbon);
    expect(Number(policyRows[0].Simulated_Cost_EUR_d)).toBe(expectedPolicy.newCost);
    expect(policyRows[0].Policy_CI95_Available).toBe('false');
    expect(policyRows[0].PPP_Normalized).toBe('false');
    expect(policyRows[0].Plant_Shift_Pct).toBe('60');

    // Toggle "Include Unknown NOVA (NULL)" off -> FX003 (nova_group: null) excluded transparently -> OFF CSV drops from 3 to 2 rows
    const novaCheckbox = screen.getByTestId('toggle-missing-nova');
    fireEvent.click(novaCheckbox);
    expect(screen.getByText(/1 NULL-NOVA items excluded/i)).toBeInTheDocument();

    fireEvent.change(exportSelect, { target: { value: 'off' } });
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    const offCsvText = await readBlobText(capturedBlobs[capturedBlobs.length - 1]);
    const offRows = Papa.parse<Record<string, string>>(offCsvText, { header: true }).data;
    expect(offRows).toHaveLength(2);
    expect(offRows.map((r) => r.Code)).toEqual(['FX001', 'FX002']);
  });
});
