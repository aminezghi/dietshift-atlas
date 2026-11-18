// @vitest-environment jsdom
import '../test/setupDom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Papa from 'papaparse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDataProviderCache } from '../services/dataProvider';
import { fromCoHDRecord, fromEurostatPppCalibration, fromOpenPricesSku } from '../analytics/affordabilityEngine';
import { fromOFFProduct } from '../analytics/nutritionEngine';
import { runAllSensitivityScenarios } from '../analytics/sensitivityEngine';
import {
  FIXTURE_AGRIBALYSE_ITEMS,
  FIXTURE_CLASSIFICATION_MAPPINGS,
  FIXTURE_COHD_RAW,
  FIXTURE_GI_ITEMS,
  FIXTURE_HICP_DATA,
  FIXTURE_NUTRITION_INPUTS,
  FIXTURE_OFF_PRODUCTS,
  FIXTURE_POORE_ITEMS,
  FIXTURE_SCRAPLING_SKUS,
} from '../test/fixtures/atlasFixtures';
import { SensitivityPanel } from './SensitivityPanel';
import { IntegratedRobustnessPanel } from './IntegratedRobustnessPanel';
import { EnvironmentComparisonPanel } from './EnvironmentComparisonPanel';
import { EmpiricalSocialMicrodataPlate } from './EmpiricalSocialMicrodataPlate';
import { ConsumerBehaviorPulse } from './ConsumerBehaviorPulse';
import { GS1ImmaginoObservatory } from './GS1ImmaginoObservatory';

