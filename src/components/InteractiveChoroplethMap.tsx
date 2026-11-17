import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import * as echarts from 'echarts';
import { Award, ExternalLink, Filter, Globe2, Layers, MapPin, ZoomIn } from 'lucide-react';
import { fetchCachedJson, fetchGiTerroirBundle } from '../services/dataProvider';
import { COUNTRY_PROFILES, type CountryDietaryProfile } from '../types/research';
import { classifyResourceError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { useDarkMode } from '../utils/chartTheme';
import { DataNatureBadge } from './DataNatureBadge';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';

export type GiVisualMode = 'constellation' | 'hubs' | 'carbon';

const GI_VISUAL_MODES: ReadonlyArray<readonly [GiVisualMode, string]> = [
  ['hubs', '◎ National Terroir Hubs'],
  ['constellation', '✦ Terroir Constellation'],
  ['carbon', '⚖ Carbon-Weighted Pins'],
];

interface HubStatSummary {
  countryCode: string;
  count: number;
  plantCount: number;
  plantSharePct: number;
  sampleProduct: string;
}

const GOLDEN_ANGLE_RAD = 2.399963229728653;

/**
 * Geographic centroids [lon, lat, maxSpreadDeg] for jurisdictions whose raw GI records
 * cluster on artificial rings/petals or fall back to an administrative proxy point.
 * Used purely for cartographic dispersion (never mutates underlying dataset coordinates).
 */
const COUNTRY_CENTROIDS: Record<string, [number, number, number]> = {
  CN: [106.5, 33.5, 4.2],
  BR: [-48.5, -15.5, 3.2],
  TH: [101.0, 15.5, 1.4],
  IN: [78.5, 22.0, 2.2],
  JP: [138.0, 36.5, 1.5],
  KR: [127.8, 36.2, 1.0],
  VN: [106.5, 16.0, 1.4],
  KH: [105.0, 12.6, 0.8],
  ID: [114.0, -2.0, 2.5],
  LK: [80.7, 7.9, 0.6],
  PK: [69.3, 30.4, 1.5],
  MN: [103.8, 46.8, 2.0],
  UZ: [64.6, 41.4, 1.5],
  AU: [134.0, -25.0, 4.5],
  NZ: [172.5, -41.5, 1.5],
  AR: [-64.0, -34.0, 3.0],
  UY: [-56.0, -32.8, 1.0],
  CO: [-74.0, 4.6, 1.4],
  EC: [-78.5, -1.8, 0.8],
  BO: [-64.7, -16.3, 1.5],
  GY: [-58.9, 4.9, 0.8],
  VE: [-66.6, 8.0, 1.5],
  MX: [-102.0, 23.0, 2.0],
  GT: [-90.2, 15.5, 0.6],
  DO: [-70.2, 18.9, 0.5],
  CU: [-79.5, 21.8, 1.0],
  CA: [-96.0, 56.0, 4.5],
  ZA: [24.0, -29.0, 1.5],
  TN: [9.5, 34.0, 1.0],
  CM: [12.3, 5.9, 1.2],
  NE: [8.1, 17.6, 1.5],
  ST: [6.6, 0.2, 0.1],
  TR: [35.0, 39.0, 2.2],
  GE: [43.5, 42.1, 0.9],
  AM: [45.0, 40.1, 0.4],
  RS: [20.9, 44.0, 0.9],
  AL: [20.0, 41.1, 0.6],
  BA: [17.7, 44.0, 0.7],
  ME: [19.3, 42.7, 0.4],
  MD: [28.5, 47.0, 0.5],
  UA: [31.2, 49.0, 2.0],
  RU: [40.0, 56.0, 2.5],
  NO: [10.0, 61.5, 1.8],
  IS: [-18.5, 65.0, 1.0],
  LI: [9.55, 47.16, 0.25],
  MT: [14.4, 35.9, 0.2],
  AD: [1.55, 42.54, 0.1],
};

function getOrganicGiCoords(gi: GICartographyItem, countryIdx: number, countryTotal: number): [number, number] {
  const centroid = COUNTRY_CENTROIDS[gi.country_code];
  if (!centroid) return [gi.lon, gi.lat];
  const [lon0, lat0, maxSpread] = centroid;
  if (countryTotal <= 1) return [lon0, lat0];
  const angle = countryIdx * GOLDEN_ANGLE_RAD;
  const radius = maxSpread * Math.sqrt((countryIdx + 0.5) / countryTotal);
  return [
    +(lon0 + radius * Math.cos(angle)).toFixed(4),
    +(lat0 + radius * Math.sin(angle) * 0.82).toFixed(4),
  ];
}

function classifyGiPinCategory(gi: GICartographyItem): 'plant' | 'cheese_meat' | 'wine_spirit' {
  if (
    gi.eu_class.includes('Pulses') ||
    gi.eu_class.includes('Fruits') ||
    gi.eu_class.includes('Grains') ||
    gi.eu_class.includes('Olive Oils')
  ) {
    return 'plant';
  }
  if (gi.product_sector === 'WINE' || gi.product_sector === 'SPIRIT') {
    return 'wine_spirit';
  }
  return 'cheese_meat';
}

function sampleProportionally<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  const sampled: T[] = [];
  for (let i = 0; i < limit; i++) {
    sampled.push(items[Math.floor((i * items.length) / limit)]);
  }
  return sampled;
}

