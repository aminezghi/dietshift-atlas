import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Award, ExternalLink, Filter, Globe2, Layers, MapPin, ZoomIn } from 'lucide-react';
import { assetUrl } from '../utils/assetPath';
import { COUNTRY_PROFILES, type CountryDietaryProfile } from '../types/research';

export type MapMetric =
  | 'dailyCarbonKg'
  | 'ultraProcessedShare'
  | 'plantProteinSharePct'
  | 'dailyBasketCostEur'
  | 'sayDoGapScore'
  | 'redMeat'
  | 'giTotalCount'
  | 'giPlantSharePct';

export interface GICartographyItem {
  gi_id: string;
  file_number?: string;
  product_name: string;
  country_code: string;
  gi_scheme: string;
  product_sector?: string;
  registration_status: string;
  protection_date: string;
  eu_class: string;
  dietary_role: string;
  nova_group: number;
  nutriscore_typical: string;
  co2_kg_per_kg: number;
  water_L_per_kg: number;
  land_m2_per_kg: number;
  price_premium_pct: number;
  foodex2_code: string;
  lat: number;
  lon: number;
  data_source: string;
  source_url: string;
  giview_url?: string;
  qualigeo_url?: string;
  disciplinare_note: string;
}

interface InteractiveChoroplethMapProps {
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  compact?: boolean;
}

