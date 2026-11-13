import { useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import Papa from 'papaparse';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  COUNTRY_PROFILES,
  type AgribalyseItem,
  type CustomBasketItem,
} from '../types/research';

const DEFAULT_BASKET: CustomBasketItem[] = [
  {
    id: 'b1',
    foodName: 'Wholegrain oats & sourdough bread',
    foodEx2Category: 'Whole Grains',
    gramsPerDay: 210,
    novaGroup: 1,
    carbonPerKg: 0.95,
    waterM3PerKg: 0.18,
    landPtPerKg: 1.4,
    kcalPer100g: 265,
    proteinPer100g: 9.5,
    costEurPerKg: 3.2,
  },
  {
    id: 'b2',
    foodName: 'Cooked lentils, chickpeas & tofu',
    foodEx2Category: 'Legumes & Nuts',
    gramsPerDay: 115,
    novaGroup: 1,
    carbonPerKg: 0.92,
    waterM3PerKg: 0.24,
    landPtPerKg: 1.9,
    kcalPer100g: 135,
    proteinPer100g: 11.2,
    costEurPerKg: 4.1,
  },
  {
    id: 'b3',
    foodName: 'Seasonal vegetables & leafy greens',
    foodEx2Category: 'Vegetables & Fruits',
    gramsPerDay: 320,
    novaGroup: 1,
    carbonPerKg: 0.65,
    waterM3PerKg: 0.14,
    landPtPerKg: 0.6,
    kcalPer100g: 42,
    proteinPer100g: 2.1,
    costEurPerKg: 3.5,
  },
  {
    id: 'b4',
    foodName: 'Temperate fresh fruits & berries',
    foodEx2Category: 'Vegetables & Fruits',
    gramsPerDay: 220,
    novaGroup: 1,
    carbonPerKg: 0.78,
    waterM3PerKg: 0.28,
    landPtPerKg: 0.8,
    kcalPer100g: 58,
    proteinPer100g: 0.8,
    costEurPerKg: 3.9,
  },
  {
    id: 'b5',
    foodName: 'Fermented yogurt & fortified oat drink',
    foodEx2Category: 'Dairy',
    gramsPerDay: 200,
    novaGroup: 2,
    carbonPerKg: 1.35,
    waterM3PerKg: 0.18,
    landPtPerKg: 1.6,
    kcalPer100g: 64,
    proteinPer100g: 3.6,
    costEurPerKg: 2.4,
  },
  {
    id: 'b6',
    foodName: 'Bovine & porcine meat (weekly mean)',
    foodEx2Category: 'Red Meat',
    gramsPerDay: 28,
    novaGroup: 1,
    carbonPerKg: 24.5,
    waterM3PerKg: 1.55,
    landPtPerKg: 28.0,
    kcalPer100g: 225,
    proteinPer100g: 24.0,
    costEurPerKg: 14.5,
  },
  {
    id: 'b7',
    foodName: 'Extruded plant-based burger & snack',
    foodEx2Category: 'Ultra-Processed',
    gramsPerDay: 45,
    novaGroup: 4,
    carbonPerKg: 2.85,
    waterM3PerKg: 0.35,
    landPtPerKg: 3.2,
    kcalPer100g: 240,
    proteinPer100g: 14.5,
    costEurPerKg: 11.2,
  },
];

interface ResearcherSandboxProps {
  selectedCountry: string;
  agribalyseCatalog: AgribalyseItem[];
}