vi.mock('./ThemedEChart', () => ({
  default: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div data-testid="mock-echart" aria-label={ariaLabel} />
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

function stubTrackAFetch(overrides?: Record<string, () => Promise<Response> | Response>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (overrides) {
      for (const [pattern, handler] of Object.entries(overrides)) {
        if (url.includes(pattern)) return handler();
      }
    }
    if (url.includes('classification_mappings.json')) {
      return new Response(JSON.stringify(FIXTURE_CLASSIFICATION_MAPPINGS), { status: 200 });
    }
    if (url.includes('scrapling_retail_claims.json')) {
      return new Response(JSON.stringify(FIXTURE_SCRAPLING_SKUS), { status: 200 });
    }
    if (url.includes('global_benchmarks.json')) {
      return new Response(
        JSON.stringify({
          poore_nemecek_lca: FIXTURE_POORE_ITEMS,
          cohd_latest_by_country: FIXTURE_COHD_RAW,
        }),
        { status: 200 }
      );
    }
    if (url.includes('consumer_pulse_rows.json')) {
      return new Response(
        JSON.stringify([
          {
            country_code: 'IT',
            country_name: 'Italy',
            nsi_source: 'ISTAT + CREA',
            google_trends_plant_index: 68,
            google_trends_upf_index: 71,
            wiki_attention_growth_pct: 132,
            stage1_digital_curiosity_pct: 74,
            stage2_stated_sustainability_intent_pct: 71.5,
            stage3_affordability_surviving_pct: 52.8,
            stage4_retail_basket_purchase_pct: 44.5,
            stage5_efsa_Guideline_adherence_pct: 35.2,
            barrier_price_pct: 51,
            barrier_habit_taste_pct: 44,
            barrier_clean_label_distrust_pct: 49,
            barrier_time_convenience_pct: 26,
            barrier_social_norm_pct: 29,
            optimal_lag_months: 6,
            search_to_purchase_corr_r: 0.74,
            price_elasticity_healthy: -0.62,
            price_elasticity_plant_meat: -1.28,
            upf_discourse_to_drop_elasticity: -0.41,
          },
        ]),
        { status: 200 }
      );
    }
    if (url.includes('clinical_biomarker_grounding.json')) {
      return new Response(
        JSON.stringify([
          {
            pattern_id: 'NH_P5',
            dietary_pattern: 'Q5: Plant-Dense Top Quintile (NHANES)',
            description: 'High fiber quintile',
            n_respondents: 853,
            mean_fiber_g_day: 26.2,
            saturated_fat_pct_kcal: 7.7,
            plant_protein_share_pct: 62.8,
            total_cholesterol_mg_dl: 188.5,
            ldl_cholesterol_mg_dl: 109.5,
            hdl_cholesterol_mg_dl: 54.9,
            triglycerides_mg_dl: 96.2,
            hba1c_pct: 5.5,
            hs_crp_inflammation_mg_l: 2.94,
            hs_crp_ci95: 0.48,
            systolic_bp_mmhg: 119.6,
            diastolic_bp_mmhg: 73.5,
            cardiovascular_risk_delta_pct: -5.4,
          },
          {
            pattern_id: 'NH_P1',
            dietary_pattern: 'Q1: Low Fiber Quintile (NHANES)',
            description: 'Low fiber quintile',
            n_respondents: 850,
            mean_fiber_g_day: 7.4,
            saturated_fat_pct_kcal: 12.1,
            plant_protein_share_pct: 22.0,
            total_cholesterol_mg_dl: 196.0,
            ldl_cholesterol_mg_dl: 118.0,
            hdl_cholesterol_mg_dl: 49.0,
            triglycerides_mg_dl: 122.0,
            hba1c_pct: 5.6,
            hs_crp_inflammation_mg_l: 4.5,
            hs_crp_ci95: 0.62,
            systolic_bp_mmhg: 124.0,
            diastolic_bp_mmhg: 77.0,
            cardiovascular_risk_delta_pct: 6.1,
          },
        ]),
        { status: 200 }
      );
    }
    if (url.includes('school_meals_procurement.json')) {
      return new Response(
        JSON.stringify([
          {
            country_code: 'IT',
            country_name: 'Italy',
            legal_framework: 'Criteri Ambientali Minimi (CAM)',
            mandatory_plant_days_per_week: 1,
            voluntary_plant_options_allowed: true,
            organic_procurement_quota_pct: 40,
            sustainable_quality_quota_pct: 70,
            local_terroir_priority: true,
            students_served_daily_m: 4.8,
            annual_procurement_budget_eur_m: 2200,
            co2_reduction_target_school_food_pct: 22,
            evaluation_agency: 'MASE',
          },
        ]),
        { status: 200 }
      );
    }

    // All Track B bundles return HTTP 404 by default in Track A mode
    return new Response('Not Found', { status: 404, statusText: 'Not Found' });
  });
}

describe('Phase 6D Track A Resilience & Graceful Degradation Regression Suite', () => {
  beforeEach(() => {
    clearDataProviderCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SensitivityEngine keeps all 19 non-GI scenarios identical when giItems is empty', () => {
    const nutCountryMap = new Map<string, string | null>(
      FIXTURE_OFF_PRODUCTS.map((p) => [p.code, p.primary_country ?? null])
    );
    const commonArgs = {
      mappings: FIXTURE_CLASSIFICATION_MAPPINGS,
      nutritionInputs: FIXTURE_NUTRITION_INPUTS,
      nutritionCountryMap: nutCountryMap,
      agribalyseItems: FIXTURE_AGRIBALYSE_ITEMS,
      pooreItems: FIXTURE_POORE_ITEMS,
      retailPriceRecords: FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku),
      hicpCountryCode: 'IT',
      hicpData: FIXTURE_HICP_DATA,
      isHicpEuFallback: false,
    };

    const fullSuite = runAllSensitivityScenarios({
      ...commonArgs,
      giItems: FIXTURE_GI_ITEMS,
    });
    const trackASuite = runAllSensitivityScenarios({
      ...commonArgs,
      giItems: [],
    });

    expect(fullSuite.data.some((s) => s.scenarioId === 'env_gi_unfiltered_alcohol_leak')).toBe(true);
    expect(trackASuite.data.length).toBe(fullSuite.data.length - 1);
    expect(trackASuite.data.some((s) => s.scenarioId === 'env_gi_unfiltered_alcohol_leak')).toBe(false);

    for (const sA of trackASuite.data) {
      const sFull = fullSuite.data.find((s) => s.scenarioId === sA.scenarioId);
      expect(sFull).toBeDefined();
      expect(sA.rankingMetrics.spearmanRho).toBe(sFull!.rankingMetrics.spearmanRho);
      expect(sA.scenarioSummary.validDenominator).toBe(sFull!.scenarioSummary.validDenominator);
    }
  });

  it('SensitivityPanel executes 19 independent scenarios cleanly when Track B GI returns 404 and exports non-empty CSV', async () => {
    const capturedBlobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) capturedBlobs.push(obj);
      return 'blob:track-a-sens';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('fetch', stubTrackAFetch());

    const nutCountryMap = new Map<string, string | null>(
      FIXTURE_OFF_PRODUCTS.map((p) => [p.code, p.primary_country ?? null])
    );
    const expectedTrackACount = runAllSensitivityScenarios({
      mappings: FIXTURE_CLASSIFICATION_MAPPINGS,
      nutritionInputs: FIXTURE_NUTRITION_INPUTS,
      nutritionCountryMap: nutCountryMap,
      agribalyseItems: FIXTURE_AGRIBALYSE_ITEMS,
      pooreItems: FIXTURE_POORE_ITEMS,
      giItems: [],
      retailPriceRecords: FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku),
      hicpCountryCode: 'IT',
      hicpData: FIXTURE_HICP_DATA,
      isHicpEuFallback: false,
    }).data.length;

    const view = render(
      <SensitivityPanel
        selectedCountry="IT"
        countryName="Italy"
        hicpTargetCode="IT"
        isHicpFallback={false}
        hicpData={FIXTURE_HICP_DATA}
        offProducts={FIXTURE_OFF_PRODUCTS}
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`${expectedTrackACount} valid alternative\\(s\\) displayed`, 'i'))).toBeInTheDocument();
    });

    expect(screen.getByText(/env_gi_unfiltered_alcohol_leak/i)).toBeInTheDocument();
    expect(screen.getByText(/Dataset not included in this open Track A distribution/i)).toBeInTheDocument();

    const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
    const jsonBtn = screen.getByRole('button', { name: /JSON Dossier/i });
    expect(csvBtn).toBeEnabled();
    expect(jsonBtn).toBeEnabled();

    fireEvent.click(csvBtn);
    const csvText = await readBlobText(capturedBlobs[capturedBlobs.length - 1]);
    const rows = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      comments: '#',
      skipEmptyLines: true,
    }).data;
    expect(rows).toHaveLength(expectedTrackACount);
    view.unmount();
  });

  it('SensitivityPanel disables CSV/JSON exports visibly when core scenarios cannot be computed', async () => {
    vi.stubGlobal(
      'fetch',
      stubTrackAFetch({
        'classification_mappings.json': () =>
          new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      })
    );

    const view = render(
      <SensitivityPanel
        selectedCountry="IT"
        countryName="Italy"
        hicpTargetCode="IT"
        isHicpFallback={false}
        hicpData={FIXTURE_HICP_DATA}
        offProducts={FIXTURE_OFF_PRODUCTS}
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Exports disabled: 0 sensitivity scenarios are computable/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /JSON Dossier/i })).toBeDisabled();
    view.unmount();
  });

  it('SensitivityPanel distinguishes transient GI HTTP 500 server failure from Track A exclusion', async () => {
    vi.stubGlobal(
      'fetch',
      stubTrackAFetch({
        'gi_terroir_bundle.json': () =>
          new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }),
      })
    );

    const view = render(
      <SensitivityPanel
        selectedCountry="IT"
        countryName="Italy"
        hicpTargetCode="IT"
        isHicpFallback={false}
        hicpData={FIXTURE_HICP_DATA}
        offProducts={FIXTURE_OFF_PRODUCTS}
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-availability-category', 'network_or_server_error');
    expect(alert).toHaveTextContent(/HTTP 500/i);
    expect(screen.getByRole('button', { name: /Retry Load/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeEnabled();
    view.unmount();
  });

  it('IntegratedRobustnessPanel preserves Poore & Nemecek LCA evidence and discloses missing GI proxy in Track A', async () => {
    const capturedBlobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) capturedBlobs.push(obj);
      return 'blob:track-a-rob';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const pooreWithGrains = [
      ...FIXTURE_POORE_ITEMS.map((item) => ({
        ...item,
        stage_transport: 0.3,
      })),
      {
        food_item: 'Oatmeal',
        ghg_kg_co2eq_per_kg: 2.48,
        ghg_kg_per_100g_protein: 1.91,
        ghg_kg_per_1000kcal: 0.94,
        land_use_m2_per_kg: 7.6,
        freshwater_withdrawals_l_per_kg: 482.4,
        scarcity_water_l_per_kg: 18786.2,
        eutrophying_g_po4_per_kg: 11.23,
        stage_transport: 0.3,
      },
    ];
    vi.stubGlobal(
      'fetch',
      stubTrackAFetch({
        'global_benchmarks.json': () =>
          new Response(
            JSON.stringify({
              poore_nemecek_lca: pooreWithGrains,
              cohd_latest_by_country: FIXTURE_COHD_RAW,
            }),
            { status: 200 }
          ),
      })
    );

    const pppIt = fromEurostatPppCalibration('IT', 100.3, 2024);
    const cohdIt = fromCoHDRecord(FIXTURE_COHD_RAW[0]);

    const nutritionWithMeat = [
      ...FIXTURE_NUTRITION_INPUTS,
      fromOFFProduct({
        code: 'FX_MEAT_1',
        name: 'Fixture Beef Steak',
        brand: 'Fixture Butcher',
        category: 'Bovine, Pork & Poultry Meats',
        nutriscore_grade: 'c',
        nutriscore_score: 4,
        ecoscore_grade: 'e',
        ecoscore_score: 12,
        nova_group: 1,
        energy_kcal_100g: 250,
        proteins_100g: 26,
        sugars_100g: 0,
        saturated_fat_100g: 6,
        fiber_100g: 0,
        salt_100g: 0.2,
        carbohydrates_100g: 0,
        fat_100g: 15,
        primary_country: 'Italy',
      }),
    ];

    const view = render(
      <IntegratedRobustnessPanel
        selectedCountry="IT"
        countryName="Italy"
        mappings={FIXTURE_CLASSIFICATION_MAPPINGS}
        nutritionInputs={nutritionWithMeat}
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
        retailPriceRecords={FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku)}
        hicpCountryCode="IT"
        hicpData={FIXTURE_HICP_DATA}
        isHicpEuFallback={false}
        pppBenchmark={pppIt}
        cohdLatest={cohdIt}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Dataset not included in this open Track A distribution/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'All (12)' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('phase4d-export-json'));
    const exported = JSON.parse(await readBlobText(capturedBlobs[capturedBlobs.length - 1])) as {
      data: {
        scenarios: Array<{ scenarioId: string; denominators: { baselineValid: number; scenarioValid: number } }>;
        evidenceMatrix: Array<{
          categoryLabel: string;
          layers: Record<string, { validDenominator: number; evidenceNature: string; blockingOrMissingnessReason: string | null }>;
        }>;
      };
      auxiliaryAvailability: { pooreItemsCount: number; giItemsCount: number; giProxyAvailable: boolean };
    };

    expect(exported.data.scenarios).toHaveLength(12);
    expect(exported.auxiliaryAvailability.pooreItemsCount).toBe(pooreWithGrains.length);
    expect(exported.auxiliaryAvailability.giItemsCount).toBe(0);
    expect(exported.auxiliaryAvailability.giProxyAvailable).toBe(false);

    const pooreScenario = exported.data.scenarios.find((s) => s.scenarioId === 'rob_env_poore_excl_transport');
    expect(pooreScenario?.denominators.baselineValid).toBe(pooreWithGrains.length);
    expect(pooreScenario?.denominators.scenarioValid).toBe(pooreWithGrains.length);

    const hasPoore = exported.data.evidenceMatrix.some(
      (r) => r.layers.environment_poore?.validDenominator > 0 && r.layers.environment_poore?.evidenceNature === 'Estimated'
    );
    expect(hasPoore).toBe(true);

    for (const row of exported.data.evidenceMatrix) {
      expect(row.layers.environment_gi_proxy.validDenominator).toBe(0);
      expect(row.layers.environment_gi_proxy.evidenceNature).toBe('Missing');
      expect(row.layers.environment_gi_proxy.blockingOrMissingnessReason).toMatch(/without fabricated fallback/i);
    }

    view.unmount();
  });

  it('ConsumerBehaviorPulse and EmpiricalSocialMicrodataPlate keep open Track A panels alive when Track B bundles are 404', async () => {
    vi.stubGlobal('fetch', stubTrackAFetch());

    const pulseView = render(<ConsumerBehaviorPulse selectedCountry="IT" />);
    await waitFor(() => {
      expect(screen.getByText(/Section III\. Consumer Behavior/i)).toBeInTheDocument();
      expect(screen.getByText(/Plate III-F\. Empirical Social Science/i)).toBeInTheDocument();
      expect(screen.getByText(/Clinical Ground-Truthing \(CDC NHANES/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /1\. Time Poverty & Cooking Friction/i }));
    expect(screen.getByText(/MTUS \/ IPUMS Time Poverty & Cooking Friction dataset/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3\. Public School Canteens/i }));
    expect(screen.getByText(/Criteri Ambientali Minimi \(CAM\)/i)).toBeInTheDocument();
    pulseView.unmount();

    const empView = render(<EmpiricalSocialMicrodataPlate selectedCountry="IT" />);
    await waitFor(() => {
      expect(screen.getByText(/Q5: Plant-Dense Top Quintile/i)).toBeInTheDocument();
    });
    empView.unmount();
  });

  it('EnvironmentComparisonPanel discloses GI Track B exclusion explicitly when selecting GI proxy source', async () => {
    vi.stubGlobal('fetch', stubTrackAFetch());

    const envView = render(
      <EnvironmentComparisonPanel
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
        pooreItems={FIXTURE_POORE_ITEMS}
      />
    );

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'gi_terroir_proxy' },
    });
    await waitFor(() => {
      expect(screen.getByText(/Geographical Indications \(EUIPO GIview & Qualigeo\) registry/i)).toBeInTheDocument();
    });
    envView.unmount();
  });

  it('GS1ImmaginoObservatory retains Open Prices EU SKUs while disclosing Track B GS1 exclusion', async () => {
    vi.stubGlobal('fetch', stubTrackAFetch());

    const gs1View = render(<GS1ImmaginoObservatory selectedCountry="IT" />);
    await waitFor(() => {
      expect(screen.getByText(/Pan-European Retail Scanner & Claim Observatory/i)).toBeInTheDocument();
      expect(screen.getByText(/GS1 Italy Osservatorio Immagino \(19th Ed\.\) retail dataset/i)).toBeInTheDocument();
      expect(screen.getByText(/Pan-EU GS1 Retail Scanner extrapolation dataset/i)).toBeInTheDocument();
      expect(gs1View.container.textContent).toContain(FIXTURE_SCRAPLING_SKUS[0].product_name);
    });
    gs1View.unmount();
  });
});