export function InteractiveChoroplethMap({
  selectedCountry,
  onSelectCountry,
  compact = false,
}: InteractiveChoroplethMapProps) {
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [metric, setMetric] = useState<MapMetric>('dailyCarbonKg');
  const [focusView, setFocusView] = useState<'europe' | 'world'>('europe');
  const [giRecords, setGiRecords] = useState<GICartographyItem[]>([]);
  const [showGiPins, setShowGiPins] = useState<boolean>(!compact);
  const [giSectorFilter, setGiSectorFilter] = useState<string>('FOOD');
  const [giRoleFilter, setGiRoleFilter] = useState<string>('ALL');
  const [selectedGiItem, setSelectedGiItem] = useState<GICartographyItem | null>(null);
  const [countryGiSearch, setCountryGiSearch] = useState<string>('');
  const [countryGiPage, setCountryGiPage] = useState<number>(1);

  useEffect(() => {
    if (echarts.getMap('world_dietshift')) {
      setGeoLoaded(true);
    } else {
      fetch(assetUrl('data/world.geojson'))
        .then((r) => r.json())
        .then((geoJson) => {
          echarts.registerMap('world_dietshift', geoJson);
          setGeoLoaded(true);
        })
        .catch((err) => console.error('GeoJSON load error:', err));
    }
  }, []);

  useEffect(() => {
    fetch(assetUrl('data/gi_terroir_bundle.json'))
      .then((r) => r.json())
      .then((d) => {
        if (d?.gi_terroir_records) {
          setGiRecords(d.gi_terroir_records);
        }
      })
      .catch(() => {
        // Ignore if not loaded yet
      });
  }, []);

  /* Aggregate GI counts and Plant-Origin GI share per country code from all 6,845 records */
  const giCountryStats = useMemo(() => {
    const stats: Record<
      string,
      {
        total: number;
        food: number;
        wine: number;
        spirit: number;
        plantFood: number;
        plantSharePct: number;
      }
    > = {};

    for (const r of giRecords) {
      const cc = r.country_code;
      if (!stats[cc]) {
        stats[cc] = { total: 0, food: 0, wine: 0, spirit: 0, plantFood: 0, plantSharePct: 0 };
      }
      stats[cc].total += 1;
      const sec = r.product_sector || 'FOOD';
      if (sec === 'FOOD') {
        stats[cc].food += 1;
        if (
          r.eu_class.includes('Pulses') ||
          r.eu_class.includes('Fruits') ||
          r.eu_class.includes('Grains') ||
          r.eu_class.includes('Olive Oils')
        ) {
          stats[cc].plantFood += 1;
        }
      } else if (sec === 'WINE') {
        stats[cc].wine += 1;
      } else if (sec === 'SPIRIT') {
        stats[cc].spirit += 1;
      }
    }

    for (const cc of Object.keys(stats)) {
      const st = stats[cc];
      st.plantSharePct = st.food > 0 ? +((st.plantFood / st.food) * 100).toFixed(1) : 0;
    }
    return stats;
  }, [giRecords]);

  const METRIC_META: Record<
    MapMetric,
    {
      label: string;
      unit: string;
      min: number;
      max: number;
      colors: string[];
      getValue: (p: CountryDietaryProfile) => number;
    }
  > = useMemo(
    () => ({
      dailyCarbonKg: {
        label: 'Dietary carbon footprint',
        unit: 'kg CO₂eq / person / day',
        min: 3.2,
        max: 6.8,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => p.dailyCarbonKg,
      },
      ultraProcessedShare: {
        label: 'NOVA 4 ultra-processed energy share',
        unit: '% of daily kcal',
        min: 15,
        max: 60,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => p.eatLancetIndex.ultraProcessedShare,
      },
      plantProteinSharePct: {
        label: 'Plant-protein transition share',
        unit: '% of total protein intake',
        min: 30,
        max: 55,
        colors: ['#d8dde6', '#8fa8b2', '#3f6f7d', '#163d4a'],
        getValue: (p) => p.plantProteinSharePct,
      },
      dailyBasketCostEur: {
        label: 'Daily healthy basket cost (PPP)',
        unit: '€ / person / day',
        min: 4.5,
        max: 11.5,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => p.dailyBasketCostEur,
      },
      sayDoGapScore: {
        label: 'Consumer attitude–behavior gap',
        unit: 'Gap index (0–100)',
        min: 40,
        max: 85,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => p.sayDoGapScore,
      },
      redMeat: {
        label: 'Ruminant red meat vs. planetary bound',
        unit: '% of upper reference bound',
        min: 140,
        max: 400,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => p.eatLancetIndex.redMeat,
      },
      giTotalCount: {
        label: 'Protected GI terroir density (GIview + Qualigeo)',
        unit: 'registered PDO / PGI / TSG products',
        min: 5,
        max: 950,
        colors: ['#d8dde6', '#8fa8b2', '#3f6f7d', '#163d4a'],
        getValue: (p) => giCountryStats[p.code]?.total || 0,
      },
      giPlantSharePct: {
        label: 'Plant-origin & olive oil GI share (Class 1.5 & 1.6)',
        unit: '% of national agro-food GIs',
        min: 15,
        max: 80,
        colors: ['#d8dde6', '#8fa8b2', '#3f6f7d', '#163d4a'],
        getValue: (p) => giCountryStats[p.code]?.plantSharePct || 0,
      },
    }),
    [giCountryStats]
  );

  const nameToCodeMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(COUNTRY_PROFILES).forEach((p) => {
      map[p.geoJsonName] = p.code;
      map[p.name] = p.code;
    });
    return map;
  }, []);

  /* Filtered GI pins for the spatial overlay */
  const filteredGiPins = useMemo(() => {
    if (!showGiPins || giRecords.length === 0) return [];
    return giRecords.filter((r) => {
      const sec = r.product_sector || 'FOOD';
      const matchSector = giSectorFilter === 'ALL' || sec === giSectorFilter;
      if (!matchSector) return false;
      if (giRoleFilter === 'PLANT_PROTEIN') {
        return r.eu_class.includes('Pulses') || r.eu_class.includes('Fruits') || r.eu_class.includes('Grains');
      }
      if (giRoleFilter === 'OLIVE_OIL') {
        return r.eu_class.includes('Olive Oils');
      }
      if (giRoleFilter === 'CHEESE_MEAT') {
        return r.eu_class.includes('Cheeses') || r.eu_class.includes('Meats');
      }
      return true;
    });
  }, [showGiPins, giRecords, giSectorFilter, giRoleFilter]);

  /* Country-specific GI records for the selected country on the map */
  const selectedCountryGiList = useMemo(() => {
    const q = countryGiSearch.trim().toLowerCase();
    return giRecords.filter((r) => {
      const matchCountry = selectedCountry === 'EU27_2020' ? true : r.country_code === selectedCountry;
      if (!matchCountry) return false;
      const sec = r.product_sector || 'FOOD';
      const matchSector = giSectorFilter === 'ALL' || sec === giSectorFilter;
      if (!matchSector) return false;
      if (!q) return true;
      return (
        r.product_name.toLowerCase().includes(q) ||
        r.eu_class.toLowerCase().includes(q) ||
        r.gi_scheme.toLowerCase().includes(q) ||
        r.disciplinare_note.toLowerCase().includes(q)
      );
    });
  }, [giRecords, selectedCountry, giSectorFilter, countryGiSearch]);

  /* Class breakdown chart for the selected country in Full Cartography */
  const countryGiClassChartOption = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of selectedCountryGiList) {
      counts[r.eu_class] = (counts[r.eu_class] || 0) + 1;
    }
    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);

    const shortClassLabel = (raw: string) => {
      if (raw.includes('Fruits, Vegetables')) return '1.6 Fruits & Vegetables';
      if (raw.includes('Pulses')) return '1.6 Pulses & Legumes';
      if (raw.includes('Cheeses')) return '1.3 Cheeses & Dairy';
      if (raw.includes('Meats')) return '1.1–1.2 Meats & Charcuterie';
      if (raw.includes('Olive Oils')) return '1.5 Extra-Virgin Olive Oils';
      if (raw.includes('Grains')) return '1.6–2.3 Grains & Bakery';
      if (raw.includes('Wines')) return 'Wine — Protected Appellations';
      if (raw.includes('Spirits')) return 'Spirits & Geographical Drinks';
      return raw.replace('Class ', '').slice(0, 26);
    };

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      grid: { top: 14, right: 26, bottom: 32, left: 168 },
      xAxis: {
        type: 'value',
        min: 0,
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: entries.map(([k]) => shortClassLabel(k)),
        axisLabel: {
          color: '#111827',
          fontSize: 11,
          fontFamily: 'Newsreader, Georgia, serif',
        },
      },
      series: [
        {
          name: 'Protected GIs',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: {
            color: (params: { name?: string }) =>
              params.name?.includes('1.5') || params.name?.includes('1.6') ? '#163d4a' : '#8a1253',
            borderRadius: [0, 2, 2, 0],
          },
          data: entries.map(([, v]) => v),
        },
      ],
    };
  }, [selectedCountryGiList]);

  const mapOption = useMemo(() => {
    if (!geoLoaded) return {};
    const m = METRIC_META[metric];

    const data = Object.values(COUNTRY_PROFILES)
      .filter((p) => p.code !== 'EU27_2020')
      .map((p) => ({
        name: p.geoJsonName,
        value: m.getValue(p),
        countryCode: p.code,
        profile: p,
        giStat: giCountryStats[p.code],
        itemStyle:
          p.code === selectedCountry
            ? {
                borderColor: '#111827',
                borderWidth: 2.2,
              }
            : undefined,
      }));

    const scatterPoints = filteredGiPins.slice(0, compact ? 450 : 2500).map((gi) => {
      const isPlant =
        gi.eu_class.includes('Pulses') ||
        gi.eu_class.includes('Fruits') ||
        gi.eu_class.includes('Grains') ||
        gi.eu_class.includes('Olive Oils');
      const isWineSpirit = gi.product_sector === 'WINE' || gi.product_sector === 'SPIRIT';
      return {
        name: gi.product_name,
        value: [gi.lon, gi.lat, gi.co2_kg_per_kg],
        giItem: gi,
        itemStyle: {
          color: isPlant ? '#163d4a' : isWineSpirit ? '#6b4c1b' : '#8a1253',
          borderColor: '#eaedf2',
          borderWidth: 0.8,
          opacity: 0.88,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'Newsreader, Georgia, serif' },
        formatter: (params: {
          seriesType?: string;
          data?: {
            profile?: CountryDietaryProfile;
            value?: number | number[];
            giStat?: { total: number; food: number; wine: number; spirit: number; plantSharePct: number };
            giItem?: GICartographyItem;
          };
          name: string;
        }) => {
          if (params.seriesType === 'scatter' && params.data?.giItem) {
            const gi = params.data.giItem;
            return `
              <div style="min-width:240px;max-width:310px;">
                <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;font-size:13px;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:5px;">
                  [${gi.country_code}] ${gi.product_name} (${gi.gi_scheme})
                </div>
                <div style="font-size:11px;color:#8a1253;font-weight:600;margin-bottom:4px;">
                  ${gi.eu_class}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#2d3643;font-family:'IBM Plex Mono',monospace;margin-bottom:5px;">
                  <span>Processing: <b>NOVA ${gi.nova_group}</b></span>
                  <span>Carbon: <b>${gi.co2_kg_per_kg} kg CO₂</b></span>
                  <span>Water: <b>${gi.water_L_per_kg} L/kg</b></span>
                  <span>Premium: <b>+${gi.price_premium_pct}%</b></span>
                </div>
                <div style="font-size:10px;color:#3d4654;font-family:'IBM Plex Mono',monospace;">
                  Source: ${gi.data_source} (Click pin to inspect dossier)
                </div>
              </div>
            `;
          }

          const p = params.data?.profile;
          const gs = params.data?.giStat;
          if (!p) {
            return `<div style="font-size:12px;color:#3d4654;"><b>${params.name}</b><br/>Click to inspect jurisdiction</div>`;
          }
          return `
            <div style="min-width:230px;">
              <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;font-size:13px;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:5px;">
                [${p.code}] ${p.name}
              </div>
              <div style="font-size:12px;color:#2d3643;margin-bottom:6px;">
                ${m.label}: <b style="font-family:'IBM Plex Mono',monospace;color:#8a1253;">${params.data?.value} ${m.unit}</b>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#3d4654;font-family:'IBM Plex Mono',monospace;">
                <span>CO₂: <b>${p.dailyCarbonKg} kg</b></span>
                <span>NOVA 4: <b>${p.eatLancetIndex.ultraProcessedShare}%</b></span>
                <span>Plant: <b>${p.plantProteinSharePct}%</b></span>
                <span>Cost: <b>€${p.dailyBasketCostEur}/d</b></span>
                <span>Total GIs: <b>${gs ? gs.total : 0}</b></span>
                <span>Plant GI: <b>${gs ? gs.plantSharePct : 0}%</b></span>
              </div>
            </div>
          `;
        },
      },
      visualMap: {
        min: m.min,
        max: m.max,
        seriesIndex: 0,
        text: [`${m.max}`, `${m.min}`],
        realtime: true,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        itemWidth: 10,
        itemHeight: 110,
        backgroundColor: 'rgba(234, 237, 242, 0.9)',
        borderColor: '#aeb6c4',
        borderWidth: 1,
        padding: [4, 10],
        textStyle: { color: '#111827', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' },
        inRange: {
          color: m.colors,
        },
      },
      geo: {
        map: 'world_dietshift',
        roam: true,
        center: focusView === 'europe' ? [12, 48] : [10, 25],
        zoom: focusView === 'europe' ? 4.3 : 1.25,
        label: { show: false },
        itemStyle: {
          areaColor: '#cfd5df',
          borderColor: '#8c96a6',
          borderWidth: 0.7,
        },
        emphasis: {
          label: { show: true, color: '#111827', fontSize: 11, fontFamily: 'Hanken Grotesk, sans-serif' },
          itemStyle: { areaColor: '#8a1253', borderColor: '#111827', borderWidth: 1.5 },
        },
      },
      series: [
        {
          name: m.label,
          type: 'map',
          geoIndex: 0,
          data,
        },
        ...(showGiPins
          ? [
              {
                name: 'Protected GI Terroir Products (GIview + Qualigeo)',
                type: 'scatter',
                coordinateSystem: 'geo',
                symbolSize: compact ? 5 : 7,
                large: true,
                largeThreshold: 600,
                data: scatterPoints,
              },
            ]
          : []),
      ],
    };
  }, [geoLoaded, metric, focusView, selectedCountry, METRIC_META, giCountryStats, showGiPins, filteredGiPins, compact]);

  const onEvents = useMemo(
    () => ({
      click: (params: {
        seriesType?: string;
        name?: string;
        data?: { countryCode?: string; giItem?: GICartographyItem };
      }) => {
        if (params.seriesType === 'scatter' && params.data?.giItem) {
          setSelectedGiItem(params.data.giItem);
          const cc = params.data.giItem.country_code;
          if (COUNTRY_PROFILES[cc]) {
            onSelectCountry(cc);
          }
          return;
        }
        const code = params.data?.countryCode || (params.name ? nameToCodeMap[params.name] : undefined);
        if (code && COUNTRY_PROFILES[code]) {
          onSelectCountry(code);
        }
      },
    }),
    [nameToCodeMap, onSelectCountry]
  );

  return (
    <div className="almanac-sheet p-4 flex flex-col space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 rule-firm">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Globe2 className="w-4 h-4" />
            Plate I. European & global dietary choropleth + GI terroir spatial layer ({giRecords.length.toLocaleString()}{' '}
            GIs)
          </h2>
          <p className="almanac-label">
            Click any jurisdiction or toggle the 6,845 EUIPO GIview & Qualigeo terroir pins to inspect local PDO/PGI
            heritage foods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MapMetric)}
            className="almanac-select"
          >
            {Object.entries(METRIC_META).map(([k, v]) => (
              <option key={k} value={k}>
                Choropleth: {v.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowGiPins(!showGiPins)}
            className={`almanac-btn flex items-center gap-1 ${showGiPins ? 'almanac-btn--primary' : ''}`}
          >
            <Layers className="w-3.5 h-3.5" />
            {showGiPins ? `GI Terroir Pins ON (${filteredGiPins.length.toLocaleString()})` : 'Overlay 6,845 GI Pins'}
          </button>

          <div className="flex items-center border border-[var(--color-ink)]">
            <button
              onClick={() => setFocusView('europe')}
              className={`px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer ${
                focusView === 'europe' ? 'bg-[var(--color-ink)] text-[var(--color-sheet)]' : 'text-[var(--color-ink)]'
              }`}
            >
              <MapPin className="w-3 h-3" /> Europe
            </button>
            <button
              onClick={() => setFocusView('world')}
              className={`px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer ${
                focusView === 'world' ? 'bg-[var(--color-ink)] text-[var(--color-sheet)]' : 'text-[var(--color-ink)]'
              }`}
            >
              <ZoomIn className="w-3 h-3" /> World
            </button>
          </div>
        </div>
      </div>

      {/* GI Terroir Spatial Filter Bar when GI Pins are enabled */}
      {showGiPins && !compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 almanac-well text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold flex items-center gap-1 text-[var(--color-ink)]">
              <Filter className="w-3.5 h-3.5" /> GI Terroir Spatial Layer:
            </span>
            <select
              value={giSectorFilter}
              onChange={(e) => setGiSectorFilter(e.target.value)}
              className="almanac-select text-xs"
            >
              <option value="ALL">All GI Sectors (6,845)</option>
              <option value="FOOD">Agro-Foodstuffs (FOOD)</option>
              <option value="WINE">Wines & Viticulture (WINE)</option>
              <option value="SPIRIT">Spirit Drinks (SPIRIT)</option>
              <option value="CRAFT_AND_INDUSTRIAL">Craft & Industrial</option>
            </select>

            <select
              value={giRoleFilter}
              onChange={(e) => setGiRoleFilter(e.target.value)}
              className="almanac-select text-xs"
            >
              <option value="ALL">All Dietary Roles</option>
              <option value="PLANT_PROTEIN">Plant-Origin Pulses, Grains & Produce (Class 1.6)</option>
              <option value="OLIVE_OIL">Extra-Virgin Olive Oils (Class 1.5)</option>
              <option value="CHEESE_MEAT">Traditional Cheeses & Meats (Class 1.1–1.3)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 font-mono-num text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#163d4a]" /> Plant & Olive Oil GI (NOVA 1–2)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#8a1253]" /> Cheese & Meat GI (NOVA 1–3)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#6b4c1b]" /> Wine & Spirit GI
            </span>
          </div>
        </div>
      )}

      <div className={`${compact ? 'h-80' : 'h-[520px]'} w-full relative almanac-well`}>
        {geoLoaded ? (
          <ReactECharts
            option={mapOption}
            onEvents={onEvents}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        ) : (
          <div className="h-full flex items-center justify-center almanac-label">
            Loading vector cartography...
          </div>
        )}
      </div>

      {/* Selected GI Pin Inspector Banner */}
      {selectedGiItem && !compact && (
        <div className="p-3 almanac-well flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--color-accent)]" />
              [{selectedGiItem.country_code}] {selectedGiItem.product_name} ({selectedGiItem.gi_scheme} —{' '}
              {selectedGiItem.file_number || selectedGiItem.gi_id})
            </div>
            <div className="text-[var(--color-muted)] mt-0.5">
              {selectedGiItem.eu_class} | <b>NOVA {selectedGiItem.nova_group}</b> | Carbon:{' '}
              <b className="font-mono-num">{selectedGiItem.co2_kg_per_kg} kg CO₂/kg</b> | Water:{' '}
              <b className="font-mono-num">{selectedGiItem.water_L_per_kg} L/kg</b> | {selectedGiItem.disciplinare_note}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={selectedGiItem.source_url}
              target="_blank"
              rel="noreferrer"
              className="almanac-btn almanac-btn--primary flex items-center gap-1"
            >
              Open Qualigeo / GIview Sheet <ExternalLink className="w-3 h-3" />
            </a>
            {selectedGiItem.giview_url && selectedGiItem.source_url !== selectedGiItem.giview_url && (
              <a
                href={selectedGiItem.giview_url}
                target="_blank"
                rel="noreferrer"
                className="almanac-btn flex items-center gap-1"
              >
                EUIPO GIview Dossier <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Full Cartography Sub-National GI Terroir Ledger for Selected Jurisdiction */}
      {!compact && giRecords.length > 0 && (
        <div className="pt-3 rule-firm space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-5 almanac-well p-3.5 flex flex-col">
              <div className="pb-2 mb-2 rule-firm">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[var(--color-accent)]" />
                  Plate I-B. [{selectedCountry}] GI Terroir Class Composition ({selectedCountryGiList.length.toLocaleString()}{' '}
                  items)
                </h3>
                <p className="almanac-label text-xs">
                  Teal bars denote Plant-Origin & Olive Oil GIs (Class 1.5 & 1.6); Berry bars denote Animal-Origin &
                  Viticultural GIs.
                </p>
              </div>
              <div className="h-52 w-full">
                <ReactECharts
                  option={countryGiClassChartOption}
                  style={{ height: '100%', width: '100%' }}
                  notMerge={true}
                />
              </div>
            </div>

            <div className="xl:col-span-7 almanac-well p-3.5 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 rule-firm">
                <div>
                  <h3 className="text-sm font-semibold">
                    [{selectedCountry}] Protected Geographical Indications Spatial Dossier (
                    {selectedCountryGiList.length.toLocaleString()} matching records)
                  </h3>
                  <p className="almanac-label text-xs">
                    Click any row to center & inspect its Qualigeo / EUIPO GIview specification on the map.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={countryGiSearch}
                    onChange={(e) => {
                      setCountryGiSearch(e.target.value);
                      setCountryGiPage(1);
                    }}
                    placeholder={`Filter [${selectedCountry}] GIs...`}
                    className="almanac-input text-xs w-44"
                  />
                  <div className="flex items-center gap-1 font-mono-num text-xs">
                    <button
                      onClick={() => setCountryGiPage((p) => Math.max(1, p - 1))}
                      disabled={countryGiPage <= 1}
                      className="almanac-btn px-1.5 py-0.5 disabled:opacity-40"
                    >
                      ←
                    </button>
                    <span>
                      {countryGiPage}/{Math.max(1, Math.ceil(selectedCountryGiList.length / 40))}
                    </span>
                    <button
                      onClick={() =>
                        setCountryGiPage((p) =>
                          Math.min(Math.max(1, Math.ceil(selectedCountryGiList.length / 40)), p + 1)
                        )
                      }
                      disabled={countryGiPage >= Math.ceil(selectedCountryGiList.length / 40)}
                      className="almanac-btn px-1.5 py-0.5 disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-56">
                <table className="almanac-table">
                  <thead>
                    <tr>
                      <th>Protected GI name</th>
                      <th>Sector</th>
                      <th>Scheme</th>
                      <th>EU GI class</th>
                      <th className="text-right">NOVA</th>
                      <th className="text-right">CO₂ (kg)</th>
                      <th>Coords (Lat, Lon)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCountryGiList.slice((countryGiPage - 1) * 40, countryGiPage * 40).map((gi) => (
                      <tr
                        key={gi.gi_id}
                        onClick={() => setSelectedGiItem(gi)}
                        className={`cursor-pointer ${
                          selectedGiItem?.gi_id === gi.gi_id
                            ? 'bg-[var(--color-sheet)] font-semibold'
                            : 'hover:bg-[var(--color-sheet)]'
                        }`}
                      >
                        <td>
                          <a
                            href={gi.source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
                          >
                            {gi.product_name}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="text-xs font-mono-num">{gi.product_sector || 'FOOD'}</td>
                        <td>
                          <span className="px-1 py-0.5 almanac-sheet font-mono-num text-[10px] font-semibold text-[var(--color-accent)]">
                            {gi.gi_scheme}
                          </span>
                        </td>
                        <td className="text-xs">{gi.eu_class}</td>
                        <td className="num text-right">NOVA {gi.nova_group}</td>
                        <td className="num text-right font-semibold">{gi.co2_kg_per_kg}</td>
                        <td className="num text-xs text-[var(--color-muted)]">
                          {gi.lat}°, {gi.lon}°
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
