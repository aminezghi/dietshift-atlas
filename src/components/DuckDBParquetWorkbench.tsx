import { useEffect, useState } from 'react';
import ReactECharts from './ThemedEChart';
import { Database, Play, Sparkles, Terminal } from 'lucide-react';
import { getDuckDBConnection, getDuckDBViewAvailability, runDuckDBQuery } from '../services/duckdbEngine';
import { classifyDuckDBSqlError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';

interface PresetQuery {
  id: string;
  title: string;
  badge: string;
  description: string;
  sql: string;
}

const PRESET_QUERIES: PresetQuery[] = [
  {
    id: 'rosetta_bridge',
    title: '1. Rosetta Stone crosswalk join (ECOICOP × FoodEx2 × Agribalyse)',
    badge: 'crosswalk_rosetta × efsa_foodex2',
    description:
      'Joins NSI household expenditure ECOICOP 5-digit codes with EFSA FoodEx2 dietary surveys and Agribalyse 3.1 LCA metrics.',
    sql: `SELECT 
  c.ecoicop_code AS ECOICOP_5D,
  c.ecoicop_label AS NSI_Budget_Category,
  c.foodex2_code AS FoodEx2,
  c.agb_code AS AGB_Code,
  c.nova_group AS NOVA,
  ROUND(AVG(e.mean_intake_g_day * c.edible_yield_factor), 1) AS Edible_Intake_g_d,
  c.mean_co2_kg AS LCA_CO2_kg
FROM crosswalk_rosetta c
JOIN efsa_foodex2 e ON c.foodex2_code = e.foodex2_code
WHERE e.population_group = 'Adults (18-64y)'
GROUP BY c.ecoicop_code, c.ecoicop_label, c.foodex2_code, c.agb_code, c.nova_group, c.mean_co2_kg
ORDER BY LCA_CO2_kg DESC;`,
  },
  {
    id: 'nsi_quintile_inequality',
    title: '2. NSI income quintile (Q1 vs. Q5) double-burden query',
    badge: 'nsi_subnational_quintiles.parquet (150 rows)',
    description:
      'Compares INE Spain, ISTAT Italy, CBS NL, INSEE FR, Destatis DE & ONS UK across income quintiles for Engel food share, NOVA 4 & BMI.',
    sql: `SELECT 
  country_name AS Country,
  income_quintile AS Quintile,
  ROUND(AVG(food_budget_share_pct), 1) AS Food_Budget_Pct,
  ROUND(AVG(nova4_energy_share_pct), 1) AS NOVA4_UPF_Pct,
  ROUND(AVG(diet_adherence_score), 1) AS Adherence_Score,
  ROUND(AVG(obesity_bmi30_pct), 1) AS Obesity_BMI30_Pct,
  ROUND(AVG(double_burden_index), 1) AS Double_Burden_Idx
FROM nsi_subnational_quintiles
WHERE quintile_num IN (1, 5)
GROUP BY country_name, income_quintile, quintile_num
ORDER BY country_name, quintile_num;`,
  },
  {
    id: 'statistical_forecast_validation',
    title: '3. Leak-free HICP statistical backtests & projections (2015–2030)',
    badge: 'statistical_price_forecasts.parquet',
    description:
      'Compares out-of-sample 2023–2025 held-out MAE/RMSE across Damped ETS, Holt ETS, Ridge trend, and Drift naive baselines on observed Eurostat/ONS HICP series.',
    sql: `SELECT 
  country_label AS Country,
  indicator_name AS Indicator,
  year AS Year,
  split_role AS Split,
  actual_value AS Observed,
  damped_ets_p50 AS Damped_ETS_P50,
  damped_ets_p10 AS P10_Lower,
  damped_ets_p90 AS P90_Upper,
  ets_baseline AS Holt_ETS,
  damped_ets_val_mae AS Damped_MAE,
  naive_val_mae AS Drift_Naive_MAE
FROM statistical_price_forecasts
WHERE year IN (2024, 2025, 2028, 2030) AND indicator_name LIKE 'Healthy Whole-Food%'
ORDER BY Country, Year;`,
  },
  {
    id: 'agribalyse_full_2451',
    title: '4. Full Agribalyse 3.1 (2,451 items) group footprint ranking',
    badge: 'agribalyse_31.parquet (2,451 rows)',
    description:
      'Queries the entire 2,451-row ADEME Agribalyse 3.1 Parquet table to rank food groups by climate change, water, and land use.',
    sql: `SELECT 
  Groupe_aliment AS Food_Group,
  COUNT(*) AS LCA_Items,
  ROUND(AVG(Changement_climatique_kg_CO2eq), 2) AS Mean_CO2_kg,
  ROUND(MAX(Changement_climatique_kg_CO2eq), 2) AS Max_CO2_kg,
  ROUND(AVG(Eau_m3), 2) AS Mean_Water_m3,
  ROUND(AVG(Sol_Pt), 1) AS Mean_Land_Pt
FROM agribalyse
GROUP BY Groupe_aliment
ORDER BY Mean_CO2_kg DESC;`,
  },
  {
    id: 'consumer_cascade_pulse',
    title: '5. Consumer intention-to-plate cascade & price elasticity',
    badge: 'consumer_behavior_pulse.parquet × social_discourse_velocity',
    description:
      'Queries the 5-stage behavioral cascade, own-price elasticities, and digital lead-lag cross-correlations across European jurisdictions.',
    sql: `SELECT 
  country_name AS Jurisdiction,
  stage1_digital_curiosity_pct AS S1_Digital_Curiosity,
  stage2_stated_sustainability_intent_pct AS S2_Stated_Intent_Pct,
  stage3_affordability_surviving_pct AS S3_Price_Surviving_Pct,
  stage4_retail_basket_purchase_pct AS S4_Retail_Purchase_Pct,
  stage5_efsa_Guideline_adherence_pct AS S5_Plate_Adherence_Pct,
  price_elasticity_healthy AS Healthy_Price_Elasticity,
  price_elasticity_plant_meat AS PlantMeat_Elasticity,
  optimal_lag_months AS Lead_Lag_Months,
  search_to_purchase_corr_r AS Lag_Corr_R
FROM consumer_behavior_pulse
ORDER BY S5_Plate_Adherence_Pct DESC;`,
  },
  {
    id: 'gi_terroir_vs_lca',
    title: '6. EUIPO GIview & Qualigeo by Sector (3,037 Food / 6,845 Total)',
    badge: 'gi_terroir_registry.parquet (6,845 rows)',
    description:
      'Separates the 3,037 dietary Agro-Foodstuffs (FOOD) from Wine (3,198), Spirits (499) & Craft (111) across all 6,845 EUIPO + Qualigeo records.',
    sql: `SELECT 
  product_sector AS Sector,
  eu_class AS EU_GI_Class,
  COUNT(*) AS Protected_GI_Count,
  ROUND(AVG(nova_group), 1) AS Mean_NOVA,
  ROUND(AVG(co2_kg_per_kg), 2) AS Mean_CO2_kg,
  ROUND(AVG(water_L_per_kg), 0) AS Mean_Water_L,
  ROUND(AVG(price_premium_pct), 1) AS Price_Premium_Pct
FROM gi_terroir_registry
GROUP BY product_sector, eu_class
ORDER BY Protected_GI_Count DESC;`,
  },
  {
    id: 'time_use_poverty',
    title: '7. Time Poverty & Cooking Friction (Multinational Time Use Study)',
    badge: 'time_use_cooking_friction.parquet',
    description:
      'Queries daily food preparation minutes vs. convenience food expenditure share across income quintiles (MTUS/ATUS).',
    sql: `SELECT 
  country_name AS Country,
  income_quintile AS Quintile,
  daily_cooking_food_prep_min AS Cooking_Prep_Min,
  daily_eating_drinking_min AS Eating_Min,
  daily_grocery_shopping_min AS Shopping_Min,
  total_food_time_min AS Total_Food_Min,
  convenience_food_expenditure_share_pct AS Convenience_Share_Pct,
  culinary_time_poverty_rate_pct AS Time_Poverty_Rate_Pct
FROM time_use_cooking_friction
WHERE income_quintile IN ('Q1 (Lowest)', 'Q3 (Median)', 'Q5 (Highest)')
ORDER BY Country, income_quintile;`,
  },
  {
    id: 'clinical_nhanes',
    title: '8. Clinical Biomarker Grounding (NHANES Cohort Validation)',
    badge: 'clinical_biomarker_grounding.parquet',
    description:
      'Evaluates objective lab biomarkers (cholesterol, HbA1c, hs-CRP inflammation, blood pressure) across 5 dietary patterns.',
    sql: `SELECT 
  dietary_pattern AS Dietary_Pattern,
  mean_fiber_g_day AS Fiber_g_day,
  plant_protein_share_pct AS Plant_Protein_Pct,
  total_cholesterol_mg_dl AS Total_Cholesterol,
  ldl_cholesterol_mg_dl AS LDL_Cholesterol,
  hs_crp_inflammation_mg_l AS hs_CRP_Inflammation,
  systolic_bp_mmhg AS Systolic_BP,
  cardiovascular_risk_delta_pct AS CVD_Risk_Delta_Pct
FROM clinical_biomarker_grounding
ORDER BY CVD_Risk_Delta_Pct ASC;`,
  },
  {
    id: 'school_canteen_policy',
    title: '9. Public School Meals & Organic Mandates (GCNF Survey)',
    badge: 'school_meals_procurement.parquet',
    description:
      'Compares legal frameworks (France EGALIM, Italy CAM, Germany DGE) for public canteen plant-based quotas and organic procurement.',
    sql: `SELECT 
  country_name AS Country,
  legal_framework AS Legal_Framework,
  mandatory_plant_days_per_week AS Mandatory_Veg_Days_Wk,
  organic_procurement_quota_pct AS Organic_Quota_Pct,
  sustainable_quality_quota_pct AS Quality_Quota_Pct,
  local_terroir_priority AS Local_Terroir_Priority,
  students_served_daily_m AS Students_M,
  annual_procurement_budget_eur_m AS Budget_EUR_M
FROM school_meals_procurement
ORDER BY Students_M DESC;`,
  },
  {
    id: 'poore_global_lca',
    title: '10. Global Farm-Level LCA & Transport Share (Poore & Nemecek 2018)',
    badge: 'global_poore_nemecek_lca.parquet (45 rows)',
    description:
      '38,700 farms in 119 countries: decomposes total kg CO2eq/kg across farm, land use, feed, transport, and freshwater withdrawals.',
    sql: `SELECT
  food_item AS Commodity,
  ghg_kg_co2eq_per_kg AS Total_GHG_kg,
  stage_land_use + stage_farm + stage_animal_feed AS Farm_Land_Feed_CO2,
  stage_transport AS Transport_CO2,
  transport_share_pct AS Transport_Pct,
  land_use_m2_per_kg AS Land_m2_kg,
  freshwater_withdrawals_l_per_kg AS Water_L_kg,
  ghg_kg_per_100g_protein AS GHG_per_100g_Protein
FROM global_poore_nemecek_lca
ORDER BY Total_GHG_kg DESC;`,
  },
  {
    id: 'wb_cohd_global',
    title: '11. Global Cost & Unaffordability of a Healthy Diet (World Bank/FAO 2024)',
    badge: 'global_healthy_diet_affordability.parquet (1,399 rows)',
    description:
      'Cross-country ICP PPP$/day cost of a healthy diet, population share unable to afford it, and cost-to-food-expenditure ratio.',
    sql: `SELECT
  iso3,
  country_name AS Country,
  year,
  cost_healthy_diet_ppp_usd AS Cost_PPP_USD_Day,
  unaffordable_pct AS Unaffordable_Pct,
  unaffordable_millions AS Unaffordable_M
FROM global_healthy_diet_affordability
WHERE year = 2024
  AND iso3 IN ('ITA','FRA','DEU','ESP','NLD','POL','SWE','GBR','USA','BRA','IND','CHN','JPN','NGA')
ORDER BY Unaffordable_Pct DESC NULLS LAST;`,
  },
  {
    id: 'classification_audit',
    title: '12. Multi-taxonomy harmonisation & unmatched gap audit',
    badge: 'classification_mappings.parquet (161 rules)',
    description:
      'Summarizes exact, hierarchical, approximate, ambiguous, and unmatched classification bridges across Agribalyse, FoodEx2, Open Food Facts, and COICOP.',
    sql: `SELECT 
  source_system AS Source_Taxonomy,
  target_system AS Target_Taxonomy,
  mapping_type AS Relationship,
  COUNT(*) AS Mapping_Rules,
  SUM(source_item_count) AS Source_Items_Covered
FROM classification_mappings
GROUP BY source_system, target_system, mapping_type
ORDER BY source_system, Mapping_Rules DESC;`,
  },
  {
    id: 'gi_statutory_municipalities',
    title: '13. Statutory Municipality GI Index (50,763 LAU)',
    badge: 'parquet_statutory/gi_municipality_index.parquet',
    description:
      'Ranks top NUTS-3 provinces/départements across France (36,239 communes), Italy (7,893 comuni), and Spain (6,631 municipios) by statutory GI density and plant-terroir share.',
    sql: `SELECT
  country_code AS Country,
  province_or_dept AS Province_Dept,
  COUNT(*) AS Municipalities,
  ROUND(AVG(gi_product_count), 2) AS Mean_GIs_Per_Municipality,
  MAX(gi_product_count) AS Max_GIs_In_Single_LAU,
  ROUND(AVG(CASE WHEN has_plant_gi THEN 100.0 ELSE 0.0 END), 1) AS Plant_GI_Coverage_Pct
FROM gi_municipality_index
GROUP BY country_code, province_or_dept
HAVING COUNT(*) >= 10
ORDER BY Mean_GIs_Per_Municipality DESC, Municipalities DESC
LIMIT 25;`,
  },
];

export function DuckDBParquetWorkbench({ selectedCountry }: { selectedCountry: string }) {
  const [sql, setSql] = useState<string>(PRESET_QUERIES[0].sql);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [sqlDisclosure, setSqlDisclosure] = useState<ResourceDisclosure | null>(null);
  const [countsLoaded, setCountsLoaded] = useState<boolean>(false);
  const [tableCounts, setTableCounts] = useState<{
    agribalyse: number | null;
    off: number | null;
    efsa: number | null;
    nsi: number | null;
    rosetta: number | null;
    mappings: number | null;
    forecasts: number | null;
    consumerPulse: number | null;
    socialDiscourse: number | null;
    giTerroir: number | null;
    cohd: number | null;
    poore: number | null;
    scrapling: number | null;
  }>({
    agribalyse: null,
    off: null,
    efsa: null,
    nsi: null,
    rosetta: null,
    mappings: null,
    forecasts: null,
    consumerPulse: null,
    socialDiscourse: null,
    giTerroir: null,
    cohd: null,
    poore: null,
    scrapling: null,
  });

  const executeSql = async (queryToRun: string) => {
    setRunning(true);
    setSqlDisclosure(null);
    try {
      const res = await runDuckDBQuery(queryToRun);
      setColumns(res.columns);
      setRows(res.rows);
      setElapsedMs(res.elapsedMs);
    } catch (err: unknown) {
      setSqlDisclosure(classifyDuckDBSqlError(err));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    const viewProbePairs: Array<[keyof typeof tableCounts, string]> = [
      ['agribalyse', 'agribalyse'],
      ['off', 'openfoodfacts'],
      ['efsa', 'efsa_foodex2'],
      ['nsi', 'nsi_subnational_quintiles'],
      ['rosetta', 'crosswalk_rosetta'],
      ['mappings', 'classification_mappings'],
      ['forecasts', 'statistical_price_forecasts'],
      ['consumerPulse', 'consumer_behavior_pulse'],
      ['socialDiscourse', 'social_discourse_velocity'],
      ['giTerroir', 'gi_terroir_registry'],
      ['cohd', 'global_healthy_diet_affordability'],
      ['poore', 'global_poore_nemecek_lca'],
      ['scrapling', 'scrapling_retail_claims'],
    ];

    (async () => {
      await getDuckDBConnection();
      const { unavailableViews } = getDuckDBViewAvailability();
      const unavailableSet = new Set(unavailableViews);
      const probedCounts: Partial<typeof tableCounts> = {};
      for (const [stateKey, viewName] of viewProbePairs) {
        if (unavailableSet.has(viewName)) {
          probedCounts[stateKey] = null;
          continue;
        }
        try {
          const r = await runDuckDBQuery(`SELECT COUNT(*) AS cnt FROM ${viewName}`);
          const cnt = r.rows[0]?.cnt;
          const num = typeof cnt === 'number' ? cnt : Number(cnt);
          probedCounts[stateKey] = Number.isFinite(num) ? num : null;
        } catch {
          probedCounts[stateKey] = null;
        }
      }

      setTableCounts((prev) => ({ ...prev, ...probedCounts }));
      setCountsLoaded(true);
      executeSql(PRESET_QUERIES[0].sql);
    })();
  }, []);

  const filterCountrySql = () => {
    const q = `SELECT 
  region_name AS NUTS2_Region,
  income_quintile AS Income_Quintile,
  food_budget_share_pct AS Food_Budget_Pct,
  nova4_energy_share_pct AS NOVA4_Share_Pct,
  diet_adherence_score AS Adherence_Score,
  double_burden_index AS Double_Burden_Idx,
  cluster_label AS ML_Cluster_Archetype
FROM nsi_subnational_quintiles
WHERE country_code = '${['ES', 'IT', 'NL', 'FR', 'DE', 'GBR'].includes(selectedCountry) ? selectedCountry : 'IT'}'
ORDER BY region_name, quintile_num;`;
    setSql(q);
    executeSql(q);
  };

  /* Hallmark data-viz.md: Bars <= 24px thick, baseline at zero, single accent color */
  const chartOption = (() => {
    if (rows.length === 0 || columns.length < 2) return null;
    const labelCol = columns[0];
    const numCols = columns.slice(1).filter((c) => typeof rows[0][c] === 'number');
    if (numCols.length === 0) return null;
    const primaryNumCol = numCols[numCols.length - 1];

    const topRows = rows.slice(0, 14);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      grid: { top: 24, right: 24, bottom: 68, left: 68 },
      xAxis: {
        type: 'category',
        data: topRows.map((r) => String(r[labelCol]).slice(0, 20)),
        axisLabel: {
          color: '#3d4654',
          fontSize: 10,
          rotate: 22,
          margin: 10,
          interval: 0,
          fontFamily: 'Newsreader, Georgia, serif',
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: primaryNumCol,
        nameLocation: 'middle',
        nameGap: 48,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: primaryNumCol,
          type: 'bar',
          barMaxWidth: 20,
          itemStyle: { color: '#8a1253', borderRadius: [2, 2, 0, 0] },
          data: topRows.map((r) => Number(r[primaryNumCol] || 0)),
        },
      ],
    };
  })();

  const formatCount = (n: number | null) =>
    n !== null ? n.toLocaleString() : countsLoaded ? 'excluded' : '…';

  const trackBInactivePresets = new Set(
    [
      countsLoaded && tableCounts.giTerroir === null ? 'gi_terroir_vs_lca' : null,
      countsLoaded && tableCounts.socialDiscourse === null ? 'time_use_poverty' : null,
    ].filter(Boolean) as string[]
  );

  return (
    <div className="space-y-5">
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 mb-4 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-4 h-4" />
              Section V. DuckDB-Wasm Columnar SQL Engine over Apache Parquet
            </h2>
            <p className="almanac-label">
              Client-side analytical SQL over ZSTD-compressed Apache Parquet files available in this archive ({countsLoaded && tableCounts.giTerroir === null ? '13 open Track A tables active; 6 Track B tables excluded' : 'up to 19 Parquet views registered in browser memory'}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
            <span className="px-2 py-0.5 almanac-well">
              agribalyse ({formatCount(tableCounts.agribalyse)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              efsa_foodex2 ({formatCount(tableCounts.efsa)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              openfoodfacts ({formatCount(tableCounts.off)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              nsi_quintiles ({formatCount(tableCounts.nsi)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              crosswalk_rosetta ({formatCount(tableCounts.rosetta)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              classification_mappings ({formatCount(tableCounts.mappings)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              statistical_price_forecasts ({formatCount(tableCounts.forecasts)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              scrapling_retail ({formatCount(tableCounts.scrapling)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              wb_cohd ({formatCount(tableCounts.cohd)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              poore_lca ({formatCount(tableCounts.poore)})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              gi_terroir ({formatCount(tableCounts.giTerroir)})
            </span>
          </div>
        </div>

        {/* Preset Query Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {PRESET_QUERIES.map((pq) => {
            const isTrackBUnavailable = trackBInactivePresets.has(pq.id);
            return (
              <button
                key={pq.id}
                onClick={() => {
                  setSql(pq.sql);
                  executeSql(pq.sql);
                }}
                className={`text-left p-3 almanac-well hover:bg-[var(--color-sheet)] transition cursor-pointer flex flex-col justify-between ${
                  isTrackBUnavailable ? 'opacity-75 border border-dashed border-[#6b4c1b]/60' : ''
                }`}
              >
                <div>
                  <div className="font-display-head font-semibold text-xs mb-1">
                    {pq.title}
                    {isTrackBUnavailable && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono-num border border-[#6b4c1b]/50 text-[#6b4c1b]">
                        Track B Excluded
                      </span>
                    )}
                  </div>
                  <p className="almanac-label text-xs leading-relaxed mb-2">{pq.description}</p>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--color-accent)]">{pq.badge}</span>
              </button>
            );
          })}
        </div>

        {/* SQL Editor & Live Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="almanac-label flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                SQL statement editor (open views: agribalyse, efsa_foodex2, openfoodfacts, crosswalk_rosetta, nsi_subnational_quintiles, statistical_price_forecasts, scrapling_retail_claims, ...)
              </span>
              <div className="flex items-center gap-2">
                <button onClick={filterCountrySql} className="almanac-btn flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Query NSI ({selectedCountry})
                </button>
                <button
                  onClick={() => executeSql(sql)}
                  disabled={running}
                  className="almanac-btn almanac-btn--primary flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" /> {running ? 'Running...' : 'Execute SQL'}
                </button>
              </div>
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={8}
              className="w-full almanac-ink-band p-3 font-mono-num text-xs focus:outline-none"
            />
            {sqlDisclosure && (
              <div className="mt-2">
                <ResourceDisclosureBanner disclosure={sqlDisclosure} compact />
              </div>
            )}
          </div>

          <div className="xl:col-span-5 almanac-well p-3 flex flex-col">
            <div className="flex items-center justify-between almanac-label mb-1">
              <span>Query output plot</span>
              {elapsedMs !== null && (
                <span className="font-mono-num text-[var(--color-accent)]">
                  {elapsedMs} ms ({rows.length} rows)
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[200px]">
              {chartOption ? (
                <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              ) : (
                <div className="h-full flex items-center justify-center almanac-label">
                  Execute a query returning numeric columns to render chart
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="almanac-sheet p-5">
        <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
          <h3 className="text-sm font-semibold">
            Parquet query result set ({rows.length} rows returned)
          </h3>
          {elapsedMs !== null && (
            <span className="font-mono-num text-xs text-[var(--color-accent)]">
              Execution time: {elapsedMs} ms
            </span>
          )}
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="almanac-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, rIdx) => (
                <tr key={rIdx}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={typeof r[col] === 'number' ? 'num text-right' : ''}
                    >
                      {String(r[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
