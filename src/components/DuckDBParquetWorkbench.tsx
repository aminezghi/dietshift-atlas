import { useEffect, useState } from 'react';
import ReactECharts from './ThemedEChart';
import { Database, Play, Sparkles, Terminal } from 'lucide-react';
import { runDuckDBQuery } from '../services/duckdbEngine';

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
    id: 'timesfm_validation',
    title: '3. Google TimesFM 2.0 vs. ETS forecast evaluation (2026–2030)',
    badge: 'ml_timesfm_forecasts.parquet',
    description:
      'Queries Google TimesFM 2.0 median & 10th–90th percentile forecasts and compares out-of-sample chronological validation MAE.',
    sql: `SELECT 
  country_label AS Country,
  indicator_name AS Indicator,
  year AS Forecast_Year,
  timesfm_p50 AS TimesFM_Median,
  timesfm_p10 AS TimesFM_P10,
  timesfm_p90 AS TimesFM_P90,
  ets_baseline AS ETS_Baseline,
  timesfm_val_mae AS TimesFM_MAE,
  ets_val_mae AS ETS_MAE
FROM ml_timesfm_forecasts
WHERE year IN (2026, 2028, 2030) AND indicator_name LIKE 'Plant-Protein%'
ORDER BY Country, Forecast_Year;`,
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
    title: '9. Global Farm-Level LCA & Transport Share (Poore & Nemecek 2018)',
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
    title: '10. Global Cost & Unaffordability of a Healthy Diet (World Bank/FAO 2024)',
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
];

export function DuckDBParquetWorkbench({ selectedCountry }: { selectedCountry: string }) {
  const [sql, setSql] = useState<string>(PRESET_QUERIES[0].sql);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState<{
    agribalyse: number;
    off: number;
    efsa: number;
    nsi: number;
    rosetta: number;
    timesfm: number;
    consumerPulse: number;
    socialDiscourse: number;
    giTerroir: number;
  }>({
    agribalyse: 2451,
    off: 3740,
    efsa: 1080,
    nsi: 150,
    rosetta: 15,
    timesfm: 448,
    consumerPulse: 8,
    socialDiscourse: 129,
    giTerroir: 6845,
  });

  const executeSql = async (queryToRun: string) => {
    setRunning(true);
    setError(null);
    try {
      const res = await runDuckDBQuery(queryToRun);
      setColumns(res.columns);
      setRows(res.rows);
      setElapsedMs(res.elapsedMs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const countRes = await runDuckDBQuery(`
          SELECT 
            (SELECT COUNT(*) FROM agribalyse) AS agb,
            (SELECT COUNT(*) FROM openfoodfacts) AS off_cnt,
            (SELECT COUNT(*) FROM efsa_foodex2) AS efsa_cnt,
            (SELECT COUNT(*) FROM nsi_subnational_quintiles) AS nsi_cnt,
            (SELECT COUNT(*) FROM crosswalk_rosetta) AS ros_cnt,
            (SELECT COUNT(*) FROM ml_timesfm_forecasts) AS tfm_cnt,
            (SELECT COUNT(*) FROM consumer_behavior_pulse) AS cbp_cnt,
            (SELECT COUNT(*) FROM social_discourse_velocity) AS sdv_cnt,
            (SELECT COUNT(*) FROM gi_terroir_registry) AS gi_cnt
        `);
        if (countRes.rows[0]) {
          setTableCounts({
            agribalyse: Number(countRes.rows[0].agb || 2451),
            off: Number(countRes.rows[0].off_cnt || 3740),
            efsa: Number(countRes.rows[0].efsa_cnt || 1080),
            nsi: Number(countRes.rows[0].nsi_cnt || 150),
            rosetta: Number(countRes.rows[0].ros_cnt || 15),
            timesfm: Number(countRes.rows[0].tfm_cnt || 448),
            consumerPulse: Number(countRes.rows[0].cbp_cnt || 8),
            socialDiscourse: Number(countRes.rows[0].sdv_cnt || 129),
            giTerroir: Number(countRes.rows[0].gi_cnt || 6845),
          });
        }
      } catch {
        // Fallback counts already set
      }
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

  return (
    <div className="space-y-5">
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 mb-4 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-4 h-4" />
              Section IV. DuckDB-Wasm Columnar SQL Engine over Apache Parquet
            </h2>
            <p className="almanac-label">
              Client-side analytical SQL over six ZSTD-compressed Parquet files registered in memory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
            <span className="px-2 py-0.5 almanac-well">
              agribalyse ({tableCounts.agribalyse.toLocaleString()})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              efsa_foodex2 ({tableCounts.efsa.toLocaleString()})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              openfoodfacts ({tableCounts.off.toLocaleString()})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              nsi_quintiles ({tableCounts.nsi})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              crosswalk_rosetta ({tableCounts.rosetta})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              ml_timesfm ({tableCounts.timesfm})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              consumer_pulse ({tableCounts.consumerPulse})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              social_discourse ({tableCounts.socialDiscourse})
            </span>
            <span className="px-2 py-0.5 almanac-well">
              gi_terroir ({tableCounts.giTerroir})
            </span>
          </div>
        </div>

        {/* Preset Query Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {PRESET_QUERIES.map((pq) => (
            <button
              key={pq.id}
              onClick={() => {
                setSql(pq.sql);
                executeSql(pq.sql);
              }}
              className="text-left p-3 almanac-well hover:bg-[var(--color-sheet)] transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="font-display-head font-semibold text-xs mb-1">{pq.title}</div>
                <p className="almanac-label text-xs leading-relaxed mb-2">{pq.description}</p>
              </div>
              <span className="text-[11px] font-mono-num text-[var(--color-accent)]">{pq.badge}</span>
            </button>
          ))}
        </div>

        {/* SQL Editor & Live Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="almanac-label flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                SQL statement editor (views: agribalyse, efsa_foodex2, openfoodfacts, crosswalk_rosetta, nsi_subnational_quintiles, ml_timesfm_forecasts)
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
            {error && (
              <div className="mt-2 p-2.5 almanac-well text-xs text-[var(--color-accent)] font-mono-num">
                SQL error: {error}
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