export function ResearcherSandbox({ selectedCountry, agribalyseCatalog }: ResearcherSandboxProps) {
  const [basket, setBasket] = useState<CustomBasketItem[]>(DEFAULT_BASKET);
  const [selectedAgbCode, setSelectedAgbCode] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [agbSearch, setAgbSearch] = useState<string>('');

  const baselineProfile = COUNTRY_PROFILES[selectedCountry] || COUNTRY_PROFILES.IT;

  const basketSummary = useMemo(() => {
    let totalGrams = 0;
    let totalCarbonKg = 0;
    let totalWaterL = 0;
    let totalLandM2 = 0;
    let totalKcal = 0;
    let totalProteinG = 0;
    let totalCostEur = 0;
    let nova4Kcal = 0;

    const catGrams: Record<string, number> = {
      'Red Meat': 0,
      Dairy: 0,
      'Legumes & Nuts': 0,
      'Whole Grains': 0,
      'Vegetables & Fruits': 0,
      'Ultra-Processed': 0,
    };

    basket.forEach((item) => {
      const kg = item.gramsPerDay / 1000.0;
      const itemKcal = (item.gramsPerDay / 100.0) * item.kcalPer100g;
      const itemProt = (item.gramsPerDay / 100.0) * item.proteinPer100g;

      totalGrams += item.gramsPerDay;
      totalCarbonKg += kg * item.carbonPerKg;
      totalWaterL += kg * item.waterM3PerKg * 1000.0;
      totalLandM2 += kg * item.landPtPerKg * 0.25;
      totalKcal += itemKcal;
      totalProteinG += itemProt;
      totalCostEur += kg * item.costEurPerKg;

      if (item.novaGroup === 4) {
        nova4Kcal += itemKcal;
      }
      catGrams[item.foodEx2Category] = (catGrams[item.foodEx2Category] || 0) + item.gramsPerDay;
    });

    const upfSharePct = totalKcal > 0 ? Math.round((nova4Kcal / totalKcal) * 100) : 0;

    const eatLancetBasket = {
      redMeat: Math.min(400, Math.round((catGrams['Red Meat'] / 28.0) * 100)),
      dairy: Math.min(300, Math.round((catGrams.Dairy / 250.0) * 100)),
      legumesNuts: Math.min(150, Math.round((catGrams['Legumes & Nuts'] / 125.0) * 100)),
      wholeGrains: Math.min(150, Math.round((catGrams['Whole Grains'] / 232.0) * 100)),
      vegetablesFruits: Math.min(150, Math.round((catGrams['Vegetables & Fruits'] / 500.0) * 100)),
      ultraProcessedShare: Math.min(70, upfSharePct),
    };

    return {
      totalGrams: Math.round(totalGrams),
      totalCarbonKg: +totalCarbonKg.toFixed(2),
      totalWaterL: Math.round(totalWaterL),
      totalLandM2: +totalLandM2.toFixed(2),
      totalKcal: Math.round(totalKcal),
      totalProteinG: +totalProteinG.toFixed(1),
      totalCostEur: +totalCostEur.toFixed(2),
      upfSharePct,
      eatLancetBasket,
    };
  }, [basket]);

  const addAgribalyseToBasket = () => {
    const agb = agribalyseCatalog.find((a) => a.Code_AGB === selectedAgbCode);
    if (!agb) return;
    appendAgribalyseItem(agb);
  };

  const appendAgribalyseItem = (agb: AgribalyseItem) => {
    const grp = (agb.Groupe_aliment || agb["Groupe_d'aliment"] || '').toLowerCase();
    let cat = 'Vegetables & Fruits';
    let nova = 1;
    if (grp.includes('viande') || grp.includes('meat')) cat = 'Red Meat';
    else if (grp.includes('lait') || grp.includes('fromage')) cat = 'Dairy';
    else if (grp.includes('céréal')) cat = 'Whole Grains';
    else if (grp.includes('légumineuse') || grp.includes('oléagineux')) cat = 'Legumes & Nuts';
    else if (grp.includes('plat') || grp.includes('sucr')) {
      cat = 'Ultra-Processed';
      nova = 4;
    }

    const co2 = Number(agb.Changement_climatique_kg_CO2eq ?? agb.Changement_climatique ?? 2.0);
    const water = Number(agb.Eau_m3 ?? agb['Épuisement_des_ressources_eau'] ?? 0.3);
    const land = Number(agb.Sol_Pt ?? agb.Utilisation_du_sol ?? 5.0);

    setBasket((prev) => [
      ...prev,
      {
        id: `agb-${Date.now()}`,
        foodName: agb.LCI_Name || agb.Nom_du_Produit_en_Francais || 'Agribalyse item',
        foodEx2Category: cat,
        gramsPerDay: 85,
        novaGroup: nova,
        carbonPerKg: +co2.toFixed(2),
        waterM3PerKg: +water.toFixed(2),
        landPtPerKg: +land.toFixed(1),
        kcalPer100g: 165,
        proteinPer100g: 9.0,
        costEurPerKg: 5.5,
      },
    ]);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedItems: CustomBasketItem[] = results.data
          .map((row, idx) => ({
            id: `csv-${idx}-${Date.now()}`,
            foodName: row.food_name || row.FoodName || row.product_name || `Survey item ${idx + 1}`,
            foodEx2Category: row.category || row.FoodEx2_Category || 'Vegetables & Fruits',
            gramsPerDay: Number(row.grams_per_day || row.GramsPerDay || 100),
            novaGroup: Number(row.nova_group || row.NOVA || 1),
            carbonPerKg: Number(row.carbon_kg_per_kg || row.CarbonPerKg || 1.8),
            waterM3PerKg: Number(row.water_m3_per_kg || row.WaterM3PerKg || 0.25),
            landPtPerKg: Number(row.land_pt_per_kg || row.LandPtPerKg || 2.0),
            kcalPer100g: Number(row.kcal_100g || 140),
            proteinPer100g: Number(row.protein_100g || 6.5),
            costEurPerKg: Number(row.cost_eur_per_kg || 4.5),
          }))
          .filter((it) => it.gramsPerDay > 0);

        if (parsedItems.length > 0) {
          setBasket(parsedItems);
          setUploadStatus(`Loaded ${parsedItems.length} dietary survey rows from "${file.name}"`);
        }
      },
    });
  };

  const downloadSampleTemplateCsv = () => {
    const headers = [
      'food_name',
      'category',
      'grams_per_day',
      'nova_group',
      'carbon_kg_per_kg',
      'water_m3_per_kg',
      'land_pt_per_kg',
      'kcal_100g',
      'protein_100g',
      'cost_eur_per_kg',
    ];
    const rows = basket.map((b) => [
      `"${b.foodName.replace(/"/g, '""')}"`,
      `"${b.foodEx2Category}"`,
      b.gramsPerDay,
      b.novaGroup,
      b.carbonPerKg,
      b.waterM3PerKg,
      b.landPtPerKg,
      b.kcalPer100g,
      b.proteinPer100g,
      b.costEurPerKg,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dietshift_researcher_survey_template.csv';
    a.click();
  };

  const sandboxRadarOption = useMemo(() => {
    const b = basketSummary.eatLancetBasket;
    const nat = baselineProfile.eatLancetIndex;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        bottom: 0,
        itemGap: 14,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        data: [
          'Custom survey basket',
          `${baselineProfile.name} baseline`,
          'EAT-Lancet (100%)',
        ],
      },
      radar: {
        radius: '54%',
        center: ['50%', '43%'],
        nameGap: 10,
        indicator: [
          { name: 'Red meat\n(% max)', max: 400 },
          { name: 'Dairy\n(% target)', max: 300 },
          { name: 'Legumes & nuts\n(% target)', max: 150 },
          { name: 'Whole grains\n(% target)', max: 150 },
          { name: 'Veg & fruits\n(% target)', max: 150 },
          { name: 'NOVA 4 UPF\n(% kcal)', max: 70 },
        ],
        axisName: { color: '#2d3643', fontSize: 11, lineHeight: 14, fontFamily: 'Newsreader, Georgia, serif' },
        splitArea: { areaStyle: { color: ['rgba(207,213,223,0.4)', 'rgba(234,237,242,0.4)'] } },
        axisLine: { lineStyle: { color: '#aeb6c4' } },
        splitLine: { lineStyle: { color: '#aeb6c4' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [
                b.redMeat,
                b.dairy,
                b.legumesNuts,
                b.wholeGrains,
                b.vegetablesFruits,
                b.ultraProcessedShare,
              ],
              name: 'Custom survey basket',
              itemStyle: { color: '#8a1253' },
              areaStyle: { color: 'rgba(138, 18, 83, 0.16)' },
              lineStyle: { width: 2.5 },
            },
            {
              value: [
                nat.redMeat,
                nat.dairy,
                nat.legumesNuts,
                nat.wholeGrains,
                nat.vegetablesFruits,
                nat.ultraProcessedShare,
              ],
              name: `${baselineProfile.name} baseline`,
              itemStyle: { color: '#111827' },
              areaStyle: { color: 'rgba(17, 24, 39, 0.08)' },
              lineStyle: { width: 1.5, type: 'dashed' },
            },
            {
              value: [100, 100, 100, 100, 100, 15],
              name: 'EAT-Lancet (100%)',
              itemStyle: { color: '#163d4a' },
              lineStyle: { width: 1.5, type: 'dotted' },
            },
          ],
        },
      ],
    };
  }, [basketSummary, baselineProfile]);

  return (
    <div className="space-y-5">
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4" />
              Section V. Researcher Dietary Survey Upload and Custom Basket Ledger
            </h2>
            <p className="almanac-label">
              Upload a dietary recall or household basket CSV, or append items from the 2,451-entry Agribalyse 3.1
              inventory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => {
                const key = e.target.value;
                if (!key) return;
                const presets: Record<string, typeof DEFAULT_BASKET> = {
                  med: [
                    { id: 'm1', foodName: 'Extra-virgin olive oil', foodEx2Category: 'Fats & Oils', gramsPerDay: 35, novaGroup: 2, carbonPerKg: 3.1, waterM3PerKg: 1.47, landPtPerKg: 3.8, kcalPer100g: 884, proteinPer100g: 0.0, costEurPerKg: 9.5 },
                    { id: 'm2', foodName: 'Whole-wheat sourdough bread', foodEx2Category: 'Whole Grains', gramsPerDay: 140, novaGroup: 3, carbonPerKg: 0.9, waterM3PerKg: 0.11, landPtPerKg: 1.3, kcalPer100g: 250, proteinPer100g: 9.0, costEurPerKg: 3.4 },
                    { id: 'm3', foodName: 'Cooked chickpeas & lentils', foodEx2Category: 'Legumes', gramsPerDay: 110, novaGroup: 1, carbonPerKg: 0.85, waterM3PerKg: 0.41, landPtPerKg: 2.1, kcalPer100g: 130, proteinPer100g: 8.9, costEurPerKg: 2.8 },
                    { id: 'm4', foodName: 'Fresh tomatoes & leafy greens', foodEx2Category: 'Vegetables', gramsPerDay: 280, novaGroup: 1, carbonPerKg: 0.65, waterM3PerKg: 0.03, landPtPerKg: 0.5, kcalPer100g: 22, proteinPer100g: 1.8, costEurPerKg: 2.9 },
                    { id: 'm5', foodName: 'Sardines / wild pelagic fish', foodEx2Category: 'Seafood', gramsPerDay: 65, novaGroup: 1, carbonPerKg: 2.4, waterM3PerKg: 0.02, landPtPerKg: 0.8, kcalPer100g: 208, proteinPer100g: 24.6, costEurPerKg: 11.0 },
                    { id: 'm6', foodName: 'Aged Pecorino / sheep cheese', foodEx2Category: 'Dairy', gramsPerDay: 30, novaGroup: 3, carbonPerKg: 14.2, waterM3PerKg: 0.52, landPtPerKg: 8.5, kcalPer100g: 387, proteinPer100g: 26.0, costEurPerKg: 18.0 },
                    { id: 'm7', foodName: 'Seasonal orchard fruit', foodEx2Category: 'Fruits', gramsPerDay: 220, novaGroup: 1, carbonPerKg: 0.45, waterM3PerKg: 0.08, landPtPerKg: 0.6, kcalPer100g: 52, proteinPer100g: 0.5, costEurPerKg: 2.5 },
                  ],
                  plant: [
                    { id: 'p1', foodName: 'Fortified soy & oat drink', foodEx2Category: 'Plant Dairy', gramsPerDay: 220, novaGroup: 3, carbonPerKg: 0.72, waterM3PerKg: 0.03, landPtPerKg: 0.6, kcalPer100g: 45, proteinPer100g: 3.3, costEurPerKg: 2.1 },
                    { id: 'p2', foodName: 'Organic tofu & tempeh', foodEx2Category: 'Legumes', gramsPerDay: 110, novaGroup: 3, carbonPerKg: 1.45, waterM3PerKg: 0.19, landPtPerKg: 1.7, kcalPer100g: 145, proteinPer100g: 15.5, costEurPerKg: 6.2 },
                    { id: 'p3', foodName: 'Red lentils & black beans', foodEx2Category: 'Legumes', gramsPerDay: 130, novaGroup: 1, carbonPerKg: 0.82, waterM3PerKg: 0.39, landPtPerKg: 1.9, kcalPer100g: 120, proteinPer100g: 9.0, costEurPerKg: 2.6 },
                    { id: 'p4', foodName: 'Whole oats & brown rice', foodEx2Category: 'Whole Grains', gramsPerDay: 160, novaGroup: 1, carbonPerKg: 1.15, waterM3PerKg: 0.16, landPtPerKg: 1.5, kcalPer100g: 360, proteinPer100g: 11.2, costEurPerKg: 2.4 },
                    { id: 'p5', foodName: 'Cruciferous & root vegetables', foodEx2Category: 'Vegetables', gramsPerDay: 310, novaGroup: 1, carbonPerKg: 0.52, waterM3PerKg: 0.03, landPtPerKg: 0.4, kcalPer100g: 32, proteinPer100g: 2.4, costEurPerKg: 2.3 },
                    { id: 'p6', foodName: 'Walnuts & flaxseeds', foodEx2Category: 'Nuts & Seeds', gramsPerDay: 30, novaGroup: 1, carbonPerKg: 1.9, waterM3PerKg: 0.49, landPtPerKg: 2.8, kcalPer100g: 620, proteinPer100g: 16.5, costEurPerKg: 14.5 },
                  ],
                  upf: [
                    { id: 'u1', foodName: 'Processed beef burger patty', foodEx2Category: 'Red Meat', gramsPerDay: 130, novaGroup: 4, carbonPerKg: 28.5, waterM3PerKg: 1.54, landPtPerKg: 24.0, kcalPer100g: 270, proteinPer100g: 17.5, costEurPerKg: 11.2 },
                    { id: 'u2', foodName: 'Sugar-sweetened cola', foodEx2Category: 'Beverages', gramsPerDay: 350, novaGroup: 4, carbonPerKg: 0.55, waterM3PerKg: 0.02, landPtPerKg: 0.3, kcalPer100g: 42, proteinPer100g: 0.0, costEurPerKg: 1.4 },
                    { id: 'u3', foodName: 'Extruded savory snacks', foodEx2Category: 'Snacks', gramsPerDay: 65, novaGroup: 4, carbonPerKg: 2.8, waterM3PerKg: 0.12, landPtPerKg: 2.2, kcalPer100g: 510, proteinPer100g: 6.2, costEurPerKg: 9.8 },
                    { id: 'u4', foodName: 'Industrial white sandwich bread', foodEx2Category: 'Refined Grains', gramsPerDay: 120, novaGroup: 4, carbonPerKg: 1.05, waterM3PerKg: 0.12, landPtPerKg: 1.4, kcalPer100g: 265, proteinPer100g: 8.1, costEurPerKg: 2.2 },
                    { id: 'u5', foodName: 'Sweetened breakfast cereal', foodEx2Category: 'Refined Grains', gramsPerDay: 60, novaGroup: 4, carbonPerKg: 1.85, waterM3PerKg: 0.14, landPtPerKg: 1.8, kcalPer100g: 385, proteinPer100g: 6.5, costEurPerKg: 5.5 },
                    { id: 'u6', foodName: 'Frozen ultra-processed pizza', foodEx2Category: 'Prepared Meals', gramsPerDay: 150, novaGroup: 4, carbonPerKg: 4.9, waterM3PerKg: 0.26, landPtPerKg: 4.1, kcalPer100g: 260, proteinPer100g: 10.5, costEurPerKg: 6.8 },
                  ],
                };
                if (presets[key]) {
                  setBasket(presets[key]);
                  setUploadStatus(`Loaded "${e.target.options[e.target.selectedIndex].text}" (${presets[key].length} items)`);
                }
                e.target.value = '';
              }}
              className="almanac-input text-xs py-1 px-2"
              title="Load a pre-built dietary cohort without downloading/uploading CSV"
            >
              <option value="">⚡ Load Cohort Preset…</option>
              <option value="med">Mediterranean Cohort (7 items)</option>
              <option value="plant">Plant-Forward Flexitarian (6 items)</option>
              <option value="upf">High-UPF Western Basket (6 items)</option>
            </select>

            <label className="almanac-btn almanac-btn--primary flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Upload survey CSV
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            </label>

            <button onClick={downloadSampleTemplateCsv} className="almanac-btn flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download template CSV
            </button>

            <button
              onClick={() => {
                setBasket(DEFAULT_BASKET);
                setUploadStatus(null);
              }}
              className="almanac-btn flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset ledger
            </button>
          </div>
        </div>

        {uploadStatus && (
          <div className="mt-3 p-2.5 almanac-well text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
            {uploadStatus}
          </div>
        )}

        {/* Ruled Summary Stat Row (Hallmark data-viz.md: stat row, no card boxes) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-[var(--color-rule)] pt-4">
          <div className="px-3 first:pl-0">
            <div className="almanac-label">Basket carbon</div>
            <div className="text-xl font-semibold num text-[var(--color-accent)]">
              {basketSummary.totalCarbonKg} kg
            </div>
            <div className="almanac-label text-xs">
              vs. {baselineProfile.code}: {baselineProfile.dailyCarbonKg} kg/d
            </div>
          </div>
          <div className="px-3">
            <div className="almanac-label">Daily energy</div>
            <div className="text-xl font-semibold num text-[var(--color-ink)]">
              {basketSummary.totalKcal} kcal
            </div>
            <div className="almanac-label text-xs num">{basketSummary.totalProteinG} g protein/d</div>
          </div>
          <div className="px-3">
            <div className="almanac-label">NOVA 4 share</div>
            <div className="text-xl font-semibold num text-[var(--color-ink)]">{basketSummary.upfSharePct}%</div>
            <div className="almanac-label text-xs">
              vs. {baselineProfile.code}: {baselineProfile.eatLancetIndex.ultraProcessedShare}%
            </div>
          </div>
          <div className="px-3">
            <div className="almanac-label">Daily basket cost</div>
            <div className="text-xl font-semibold num text-[var(--color-ink)]">€{basketSummary.totalCostEur}</div>
            <div className="almanac-label text-xs">
              vs. {baselineProfile.code}: €{baselineProfile.dailyBasketCostEur}/d
            </div>
          </div>
          <div className="px-3">
            <div className="almanac-label">Deprived water</div>
            <div className="text-xl font-semibold num text-[var(--color-ink)]">{basketSummary.totalWaterL} L</div>
            <div className="almanac-label text-xs">Agribalyse PEF index</div>
          </div>
          <div className="px-3">
            <div className="almanac-label">Edible mass</div>
            <div className="text-xl font-semibold num text-[var(--color-ink)]">{basketSummary.totalGrams} g/d</div>
            <div className="almanac-label text-xs">{basket.length} ledger entries</div>
          </div>
        </div>
      </div>

      {/* Main Split: Left Basket Table + Right Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 almanac-sheet p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 rule-firm">
            <h3 className="text-base font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              Dietary basket ledger (adjust daily gram intake)
            </h3>

            <div className="flex flex-wrap items-center gap-2 relative">
              <div className="relative">
                <input
                  type="text"
                  value={agbSearch}
                  onChange={(e) => setAgbSearch(e.target.value)}
                  placeholder={`Search ${agribalyseCatalog.length.toLocaleString()} Agribalyse items...`}
                  className="almanac-input text-xs py-1 px-2.5 w-60"
                />
                {agbSearch.trim().length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-80 max-h-64 overflow-y-auto bg-[var(--color-paper)] border border-[var(--color-ink)] shadow-lg z-50 divide-y divide-[var(--color-parchment-deep)]">
                    {(() => {
                      const q = agbSearch.toLowerCase();
                      const matches = agribalyseCatalog.filter((a) =>
                        (a.LCI_Name || '').toLowerCase().includes(q)
                      );
                      if (matches.length === 0) {
                        return (
                          <div className="p-2.5 text-xs text-[var(--color-muted)]">
                            No Agribalyse items match "{agbSearch}".
                          </div>
                        );
                      }
                      return matches.slice(0, 30).map((a) => (
                        <button
                          key={a.Code_AGB}
                          type="button"
                          onClick={() => {
                            appendAgribalyseItem(a);
                            setAgbSearch('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--color-parchment)] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="truncate font-medium text-[var(--color-ink)]">{a.LCI_Name}</span>
                          <span className="font-mono-num text-[11px] text-[var(--color-accent)] shrink-0">
                            {Number(a.Changement_climatique_kg_CO2eq ?? a.Changement_climatique ?? 0).toFixed(1)} kg CO₂
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <select
                value={selectedAgbCode}
                onChange={(e) => setSelectedAgbCode(e.target.value)}
                className="almanac-select max-w-[200px]"
              >
                <option value="">Or browse top 150...</option>
                {agribalyseCatalog.slice(0, 150).map((a) => (
                  <option key={a.Code_AGB} value={a.Code_AGB}>
                    {a.LCI_Name} ({Number(a.Changement_climatique_kg_CO2eq ?? a.Changement_climatique ?? 0).toFixed(1)}{' '}
                    kg CO₂)
                  </option>
                ))}
              </select>
              <button
                onClick={addAgribalyseToBasket}
                disabled={!selectedAgbCode}
                className="almanac-btn flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Append
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>Food or survey item</th>
                  <th>Category</th>
                  <th className="text-right">NOVA</th>
                  <th>Daily intake (g/d)</th>
                  <th className="text-right">Carbon (g CO₂)</th>
                  <th className="text-right">Cost (€/d)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {basket.map((item) => {
                  const itemCarbonG = Math.round((item.gramsPerDay / 1000) * item.carbonPerKg * 1000);
                  const itemCost = ((item.gramsPerDay / 1000) * item.costEurPerKg).toFixed(2);
                  return (
                    <tr key={item.id}>
                      <td className="font-semibold text-[var(--color-ink)]">{item.foodName}</td>
                      <td>{item.foodEx2Category}</td>
                      <td className="num text-right">{item.novaGroup}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={500}
                            step={5}
                            value={item.gramsPerDay}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setBasket((prev) =>
                                prev.map((b) => (b.id === item.id ? { ...b, gramsPerDay: val } : b))
                              );
                            }}
                            className="w-20 cursor-pointer"
                          />
                          <span className="num w-12 text-right">{item.gramsPerDay} g</span>
                        </div>
                      </td>
                      <td className="num text-right text-[var(--color-accent)]">{itemCarbonG}</td>
                      <td className="num text-right">€{itemCost}</td>
                      <td className="text-right">
                        <button
                          onClick={() => setBasket((prev) => prev.filter((b) => b.id !== item.id))}
                          className="text-[var(--color-muted)] hover:text-[var(--color-accent)] cursor-pointer"
                          title="Remove entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 almanac-sheet p-5 flex flex-col">
          <div className="pb-2.5 mb-2 rule-firm">
            <h3 className="text-base font-semibold">
              Planetary health benchmark radar (custom basket vs. [{baselineProfile.code}] {baselineProfile.name})
            </h3>
            <p className="almanac-label">
              Evaluates custom dietary intake against EAT-Lancet upper and lower reference boundaries.
            </p>
          </div>
          <div className="flex-1 min-h-[340px]">
            <ReactECharts option={sandboxRadarOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
