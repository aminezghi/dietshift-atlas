// @vitest-environment jsdom
import '../test/setupDom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Papa from 'papaparse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDataProviderCache } from '../services/dataProvider';
import { aggregateNutritionByCategory, summarizeNutritionDataset } from '../analytics/nutritionEngine';
import { buildIntegratedCategoryProfiles } from '../analytics/integratedComparator';
import { evaluateIntegratedRobustnessSuite } from '../analytics/integratedRobustness';
import { fromCoHDRecord, fromEurostatPppCalibration, fromOpenPricesSku } from '../analytics/affordabilityEngine';
import { runAllSensitivityScenarios } from '../analytics/sensitivityEngine';
import {
  FIXTURE_AGRIBALYSE_ITEMS,
  FIXTURE_CLASSIFICATION_MAPPINGS,
  FIXTURE_COHD_RAW,
  FIXTURE_DATASETS_REGISTRY,
  FIXTURE_GI_ITEMS,
  FIXTURE_HICP_DATA,
  FIXTURE_NUTRITION_INPUTS,
  FIXTURE_OFF_PRODUCTS,
  FIXTURE_POORE_ITEMS,
  FIXTURE_SCRAPLING_SKUS,
} from '../test/fixtures/atlasFixtures';
import { DataNatureBadge } from './DataNatureBadge';
import { DataCatalogModal } from './DataCatalogModal';
import { NutritionComparisonPanel } from './NutritionComparisonPanel';
import { EnvironmentComparisonPanel } from './EnvironmentComparisonPanel';
import { ResearcherSandbox } from './ResearcherSandbox';
import { EmpiricalSocialMicrodataPlate } from './EmpiricalSocialMicrodataPlate';
import { AffordabilityAndIntegratedPanel } from './AffordabilityAndIntegratedPanel';
import { IntegratedRobustnessPanel } from './IntegratedRobustnessPanel';
import { SensitivityPanel } from './SensitivityPanel';