export type MapMetric =
  | 'dailyCarbonKg'
  | 'ultraProcessedShare'
  | 'plantProteinSharePct'
  | 'dailyBasketCostEur'
  | 'sayDoGapScore'
  | 'redMeat'
  | 'giTotalCount'
  | 'giPlantSharePct'
  | 'cohdCostPpp'
  | 'cohdUnaffordablePct';

export interface CohdCountryRecord {
  iso3: string;
  country_name: string;
  geojson_name: string;
  year: number;
  cost_healthy_diet_ppp_usd: number;
  unaffordable_pct: number | null;
  unaffordable_millions: number | null;
  cost_to_food_exp_ratio: number | null;
  share_year?: number | null;
}

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
  const isDark = useDarkMode();
  const [geoLoaded, setGeoLoaded] = useState(() => Boolean(echarts.getMap('world_dietshift')));
  const [metric, setMetric] = useState<MapMetric>('dailyCarbonKg');
  const [focusView, setFocusView] = useState<'europe' | 'world'>('europe');
  const [giRecords, setGiRecords] = useState<GICartographyItem[]>([]);
  const [cohdRecords, setCohdRecords] = useState<CohdCountryRecord[]>([]);
  const [showGiPins, setShowGiPins] = useState<boolean>(!compact);
  const [giVisualMode, setGiVisualMode] = useState<GiVisualMode>('hubs');
  const [giSectorFilter, setGiSectorFilter] = useState<string>('FOOD');
  const [giRoleFilter, setGiRoleFilter] = useState<string>('ALL');
  const [selectedGiItem, setSelectedGiItem] = useState<GICartographyItem | null>(null);
  const [countryGiSearch, setCountryGiSearch] = useState<string>('');
  const [countryGiPage, setCountryGiPage] = useState<number>(1);
  const [mapDisclosures, setMapDisclosures] = useState<ResourceDisclosure[]>([]);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const forceRetry = retryCount > 0;
    const tasks: Array<Promise<void>> = [];
    const pushDisclosure = (d: ResourceDisclosure) => {
      setMapDisclosures((prev) =>
        prev.some((x) => x.category === d.category && x.resourceLabel === d.resourceLabel)
          ? prev
          : [...prev, d]
      );
    };

    if (!echarts.getMap('world_dietshift')) {
      tasks.push(
        fetchCachedJson<Parameters<typeof echarts.registerMap>[1]>('data/world.geojson', { forceRetry })
          .then((geoJson) => {
            if (!cancelled) {
              echarts.registerMap('world_dietshift', geoJson);
              setGeoLoaded(true);
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              pushDisclosure(
                classifyResourceError(err, {
                  resourcePath: 'data/world.geojson',
                  resourceLabel: 'World Natural Earth Vector Boundaries',
                })
              );
            }
          })
      );
    }

    tasks.push(
      fetchGiTerroirBundle<{ gi_terroir_records?: GICartographyItem[] }>({ forceRetry })
        .then((d) => {
          if (!cancelled && d?.gi_terroir_records) {
            setGiRecords(d.gi_terroir_records);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            pushDisclosure(
              classifyResourceError(err, {
                resourcePath: 'data/gi_terroir_bundle.json',
                availableSummary:
                  'Natural Earth choropleth cartography, national dietary profiles, and 150+ World Bank CoHD economies remain interactive.',
              })
            );
          }
        })
    );

    tasks.push(
      fetchCachedJson<{ cohd_latest_by_country?: CohdCountryRecord[] }>('data/global_benchmarks.json', { forceRetry })
        .then((d) => {
          if (!cancelled && d?.cohd_latest_by_country) {
            setCohdRecords(d.cohd_latest_by_country);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            pushDisclosure(
              classifyResourceError(err, {
                resourcePath: 'data/global_benchmarks.json',
                resourceLabel: 'World Bank CoHD & Poore global benchmarks (global_benchmarks.json)',
              })
            );
          }
        })
    );

    void Promise.all(tasks);
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const foodGiCount = useMemo(
    () => giRecords.filter((r) => (r.product_sector || 'FOOD') === 'FOOD').length,
    [giRecords]
  );

  const cohdByGeoName = useMemo(() => {
    const map: Record<string, CohdCountryRecord> = {};
    for (const c of cohdRecords) {
      map[c.geojson_name] = c;
    }
    return map;
  }, [cohdRecords]);

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
        label: 'Food GI terroir density (GIview + Qualigeo FOOD sector)',
        unit: 'registered agro-food PDO / PGI / TSG',
        min: 5,
        max: 900,
        colors: ['#d8dde6', '#8fa8b2', '#3f6f7d', '#163d4a'],
        getValue: (p) => giCountryStats[p.code]?.food || 0,
      },
      giPlantSharePct: {
        label: 'Plant-origin & olive oil GI share (Class 1.5 & 1.6)',
        unit: '% of national agro-food GIs',
        min: 15,
        max: 80,
        colors: ['#d8dde6', '#8fa8b2', '#3f6f7d', '#163d4a'],
        getValue: (p) => giCountryStats[p.code]?.plantSharePct || 0,
      },
      cohdCostPpp: {
        label: 'Global: Cost of a healthy diet (WB/FAO 2024 PPP)',
        unit: 'ICP PPP $ / person / day',
        min: 2.0,
        max: 6.5,
        colors: ['#d8dde6', '#8fa8b2', '#983b6a', '#6e0d42'],
        getValue: (p) => cohdByGeoName[p.geoJsonName]?.cost_healthy_diet_ppp_usd || 0,
      },
      cohdUnaffordablePct: {
        label: 'Global: Share unable to afford a healthy diet (WB/FAO)',
        unit: '% of population (latest)',
        min: 0,
        max: 75,
        colors: ['#d8dde6', '#b88ca8', '#983b6a', '#6e0d42'],
        getValue: (p) => cohdByGeoName[p.geoJsonName]?.unaffordable_pct || 0,
      },
    }),
    [giCountryStats, cohdByGeoName]
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
    const isGlobalMetric = metric === 'cohdCostPpp' || metric === 'cohdUnaffordablePct';

    const euByGeoName: Record<string, CountryDietaryProfile> = {};
    Object.values(COUNTRY_PROFILES)
      .filter((p) => p.code !== 'EU27_2020')
      .forEach((p) => {
        euByGeoName[p.geoJsonName] = p;
      });

    const data = isGlobalMetric
      ? cohdRecords
          .filter((c) => {
            const val = metric === 'cohdCostPpp' ? c.cost_healthy_diet_ppp_usd : c.unaffordable_pct;
            return val != null && val > 0;
          })
          .map((c) => {
            const euProf = euByGeoName[c.geojson_name];
            return {
              name: c.geojson_name,
              value: metric === 'cohdCostPpp' ? c.cost_healthy_diet_ppp_usd : (c.unaffordable_pct ?? 0),
              countryCode: euProf?.code,
              profile: euProf,
              cohd: c,
              giStat: euProf ? giCountryStats[euProf.code] : undefined,
              itemStyle:
                euProf && euProf.code === selectedCountry
                  ? { borderColor: '#111827', borderWidth: 2.2 }
                  : undefined,
            };
          })
      : Object.values(COUNTRY_PROFILES)
          .filter((p) => p.code !== 'EU27_2020')
          .map((p) => ({
            name: p.geoJsonName,
            value: m.getValue(p),
            countryCode: p.code,
            profile: p,
            cohd: cohdByGeoName[p.geoJsonName],
            giStat: giCountryStats[p.code],
            itemStyle:
              p.code === selectedCountry
                ? {
                    borderColor: '#111827',
                    borderWidth: 2.2,
                  }
                : undefined,
          }));

    const hubAccumulator: Record<
      string,
      {
        count: number;
        plantCount: number;
        sumLon: number;
        sumLat: number;
        sampleProduct: string;
        sampleGi: GICartographyItem;
      }
    > = {};

    for (const gi of filteredGiPins) {
      const cc = gi.country_code;
      const cat = classifyGiPinCategory(gi);
      if (!hubAccumulator[cc]) {
        hubAccumulator[cc] = {
          count: 0,
          plantCount: 0,
          sumLon: 0,
          sumLat: 0,
          sampleProduct: gi.product_name,
          sampleGi: gi,
        };
      }
      hubAccumulator[cc].count += 1;
      if (cat === 'plant') hubAccumulator[cc].plantCount += 1;
      hubAccumulator[cc].sumLon += gi.lon;
      hubAccumulator[cc].sumLat += gi.lat;
    }

    const hubPoints = Object.entries(hubAccumulator)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([cc, hub]) => {
        const override = COUNTRY_CENTROIDS[cc];
        const lon = override ? override[0] : +(hub.sumLon / hub.count).toFixed(4);
        const lat = override ? override[1] : +(hub.sumLat / hub.count).toFixed(4);
        const plantSharePct = hub.count > 0 ? +((hub.plantCount / hub.count) * 100).toFixed(1) : 0;
        const hubColor = plantSharePct >= 50 ? '#0d9488' : plantSharePct >= 30 ? '#163d4a' : '#8a1253';
        const hubStat: HubStatSummary = {
          countryCode: cc,
          count: hub.count,
          plantCount: hub.plantCount,
          plantSharePct,
          sampleProduct: hub.sampleProduct,
        };
        return {
          name: `${cc} (${hub.count})`,
          value: [lon, lat, hub.count],
          hubStat,
          giItem: hub.sampleGi,
          itemStyle: {
            color: hubColor,
            borderColor: '#ffffff',
            borderWidth: 1.5,
            opacity: 0.9,
          },
        };
      });

    const sampledPins = sampleProportionally(filteredGiPins, compact ? 600 : 1800);
    const sampledTotals: Record<string, number> = {};
    for (const gi of sampledPins) {
      sampledTotals[gi.country_code] = (sampledTotals[gi.country_code] || 0) + 1;
    }
    const sampledSeen: Record<string, number> = {};

    type GiPinPoint = {
      name: string;
      value: [number, number, number];
      giItem: GICartographyItem;
    };
    const plantPoints: GiPinPoint[] = [];
    const cheeseMeatPoints: GiPinPoint[] = [];
    const wineSpiritPoints: GiPinPoint[] = [];

    for (const gi of sampledPins) {
      const cc = gi.country_code;
      const idx = sampledSeen[cc] || 0;
      sampledSeen[cc] = idx + 1;
      const [lon, lat] = getOrganicGiCoords(gi, idx, sampledTotals[cc] || 1);
      const pt: GiPinPoint = {
        name: gi.product_name,
        value: [lon, lat, gi.co2_kg_per_kg],
        giItem: gi,
      };
      const cat = classifyGiPinCategory(gi);
      if (cat === 'plant') {
        plantPoints.push(pt);
      } else if (cat === 'wine_spirit') {
        wineSpiritPoints.push(pt);
      } else {
        cheeseMeatPoints.push(pt);
      }
    }

    const pinSizeConstellation =
      focusView === 'world' ? (compact ? 3.8 : 4.4) : compact ? 5 : 6.2;
    const carbonPinSize = (val: number[]) =>
      Math.max(3.5, Math.min(13, 3 + Math.sqrt(Math.max(0.2, val[2] || 1)) * 1.8));

    const pinScatterSeries =
      !showGiPins
        ? []
        : giVisualMode === 'hubs'
        ? [
            {
              name: 'National Terroir Hubs (GIview + EUIPO)',
              type: 'effectScatter',
              coordinateSystem: 'geo',
              showEffectOn: 'render',
              rippleEffect: { brushType: 'stroke', scale: 2.5, period: 5 },
              symbolSize: (val: number[]) => Math.max(10, Math.min(38, Math.sqrt(val[2] || 1) * 1.45)),
              labelLayout: { hideOverlap: true },
              label: {
                show: !compact,
                position: 'top',
                distance: 4,
                formatter: (p: { data?: { hubStat?: HubStatSummary } }) => {
                  const hs = p.data?.hubStat;
                  return hs && hs.count >= 25 ? `${hs.countryCode} · ${hs.count}` : '';
                },
                fontSize: 10,
                fontFamily: 'IBM Plex Mono, monospace',
                color: '#111827',
                backgroundColor: 'rgba(234, 237, 242, 0.88)',
                borderColor: '#aeb6c4',
                borderWidth: 0.6,
                padding: [1, 4],
                borderRadius: 3,
              },
              data: hubPoints,
            },
          ]
        : [
            {
              name: 'Artisanal Cheese & Meat GI',
              type: 'scatter',
              coordinateSystem: 'geo',
              large: false,
              zlevel: 1,
              symbolSize: giVisualMode === 'carbon' ? carbonPinSize : pinSizeConstellation,
              itemStyle: {
                color: '#d97706',
                borderColor: '#ffffff',
                borderWidth: 1.0,
                opacity: giVisualMode === 'carbon' ? 0.76 : 0.86,
                shadowBlur: 3,
                shadowColor: 'rgba(217, 119, 6, 0.3)',
              },
              data: cheeseMeatPoints,
            },
            {
              name: 'Viticulture & Spirits GI',
              type: 'scatter',
              coordinateSystem: 'geo',
              large: false,
              zlevel: 1,
              symbolSize: giVisualMode === 'carbon' ? carbonPinSize : pinSizeConstellation,
              itemStyle: {
                color: '#7c3aed',
                borderColor: '#ffffff',
                borderWidth: 1.0,
                opacity: 0.86,
              },
              data: wineSpiritPoints,
            },
            {
              name: 'Plant & Olive Oil GI (NOVA 1–2)',
              type: 'scatter',
              coordinateSystem: 'geo',
              large: false,
              zlevel: 2,
              symbolSize: giVisualMode === 'carbon' ? carbonPinSize : pinSizeConstellation,
              itemStyle: {
                color: '#0d9488',
                borderColor: '#ffffff',
                borderWidth: 1.1,
                opacity: 0.94,
                shadowBlur: 3,
                shadowColor: 'rgba(13, 148, 136, 0.35)',
              },
              data: plantPoints,
            },
            ...(giVisualMode === 'constellation' && !compact
              ? [
                  {
                    name: 'Top 10 National Terroir Hubs',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    zlevel: 2,
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 2.6, period: 5.5 },
                    symbolSize: focusView === 'world' ? 11 : 14,
                    labelLayout: { hideOverlap: true },
                    label: {
                      show: true,
                      position: 'right',
                      distance: 5,
                      formatter: (p: { data?: { hubStat?: HubStatSummary } }) => {
                        const hs = p.data?.hubStat;
                        return hs ? `${hs.countryCode} · ${hs.count}` : '';
                      },
                      fontSize: 10,
                      fontFamily: 'IBM Plex Mono, monospace',
                      color: '#111827',
                      backgroundColor: 'rgba(234, 237, 242, 0.88)',
                      borderColor: '#aeb6c4',
                      borderWidth: 0.6,
                      padding: [1, 4],
                      borderRadius: 3,
                    },
                    data: hubPoints.slice(0, 10),
                  },
                ]
              : []),
          ];

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
            cohd?: CohdCountryRecord;
            value?: number | number[];
            giStat?: { total: number; food: number; wine: number; spirit: number; plantSharePct: number };
            giItem?: GICartographyItem;
            hubStat?: HubStatSummary;
          };
          name: string;
        }) => {
          if (params.data?.hubStat) {
            const hs = params.data.hubStat;
            return `
              <div style="min-width:225px;max-width:290px;">
                <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;font-size:13px;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:5px;">
                  [${hs.countryCode}] National Terroir Hub
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#2d3643;font-family:'IBM Plex Mono',monospace;margin-bottom:5px;">
                  <span>Active GIs: <b>${hs.count.toLocaleString()}</b></span>
                  <span>Plant Share: <b>${hs.plantSharePct}%</b></span>
                </div>
                <div style="font-size:10px;color:#3d4654;font-family:'IBM Plex Mono',monospace;">
                  Flagship sample: ${hs.sampleProduct} (Click hub to filter)
                </div>
              </div>
            `;
          }

          if ((params.seriesType === 'scatter' || params.seriesType === 'effectScatter') && params.data?.giItem) {
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
                  <span>Processing: <b>NOVA ${gi.nova_group} (Class Proxy)</b></span>
                  <span>Carbon (est. proxy): <b>${gi.co2_kg_per_kg} kg CO₂</b></span>
                  <span>Water (est. proxy): <b>${gi.water_L_per_kg} L/kg</b></span>
                  <span>Premium (est.): <b>+${gi.price_premium_pct}%</b></span>
                </div>
                <div style="font-size:10px;color:#3d4654;font-family:'IBM Plex Mono',monospace;">
                  Source: ${gi.data_source} (Click pin to inspect dossier)
                </div>
              </div>
            `;
          }

          const p = params.data?.profile;
          const cohd = params.data?.cohd;
          const gs = params.data?.giStat;
          if (!p && cohd) {
            return `
              <div style="min-width:225px;">
                <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;font-size:13px;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:5px;">
                  [${cohd.iso3}] ${cohd.country_name}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#3d4654;font-family:'IBM Plex Mono',monospace;">
                  <span>Healthy Diet: <b>$${cohd.cost_healthy_diet_ppp_usd} PPP/d</b></span>
                  <span>Unaffordable: <b>${cohd.unaffordable_pct ?? '—'}%</b></span>
                  <span>Headcount: <b>${cohd.unaffordable_millions ?? '—'}M</b></span>
                  <span>Year: <b>${cohd.year}</b></span>
                </div>
              </div>
            `;
          }
          if (!p) {
            return `<div style="font-size:12px;color:#3d4654;"><b>${params.name}</b><br/>No harmonized overlay record</div>`;
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
                <span>Food GIs: <b>${gs ? gs.food : 0}</b></span>
                <span>Plant GI: <b>${gs ? gs.plantSharePct : 0}%</b></span>
                ${cohd ? `<span>WB CoHD: <b>$${cohd.cost_healthy_diet_ppp_usd} PPP</b></span><span>Unafford: <b>${cohd.unaffordable_pct ?? '—'}%</b></span>` : ''}
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
          areaColor: isDark ? '#27303f' : '#dde3ec',
          borderColor: isDark ? '#475569' : '#7c8ba1',
          borderWidth: 0.75,
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
        ...pinScatterSeries,
      ],
    };
  }, [geoLoaded, metric, focusView, selectedCountry, METRIC_META, giCountryStats, showGiPins, giVisualMode, filteredGiPins, compact, cohdRecords, cohdByGeoName, isDark]);

  const onEvents = useMemo(
    () => ({
      click: (params: {
        seriesType?: string;
        name?: string;
        data?: { countryCode?: string; giItem?: GICartographyItem; hubStat?: HubStatSummary };
      }) => {
        if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
          if (params.data?.giItem) {
            setSelectedGiItem(params.data.giItem);
          }
          const cc = params.data?.hubStat?.countryCode || params.data?.giItem?.country_code;
          if (cc && COUNTRY_PROFILES[cc]) {
            onSelectCountry(cc);
          }
          if (params.data?.giItem || params.data?.hubStat) {
            return;
          }
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
      {mapDisclosures.map((d, idx) => (
        <ResourceDisclosureBanner
          key={`${d.category}-${d.resourceLabel}-${idx}`}
          disclosure={d}
          onRetry={
            d.isRetryable
              ? () => {
                  setMapDisclosures([]);
                  setRetryCount((n) => n + 1);
                }
              : undefined
          }
          retryLabel="Retry"
          compact
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 rule-firm">
        <div>
          <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
            <Globe2 className="w-4 h-4" />
            Plate I. European &amp; global dietary choropleth + GI terroir spatial layer (
            {giRecords.length > 0
              ? `${foodGiCount.toLocaleString()} Food GIs / ${giRecords.length.toLocaleString()} total`
              : mapDisclosures.some((d) => d.isExcludedTrackB)
              ? 'GI pin overlay omitted in Track A'
              : '0 GI pins loaded'}
            )
            <DataNatureBadge
              nature={metric === 'cohdCostPpp' || metric === 'cohdUnaffordablePct' ? 'Observed' : 'Estimated'}
            />
          </h2>
          <p className="almanac-label">
            Defaults to Agro-Foodstuffs (<code>FOOD</code>: {foodGiCount.toLocaleString()}) so Wine, Spirits &amp; Craft
            are excluded from dietary counts; switch metric for 150+ World Bank CoHD economies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={metric}
            onChange={(e) => {
              const next = e.target.value as MapMetric;
              setMetric(next);
              if (next === 'cohdCostPpp' || next === 'cohdUnaffordablePct') {
                setFocusView('world');
              }
            }}
            className="almanac-select"
          >
            {Object.entries(METRIC_META).map(([k, v]) => (
              <option key={k} value={k}>
                Choropleth: {v.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowGiPins(!showGiPins)}
            disabled={giRecords.length === 0}
            aria-disabled={giRecords.length === 0}
            title={
              giRecords.length === 0
                ? 'GI Terroir spatial overlay unavailable or excluded in this distribution'
                : 'Toggle Agro-Foodstuffs GI Terroir spatial pins'
            }
            className={`almanac-btn flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${
              showGiPins ? 'almanac-btn--primary' : ''
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {giRecords.length === 0
              ? 'Food GI Pins Unavailable'
              : showGiPins
              ? `GI Terroir Pins ON (${filteredGiPins.length.toLocaleString()})`
              : `Overlay Food GI Pins (${foodGiCount.toLocaleString()})`}
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

      {/* GI Terroir Spatial Mode Bar (compact Overview toggle) */}
      {showGiPins && compact && giRecords.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 almanac-well text-[11px]">
          <span className="font-semibold text-[var(--color-ink)]">GI Overlay Mode:</span>
          <div className="flex flex-wrap items-center gap-1">
            {GI_VISUAL_MODES.map(([modeKey, label]) => (
              <button
                key={modeKey}
                type="button"
                onClick={() => setGiVisualMode(modeKey)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                  giVisualMode === modeKey
                    ? 'bg-[var(--color-ink)] text-[var(--color-sheet)] border-[var(--color-ink)] font-semibold'
                    : 'border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GI Terroir Spatial Filter Bar when GI Pins are enabled */}
      {showGiPins && !compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 almanac-well text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold flex items-center gap-1 text-[var(--color-ink)]">
              <Filter className="w-3.5 h-3.5" /> GI Terroir Layer:
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

            <div className="flex flex-wrap items-center gap-1">
              {GI_VISUAL_MODES.map(([modeKey, label]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setGiVisualMode(modeKey)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                    giVisualMode === modeKey
                      ? 'bg-[var(--color-ink)] text-[var(--color-sheet)] border-[var(--color-ink)] font-semibold'
                      : 'border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono-num text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#0d9488] ring-1 ring-white" /> Plant &amp; Olive Oil (NOVA 1–2)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#d97706] ring-1 ring-white" /> Cheese &amp; Meat
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-[#7c3aed] ring-1 ring-white" /> Wine &amp; Spirit
            </span>
          </div>
        </div>
      )}

      <div
        className={`${compact ? 'h-80' : 'h-[520px]'} w-full relative almanac-well overflow-hidden`}
        style={{
          background: isDark
            ? 'radial-gradient(circle at 50% 45%, rgba(30, 41, 59, 0.65) 0%, rgba(15, 23, 42, 0.9) 100%)'
            : 'radial-gradient(circle at 50% 45%, rgba(214, 224, 236, 0.45) 0%, rgba(186, 201, 218, 0.65) 100%)',
        }}
      >
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

        {geoLoaded && showGiPins && giRecords.length > 0 && (
          <div
            className={`pointer-events-none absolute z-10 flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1 backdrop-blur-sm ${
              compact ? 'left-2 top-2' : 'left-2.5 bottom-2.5'
            } ${
              isDark
                ? 'bg-slate-900/80 border-slate-700/80 text-slate-100'
                : 'bg-[#eaedf2]/88 border-[#aeb6c4] text-[#111827]'
            } ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          >
            <span className="font-mono font-semibold opacity-85">
              {giVisualMode === 'constellation'
                ? '✦ Constellation'
                : giVisualMode === 'hubs'
                ? '◎ Hubs'
                : '⚖ Carbon Scale'}
            </span>
            {giVisualMode === 'hubs' ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#0d9488]" /> ≥50% Plant
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#163d4a]" /> 30–50% Plant
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#8a1253]" /> &lt;30% Plant
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#0d9488]" /> Plant &amp; Oil
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#d97706]" /> Cheese &amp; Meat
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Wine &amp; Spirit
                </span>
              </>
            )}
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
              {selectedGiItem.eu_class} | <b>NOVA {selectedGiItem.nova_group}</b> | Class Proxy Carbon (est.):{' '}
              <b className="font-mono-num">{selectedGiItem.co2_kg_per_kg} kg CO₂/kg</b> | Class Proxy Water (est.):{' '}
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
