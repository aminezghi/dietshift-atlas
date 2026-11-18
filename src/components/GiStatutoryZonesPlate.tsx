import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import { Award, Building2, Database, Layers, MapPin, Search } from 'lucide-react';
import { runDuckDBQuery } from '../services/duckdbEngine';
import { DataNatureBadge } from './DataNatureBadge';

export interface GiStatutoryProductMeta {
  cn_code: string;
  legal_instrument: string;
  registration_year: number | null;
  producer_group: string;
  control_authority: string;
  regions: string;
  provinces: string;
  region_count: number;
  province_count: number;
  municipality_count: number;
  municipalities_preview: string;
  data_source_url: string;
}

export interface GiStatutoryNuts2Row {
  country_code: string;
  region_name: string;
  total_gis: number;
  food_gis: number;
  wine_gis: number;
  spirit_gis: number;
  plant_food_gis: number;
  animal_food_gis: number;
  plant_food_share_pct: number;
  total_municipality_links: number;
  sample_products: string;
}

export interface GiStatutoryProvinceRow {
  country_code: string;
  province_name: string;
  region_name: string;
  municipality_count: number;
  mean_gis_per_municipality: number;
  max_gis_in_municipality: number;
  top_municipality: string;
  top_municipality_gi_count: number;
  plant_municipality_share_pct: number;
}

export interface GiStatutoryMunicipalityRow {
  country_code: string;
  municipality: string;
  insee_code: string | null;
  province_or_dept: string;
  region: string | null;
  gi_product_count: number;
  gi_category_count: number;
  has_plant_gi: boolean;
  has_animal_gi: boolean;
  gi_products_preview: string;
  gi_categories: string;
}

export interface GiStatutoryCnRow {
  cn_chapter: string;
  FR: number;
  IT: number;
  ES: number;
  total_gis: number;
  food_gis: number;
}

export interface GiStatutoryZonesBundle {
  metadata: {
    version: string;
    total_products: number;
    total_municipalities: number;
    country_counts: Record<string, { products: number; food_products: number; municipalities: number }>;
    sources: string;
  };
  products_by_file_number: Record<string, GiStatutoryProductMeta>;
  nuts2_regions: GiStatutoryNuts2Row[];
  province_hotspots: GiStatutoryProvinceRow[];
  top_municipalities: GiStatutoryMunicipalityRow[];
  cn_chapters: GiStatutoryCnRow[];
}

interface GiStatutoryZonesPlateProps {
  data: GiStatutoryZonesBundle;
  selectedCountry: string;
}