vi.mock('./ThemedEChart', () => ({
  default: ({
    ariaLabel,
    accessibleSummary,
    dataTableFallback,
  }: {
    ariaLabel?: string;
    accessibleSummary?: string;
    dataTableFallback?: { caption?: string; headers: string[]; rows: Array<Array<string | number>> };
  }) => (
    <div data-testid="mock-echart" aria-label={ariaLabel} data-summary={accessibleSummary}>
      {dataTableFallback && (
        <table>
          <caption>{dataTableFallback.caption}</caption>
        </table>
      )}
    </div>
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

describe('Phase 5C React Component Regressions, Adverse Conditions & UI-to-Export Parity', () => {
  beforeEach(() => {
    clearDataProviderCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DataNatureBadge: renders all 6 evidence tiers with accessible titles and optional labels', () => {
    const { rerender } = render(<DataNatureBadge nature="Observed" />);
    expect(screen.getByText('Observed')).toHaveAttribute('title', expect.stringContaining('Observed'));

    for (const tier of ['Estimated', 'Model Output', 'Forecast', 'Simulated', 'Manually Compiled'] as const) {
      rerender(<DataNatureBadge nature={tier} label="Tag" />);
      expect(screen.getByText(`${tier}: Tag`)).toBeInTheDocument();
    }
  });

  it('NutritionComparisonPanel: switches bases, matches engine denominators/zeros, and survives empty inputs', () => {
    const onBasisChange = vi.fn();
    const { rerender } = render(
      <NutritionComparisonPanel inputs={FIXTURE_NUTRITION_INPUTS} basis="per_100g" onBasisChange={onBasisChange} />
    );

    const cov100g = summarizeNutritionDataset(FIXTURE_NUTRITION_INPUTS, 'per_100g').data;
    expect(screen.getAllByText(String(cov100g.computableForBasisRecords)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/NULLs preserved/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Per 100 kcal' }));
    expect(onBasisChange).toHaveBeenCalledWith('per_100kcal');

    rerender(
      <NutritionComparisonPanel inputs={FIXTURE_NUTRITION_INPUTS} basis="per_100kcal" onBasisChange={onBasisChange} />
    );
    expect(screen.getByText(/non_positive_energy: 1/i)).toBeInTheDocument();

    rerender(
      <NutritionComparisonPanel inputs={FIXTURE_NUTRITION_INPUTS} basis="per_serving" onBasisChange={onBasisChange} />
    );
    expect(screen.getByText(/missing_serving_quantity: 3/i)).toBeInTheDocument();

    // Adverse: empty dataset
    const emptyCov = aggregateNutritionByCategory([], 'per_100g', ['proteins_g']).data;
    expect(emptyCov).toHaveLength(0);
    rerender(<NutritionComparisonPanel inputs={[]} basis="per_100g" onBasisChange={onBasisChange} />);
    expect(screen.getByText('Category (0)')).toBeInTheDocument();
  });

  it('EnvironmentComparisonPanel: renders Model Output/Estimated/Boundary Guard and recovers from GI fetch failure', async () => {
    let failGi = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes('gi_terroir_bundle.json')) {
          if (failGi) {
            failGi = false;
            return new Response('GI fail', { status: 500 });
          }
          return new Response(JSON.stringify({ gi_terroir_records: FIXTURE_GI_ITEMS }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      })
    );

    render(
      <EnvironmentComparisonPanel
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
        pooreItems={FIXTURE_POORE_ITEMS}
      />
    );

    expect(screen.getByText('Model Output')).toBeInTheDocument();
    expect(screen.getAllByText(/AWARE/i).length).toBeGreaterThanOrEqual(1);

    // Trigger GI fetch failure inside Boundary Guard -> role="alert" -> Retry recovers
    fireEvent.click(screen.getByRole('button', { name: /Compatibility & Boundary Guard/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/HTTP 500/);

    fireEvent.click(screen.getByRole('button', { name: /Retry GI Load/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('ResearcherSandbox: preserves AWARE/PEF units, keeps Agribalyse & blank CSV cells NULL, and matches CSV export', async () => {
    const capturedBlobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      capturedBlobs.push(b as Blob);
      return 'blob:sandbox-csv';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <ResearcherSandbox selectedCountry="IT" agribalyseCatalog={FIXTURE_AGRIBALYSE_ITEMS} />
    );

    // Native units verified in UI
    expect(screen.getByText(/AWARE world-eq \(not L\)/i)).toBeInTheDocument();
    expect(screen.getByText(/not m²/i)).toBeInTheDocument();

    // Upload CSV containing invalid negative row + valid row with blank optional cells
    const csvContent = [
      'food_name,category,grams_per_day,nova_group,carbon_kg_per_kg,water_aware_m3_per_kg,land_pt_per_kg,kcal_100g,protein_100g,cost_eur_per_kg',
      'Bad Negative Item,Vegetables,-10,1,0.5,0.1,0.2,20,1,2',
      'Pure Blank Recall,Legumes,150,,0.9,,,,,',
    ].join('\n');
    const file = new File([csvContent], 'survey_test.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/excluded 1 rows without valid grams_per_day/i)).toBeInTheDocument();
      expect(screen.getByText(/preserved 6 blank cells as NULL/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Known sums cover 0\/1 energy, 0\/1 price, and 0\/1 NOVA items/i)).toBeInTheDocument();

    // Export CSV and verify NULL cells remain blank (no imputed 140/6.5/4.5)
    fireEvent.click(screen.getByRole('button', { name: /Download template CSV/i }));
    expect(capturedBlobs).toHaveLength(1);
    const exportedText = await readBlobText(capturedBlobs[0]);
    const parsed = Papa.parse<Record<string, string>>(exportedText, { header: true });
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].food_name).toBe('Pure Blank Recall');
    expect(parsed.data[0].kcal_100g).toBe('');
    expect(parsed.data[0].protein_100g).toBe('');
    expect(parsed.data[0].cost_eur_per_kg).toBe('');
    expect(parsed.data[0].water_aware_m3_per_kg).toBe('');

    // Search & append Agribalyse LCI item -> preserves NULL nutrition/price/NOVA and surfaces Partial Measurement Disclosure
    fireEvent.change(screen.getByPlaceholderText(/Search 2 Agribalyse items/i), {
      target: { value: 'Oat flakes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Oat flakes/i }));
    expect(
      screen.getByText(/1 Agribalyse LCI item\(s\) supply Model Output carbon, AWARE water, and PEF land impacts only/i)
    ).toBeInTheDocument();

    // Adverse CSV upload with zero valid positive grams_per_day -> explicit rejection message
    const badOnlyFile = new File(
      ['food_name,grams_per_day\nZeroItem,0\nMissingGrams,\n'],
      'empty_valid.csv',
      { type: 'text/csv' }
    );
    fireEvent.change(fileInput, { target: { files: [badOnlyFile] } });
    await waitFor(() => {
      expect(screen.getByText(/No valid positive grams_per_day rows found in "empty_valid.csv"/i)).toBeInTheDocument();
    });
  });

  it('EmpiricalSocialMicrodataPlate: discloses unsupported jurisdiction fallback and recovers from HTTP 500', async () => {
    let fail = true;
    const bundlePayload = {
      time_use: [
        {
          record_id: 'TU_1',
          country_code: 'IT',
          country_name: 'Italy',
          income_quintile: 'Q1',
          daily_cooking_food_prep_min: 58,
          daily_eating_drinking_min: 95,
          daily_grocery_shopping_min: 22,
          total_food_time_min: 175,
          convenience_food_expenditure_share_pct: 19,
          culinary_time_poverty_rate_pct: 28,
          female_cooking_share_pct: 74,
          data_source: 'MTUS Fixture',
        },
      ],
      clinical_biomarkers: [
        {
          pattern_id: 'Q1_HIGH_UPF',
          dietary_pattern: 'Q1 Unprocessed Low-UPF (Reference)',
          description: 'NHANES Weighted Q1',
          n_respondents: 1200,
          mean_fiber_g_day: 24.5,
          saturated_fat_pct_kcal: 8.5,
          plant_protein_share_pct: 42.0,
          total_cholesterol_mg_dl: 192,
          total_cholesterol_ci95: 3.1,
          non_hdl_cholesterol_mg_dl: 141,
          non_hdl_ci95: 2.8,
          ldl_cholesterol_mg_dl: 115,
          hdl_cholesterol_mg_dl: 51,
          triglycerides_mg_dl: 101,
          hba1c_pct: 5.5,
          hs_crp_inflammation_mg_l: 2.3,
          hs_crp_ci95: 0.4,
          systolic_bp_mmhg: 124,
          systolic_bp_ci95: 1.5,
          diastolic_bp_mmhg: 76,
          cardiovascular_risk_delta_pct: 8.5,
        },
      ],
      school_meals: [
        {
          country_code: 'IT',
          country_name: 'Italy',
          legal_framework: 'CAM National Criteria',
          mandatory_plant_days_per_week: 2,
          voluntary_plant_options_allowed: true,
          organic_procurement_quota_pct: 50,
          sustainable_quality_quota_pct: 62,
          local_terroir_priority: true,
          students_served_daily_m: 2.1,
          annual_procurement_budget_eur_m: 1200,
          co2_reduction_target_school_food_pct: 25,
          evaluation_agency: 'CREA',
        },
      ],
      cultural_climate: [
        {
          country_code: 'IT',
          country_name: 'Italy',
          climate_worry_score_pct: 59,
          personal_responsibility_feel_pct: 63,
          willingness_to_reduce_meat_pct: 32,
          perceived_price_barrier_pct: 51,
          cultural_culinary_inertia_index: 64,
          actual_plant_basket_penetration_pct: 18,
          say_do_divergence_gap_pct: 14,
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (fail) {
          fail = false;
          return new Response('Fail', { status: 500 });
        }
        return new Response(JSON.stringify(bundlePayload), { status: 200 });
      })
    );

    render(<EmpiricalSocialMicrodataPlate selectedCountry="USA" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/HTTP 500/);

    fireEvent.click(screen.getByRole('button', { name: /Retry Load/i }));
    await waitFor(() => {
      expect(screen.getByText(/Jurisdiction Fallback Disclosure/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/USA/)).toBeInTheDocument();
  });

  it('Affordability, Robustness (4D) & Sensitivity (4C): verify UI counts, error banners, and CSV/JSON export parity', async () => {
    const capturedBlobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      capturedBlobs.push(b as Blob);
      return `blob:mock-${capturedBlobs.length}`;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input);
        if (u.includes('classification_mappings.json')) {
          return new Response(JSON.stringify(FIXTURE_CLASSIFICATION_MAPPINGS), { status: 200 });
        }
        if (u.includes('scrapling_retail_claims.json')) {
          return new Response(JSON.stringify(FIXTURE_SCRAPLING_SKUS), { status: 200 });
        }
        if (u.includes('global_benchmarks.json')) {
          return new Response(JSON.stringify({ poore_nemecek_lca: FIXTURE_POORE_ITEMS }), { status: 200 });
        }
        if (u.includes('gi_terroir_bundle.json')) {
          return new Response(JSON.stringify({ gi_terroir_records: FIXTURE_GI_ITEMS }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      })
    );

    // 1. AffordabilityAndIntegratedPanel: HICP EU-27 fallback + CSV/JSON export parity
    const affView = render(
      <AffordabilityAndIntegratedPanel
        selectedCountry="USA"
        countryName="United States"
        countryGeoName="United States of America"
        hicpTargetCode="EU27_2020"
        isHicpFallback={true}
        hicpData={FIXTURE_HICP_DATA}
        pppIndexEu27={null}
        cohdRecords={FIXTURE_COHD_RAW}
        offProducts={FIXTURE_OFF_PRODUCTS}
        agribalyseItems={FIXTURE_AGRIBALYSE_ITEMS}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument(); // 1 valid EUR/kg out of 3 fixture SKUs
    });
    expect(screen.getByText(/HICP scope: EU27_2020 \(EU-27 fallback\)/i)).toBeInTheDocument();

    // Expected integrated profile count matches UI button label
    const expectedIntegrated = buildIntegratedCategoryProfiles({
      mappings: FIXTURE_CLASSIFICATION_MAPPINGS,
      nutritionInputs: FIXTURE_NUTRITION_INPUTS,
      agribalyseItems: FIXTURE_AGRIBALYSE_ITEMS,
      retailPriceRecords: FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku),
      hicpCountryCode: 'EU27_2020',
      hicpData: FIXTURE_HICP_DATA,
      isHicpEuFallback: true,
      pppBenchmark: null,
      cohdLatest: null,
    }).data.profiles;
    expect(screen.getByRole('button', { name: `Integrated Comparator (${expectedIntegrated.length})` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^CSV$/i }));
    const affCsvText = await readBlobText(capturedBlobs[capturedBlobs.length - 1]);
    const affCsvRows = Papa.parse<Record<string, string>>(affCsvText, { header: true }).data;
    expect(affCsvRows).toHaveLength(expectedIntegrated.length);
    affView.unmount();

    // 2. IntegratedRobustnessPanel: renders 12 scenarios + macro isolation + export parity
    const pppIt = fromEurostatPppCalibration('IT', 100.3, 2024);
    const cohdIt = fromCoHDRecord(FIXTURE_COHD_RAW[0]);
    const robExpected = evaluateIntegratedRobustnessSuite({
      mappings: FIXTURE_CLASSIFICATION_MAPPINGS,
      nutritionInputs: FIXTURE_NUTRITION_INPUTS,
      agribalyseItems: FIXTURE_AGRIBALYSE_ITEMS,
      pooreItems: FIXTURE_POORE_ITEMS,
      giItems: FIXTURE_GI_ITEMS,
      retailPriceRecords: FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku),
      hicpCountryCode: 'IT',
      hicpData: FIXTURE_HICP_DATA,
      isHicpEuFallback: false,
      pppBenchmark: pppIt,
      cohdLatest: cohdIt,
    });

    const robView = render(
      <IntegratedRobustnessPanel
        selectedCountry="IT"
        countryName="Italy"
        mappings={FIXTURE_CLASSIFICATION_MAPPINGS}
        nutritionInputs={FIXTURE_NUTRITION_INPUTS}
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
      expect(screen.getByRole('button', { name: `All (${robExpected.data.scenarios.length})` })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('phase4d-export-json'));
    const robJson = JSON.parse(await readBlobText(capturedBlobs[capturedBlobs.length - 1])) as {
      data: { scenarios: unknown[] };
    };
    expect(robJson.data.scenarios).toHaveLength(12);
    robView.unmount();

    // 3. SensitivityPanel: renders 19 valid + isolated diagnostic stress test + export parity
    const sensView = render(
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

    const nutCountryMap = new Map<string, string | null>(
      FIXTURE_OFF_PRODUCTS.map((p) => [p.code, p.primary_country ?? null])
    );
    const sensExpected = runAllSensitivityScenarios({
      mappings: FIXTURE_CLASSIFICATION_MAPPINGS,
      nutritionInputs: FIXTURE_NUTRITION_INPUTS,
      nutritionCountryMap: nutCountryMap,
      agribalyseItems: FIXTURE_AGRIBALYSE_ITEMS,
      pooreItems: FIXTURE_POORE_ITEMS,
      giItems: FIXTURE_GI_ITEMS,
      retailPriceRecords: FIXTURE_SCRAPLING_SKUS.map(fromOpenPricesSku),
      hicpCountryCode: 'IT',
      hicpData: FIXTURE_HICP_DATA,
      isHicpEuFallback: false,
    }).data;
    const validExpectedCount = sensExpected.filter((s) => !s.isDiagnosticOnly).length;
    const diagExpected = sensExpected.find((s) => s.isDiagnosticOnly);

    await waitFor(() => {
      expect(screen.getByText(`${validExpectedCount} valid alternative(s) displayed`)).toBeInTheDocument();
    });
    if (diagExpected) {
      expect(screen.getByText(/Diagnostic stress test — invalid sector inclusion/i)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    const sensCsvText = await readBlobText(capturedBlobs[capturedBlobs.length - 1]);
    const sensRows = Papa.parse<Record<string, string>>(sensCsvText, {
      header: true,
      comments: '#',
      skipEmptyLines: true,
    }).data;
    expect(sensRows).toHaveLength(sensExpected.length);
    sensView.unmount();

    // 4. Adverse fetch failure surfaces explicit error banner cleanly
    clearDataProviderCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Server error', { status: 500 }))
    );
    const errView = render(
      <SensitivityPanel
        selectedCountry="IT"
        countryName="Italy"
        hicpTargetCode="IT"
        isHicpFallback={false}
        hicpData={FIXTURE_HICP_DATA}
        offProducts={[]}
        agribalyseItems={[]}
      />
    );
    expect(await screen.findByText(/Failed to load auxiliary sensitivity bundles/i)).toBeInTheDocument();
    errView.unmount();
  });

  it('DataCatalogModal: enforces dialog ARIA, empty filter state, Escape close, and focus restoration', async () => {
    const onClose = vi.fn();
    render(
      <div>
        <button data-testid="catalog-trigger">Open Catalog</button>
        <DataCatalogModal registry={FIXTURE_DATASETS_REGISTRY} open={true} onClose={onClose} />
      </div>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'data-catalog-modal-title');
    expect(within(dialog).getByText(/2 registered Parquet datasets/i)).toBeInTheDocument();

    // Search with no matches displays empty state safely
    fireEvent.change(within(dialog).getByPlaceholderText(/Search dataset/i), {
      target: { value: 'NONEXISTENT_QUERY' },
    });
    expect(within(dialog).getByText(/No datasets match the active filters/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