export function GiStatutoryZonesPlate({ data, selectedCountry }: GiStatutoryZonesPlateProps) {
  const [activeTab, setActiveTab] = useState<'municipalities' | 'nuts2' | 'governance'>('municipalities');
  const [countryFilter, setCountryFilter] = useState<'ALL' | 'FR' | 'IT' | 'ES'>(() =>
    selectedCountry === 'FR' || selectedCountry === 'IT' || selectedCountry === 'ES' ? selectedCountry : 'ALL'
  );
  const [muniQuery, setMuniQuery] = useState<string>('');
  const [duckdbRows, setDuckdbRows] = useState<GiStatutoryMunicipalityRow[] | null>(null);
  const [searchingDuckDb, setSearchingDuckDb] = useState<boolean>(false);
  const [lastQueryMode, setLastQueryMode] = useState<'preloaded' | 'duckdb' | 'fallback'>('preloaded');

  useEffect(() => {
    const trimmed = muniQuery.trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      // Allow only safe Unicode letters, numbers, spaces, hyphens
      const safe = trimmed.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim();
      if (safe.length < 2) return;
      const likeTerm = `%${safe.toLowerCase()}%`;
      const ccClause = countryFilter === 'ALL' ? '' : `country_code = '${countryFilter}' AND `;
      setSearchingDuckDb(true);
      try {
        const res = await runDuckDBQuery(`
          SELECT
            country_code,
            municipality,
            insee_code,
            province_or_dept,
            region,
            gi_product_count,
            gi_category_count,
            has_plant_gi,
            has_animal_gi,
            gi_products AS gi_products_preview,
            gi_categories
          FROM gi_municipality_index
          WHERE ${ccClause}(
            LOWER(municipality) LIKE '${likeTerm}'
            OR LOWER(COALESCE(insee_code, '')) LIKE '${likeTerm}'
            OR LOWER(province_or_dept) LIKE '${likeTerm}'
            OR LOWER(COALESCE(region, '')) LIKE '${likeTerm}'
            OR LOWER(gi_products) LIKE '${likeTerm}'
          )
          ORDER BY gi_product_count DESC, municipality ASC
          LIMIT 100
        `);
        if (!cancelled) {
          setDuckdbRows(
            res.rows.map((r) => ({
              country_code: String(r.country_code ?? ''),
              municipality: String(r.municipality ?? ''),
              insee_code: r.insee_code ? String(r.insee_code) : null,
              province_or_dept: String(r.province_or_dept ?? ''),
              region: r.region ? String(r.region) : null,
              gi_product_count: Number(r.gi_product_count ?? 0),
              gi_category_count: Number(r.gi_category_count ?? 0),
              has_plant_gi: Boolean(r.has_plant_gi),
              has_animal_gi: Boolean(r.has_animal_gi),
              gi_products_preview: String(r.gi_products_preview ?? ''),
              gi_categories: String(r.gi_categories ?? ''),
            }))
          );
          setLastQueryMode('duckdb');
        }
      } catch {
        if (!cancelled) {
          setDuckdbRows(null);
          setLastQueryMode('fallback');
        }
      } finally {
        if (!cancelled) setSearchingDuckDb(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [muniQuery, countryFilter]);

  const displayedMunicipalities = useMemo(() => {
    if (muniQuery.trim().length >= 2 && duckdbRows !== null) return duckdbRows;
    const q = muniQuery.trim().toLowerCase();
    return data.top_municipalities
      .filter((m) => {
        if (countryFilter !== 'ALL' && m.country_code !== countryFilter) return false;
        if (!q) return true;
        return (
          m.municipality.toLowerCase().includes(q) ||
          (m.insee_code && m.insee_code.toLowerCase().includes(q)) ||
          m.province_or_dept.toLowerCase().includes(q) ||
          (m.region && m.region.toLowerCase().includes(q)) ||
          m.gi_products_preview.toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [data.top_municipalities, duckdbRows, muniQuery, countryFilter]);

  const filteredNuts2 = useMemo(
    () => data.nuts2_regions.filter((r) => countryFilter === 'ALL' || r.country_code === countryFilter),
    [data.nuts2_regions, countryFilter]
  );

  const filteredProvinces = useMemo(
    () => data.province_hotspots.filter((p) => countryFilter === 'ALL' || p.country_code === countryFilter),
    [data.province_hotspots, countryFilter]
  );

  const nuts2ChartOption = useMemo(() => {
    const top16 = filteredNuts2.slice(0, 16);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      legend: {
        top: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 10,
        itemGap: 16,
        textStyle: { color: '#111827', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' },
      },
      grid: { top: 48, right: 24, bottom: 38, left: 190 },
      xAxis: {
        type: 'value',
        name: 'Food GIs',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: '#aeb6c4' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: top16.map((r) => `[${r.country_code}] ${r.region_name}`),
        axisLabel: { color: '#111827', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      series: [
        {
          name: 'Plant & Olive Oil (1.5–1.6)',
          type: 'bar',
          stack: 'food',
          barMaxWidth: 16,
          itemStyle: { color: '#0d9488' },
          data: top16.map((r) => r.plant_food_gis),
        },
        {
          name: 'Animal & Composite (1.1–1.4, 2.x)',
          type: 'bar',
          stack: 'food',
          barMaxWidth: 16,
          itemStyle: { color: '#8a1253' },
          data: top16.map((r) => r.animal_food_gis),
        },
      ],
    };
  }, [filteredNuts2]);

  return (
    <div className="pt-3 rule-firm space-y-3" data-testid="plate-1c-statutory">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 rule-firm">
        <div>
          <h3 className="text-sm font-semibold flex flex-wrap items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-accent)]" />
            Plate I-C. Statutory GI Production Zones &amp; {data.metadata.total_municipalities.toLocaleString()}-Municipality
            (LAU) Terroir Index
            <DataNatureBadge nature="Observed" label="EU eAmbrosia · INAO · ISTAT · MAPA · INE" />
          </h3>
          <p className="almanac-label text-xs">
            Exact statutory municipal/provincial production boundaries across France (
            {data.metadata.country_counts.FR.municipalities.toLocaleString()} communes), Italy (
            {data.metadata.country_counts.IT.municipalities.toLocaleString()} comuni), and Spain (
            {data.metadata.country_counts.ES.municipalities.toLocaleString()} municipios) covering{' '}
            <b>{data.metadata.total_products.toLocaleString()}</b> PDO/PGI/Spirit designations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value as 'ALL' | 'FR' | 'IT' | 'ES')}
            className="almanac-select text-xs"
            aria-label="Filter statutory country"
          >
            <option value="ALL">FR + IT + ES (50,763 LAUs · 2,109 GIs)</option>
            <option value="FR">[FR] France (36,239 Communes · 806 GIs)</option>
            <option value="IT">[IT] Italy (7,893 Comuni · 889 GIs)</option>
            <option value="ES">[ES] Spain (6,631 Municipios · 414 GIs)</option>
          </select>

          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ['municipalities', 'Municipality Index (50,763 LAU)'],
                ['nuts2', 'NUTS-2 Regional Terroir'],
                ['governance', 'CN Tariff & NUTS-3 Hotspots'],
              ] as const
            ).map(([tKey, tLabel]) => (
              <button
                key={tKey}
                type="button"
                onClick={() => setActiveTab(tKey)}
                className={`px-2.5 py-1 rounded border text-xs font-mono cursor-pointer transition-colors ${
                  activeTab === tKey
                    ? 'bg-[var(--color-ink)] text-[var(--color-sheet)] border-[var(--color-ink)] font-semibold'
                    : 'border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                }`}
              >
                {tLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'municipalities' && (
        <div className="almanac-well p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
              <input
                type="text"
                value={muniQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setMuniQuery(val);
                  if (val.trim().length < 2) {
                    setDuckdbRows(null);
                    setLastQueryMode('preloaded');
                  }
                }}
                placeholder="Search any municipality, INSEE code, province, or GI (e.g. Gevrey, Abano, 64001, Gorgonzola)..."
                className="almanac-input text-xs w-full"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono-num text-[var(--color-muted)]">
              <Database className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              {searchingDuckDb
                ? 'Querying 50,763 LAUs in DuckDB-Wasm...'
                : lastQueryMode === 'duckdb'
                ? `Showing ${displayedMunicipalities.length} matches across all 50,763 municipalities (DuckDB-Wasm)`
                : `Top ${displayedMunicipalities.length} flagship hubs shown (type ≥2 chars to search all 50,763 LAUs)`}
            </div>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Municipality (LAU)</th>
                  <th>INSEE</th>
                  <th>Province / Dept (NUTS-3)</th>
                  <th>Region (NUTS-2)</th>
                  <th className="text-right">GIs</th>
                  <th className="text-right">Classes</th>
                  <th>Plant / Animal Profile</th>
                  <th>Authorized Protected GIs</th>
                </tr>
              </thead>
              <tbody>
                {displayedMunicipalities.map((m, idx) => (
                  <tr key={`${m.country_code}-${m.municipality}-${m.insee_code ?? idx}`}>
                    <td className="font-mono-num font-semibold">{m.country_code}</td>
                    <td className="font-semibold text-[var(--color-ink)]">{m.municipality}</td>
                    <td className="font-mono-num text-xs text-[var(--color-muted)]">{m.insee_code || '—'}</td>
                    <td className="text-xs">{m.province_or_dept}</td>
                    <td className="text-xs text-[var(--color-muted)]">{m.region || '—'}</td>
                    <td className="num text-right font-semibold text-[var(--color-accent)]">{m.gi_product_count}</td>
                    <td className="num text-right">{m.gi_category_count}</td>
                    <td className="text-[10px] font-mono-num whitespace-nowrap">
                      {m.has_plant_gi && (
                        <span className="px-1 py-0.5 rounded bg-emerald-700/15 text-emerald-800 mr-1 font-semibold">
                          Plant/Oil
                        </span>
                      )}
                      {m.has_animal_gi && (
                        <span className="px-1 py-0.5 rounded bg-amber-700/15 text-amber-800 font-semibold">
                          Animal/Cheese
                        </span>
                      )}
                      {!m.has_plant_gi && !m.has_animal_gi && <span className="text-[var(--color-muted)]">Wine/Spirit</span>}
                    </td>
                    <td className="text-xs max-w-md truncate" title={m.gi_products_preview}>
                      {m.gi_products_preview}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'nuts2' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-6 almanac-well p-3.5">
            <div className="pb-2 mb-2 rule-firm">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                Top NUTS-2 Regions by Statutory Agro-Food GI Count &amp; Plant-Origin Share
              </h4>
            </div>
            <div className="h-80 w-full">
              <ReactECharts option={nuts2ChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            </div>
          </div>

          <div className="xl:col-span-6 almanac-well p-3.5">
            <div className="pb-2 mb-2 rule-firm">
              <h4 className="text-xs font-semibold">
                All Delineated NUTS-2 Regions ({filteredNuts2.length} regions)
              </h4>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>Jurisdiction</th>
                    <th>NUTS-2 Region</th>
                    <th className="text-right">Total GIs</th>
                    <th className="text-right">Food GIs</th>
                    <th className="text-right">Plant Share</th>
                    <th className="text-right">Wine/Spirit</th>
                    <th>Sample Food GIs</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNuts2.map((r) => (
                    <tr key={`${r.country_code}-${r.region_name}`}>
                      <td className="font-mono-num font-semibold">{r.country_code}</td>
                      <td className="font-semibold text-[var(--color-ink)]">{r.region_name}</td>
                      <td className="num text-right">{r.total_gis}</td>
                      <td className="num text-right font-semibold">{r.food_gis}</td>
                      <td className="num text-right font-semibold text-emerald-700">{r.plant_food_share_pct}%</td>
                      <td className="num text-right text-xs text-[var(--color-muted)]">
                        {r.wine_gis} / {r.spirit_gis}
                      </td>
                      <td className="text-xs max-w-xs truncate" title={r.sample_products}>
                        {r.sample_products || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'governance' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-5 almanac-well p-3.5">
            <div className="pb-2 mb-2 rule-firm">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                EU Combined Nomenclature (CN) Trade Tariff Chapter Alignment
              </h4>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>CN Chapter</th>
                    <th className="text-right">FR</th>
                    <th className="text-right">IT</th>
                    <th className="text-right">ES</th>
                    <th className="text-right">Food GIs</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cn_chapters.map((ch) => (
                    <tr key={ch.cn_chapter}>
                      <td className="font-semibold text-xs">{ch.cn_chapter}</td>
                      <td className="num text-right">{ch.FR}</td>
                      <td className="num text-right">{ch.IT}</td>
                      <td className="num text-right">{ch.ES}</td>
                      <td className="num text-right font-semibold text-emerald-700">{ch.food_gis}</td>
                      <td className="num text-right font-semibold">{ch.total_gis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-7 almanac-well p-3.5">
            <div className="pb-2 mb-2 rule-firm">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                Top NUTS-3 Provinces / Départements by Municipal GI Density ({filteredProvinces.length} shown)
              </h4>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>CC</th>
                    <th>Province / Département</th>
                    <th className="text-right">LAUs</th>
                    <th className="text-right">Mean GIs/LAU</th>
                    <th className="text-right">Peak Municipality</th>
                    <th className="text-right">Plant LAU Share</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProvinces.map((p) => (
                    <tr key={`${p.country_code}-${p.province_name}`}>
                      <td className="font-mono-num font-semibold">{p.country_code}</td>
                      <td className="font-semibold text-[var(--color-ink)]">{p.province_name}</td>
                      <td className="num text-right">{p.municipality_count.toLocaleString()}</td>
                      <td className="num text-right font-semibold text-[var(--color-accent)]">
                        {p.mean_gis_per_municipality}
                      </td>
                      <td className="text-right text-xs">
                        <b>{p.top_municipality}</b> ({p.top_municipality_gi_count} GIs)
                      </td>
                      <td className="num text-right font-semibold text-emerald-700">
                        {p.plant_municipality_share_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
