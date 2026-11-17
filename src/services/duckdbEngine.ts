import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { absoluteAssetUrl } from '../utils/assetPath';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

const VIEW_DEFINITIONS: Array<[string, string]> = [
  ['agribalyse', 'agribalyse_31.parquet'],
  ['openfoodfacts', 'openfoodfacts_eu.parquet'],
  ['efsa_foodex2', 'efsa_foodex2_surveys.parquet'],
  ['crosswalk_rosetta', 'crosswalk_rosetta.parquet'],
  ['classification_mappings', 'classification_mappings.parquet'],
  ['nsi_subnational_quintiles', 'nsi_subnational_quintiles.parquet'],
  ['statistical_price_forecasts', 'statistical_price_forecasts.parquet'],
  ['consumer_behavior_pulse', 'consumer_behavior_pulse.parquet'],
  ['social_discourse_velocity', 'social_discourse_velocity.parquet'],
  ['gi_terroir_registry', 'gi_terroir_registry.parquet'],
  ['gs1_immagino_observatory', 'gs1_immagino_observatory.parquet'],
  ['scrapling_retail_claims', 'scrapling_retail_claims.parquet'],
  ['pan_eu_retail_scanner', 'pan_eu_retail_scanner.parquet'],
  ['time_use_cooking_friction', 'time_use_cooking_friction.parquet'],
  ['clinical_biomarker_grounding', 'clinical_biomarker_grounding.parquet'],
  ['school_meals_procurement', 'school_meals_procurement.parquet'],
  ['cultural_climate_inertia', 'cultural_climate_inertia.parquet'],
  ['global_poore_nemecek_lca', 'global_poore_nemecek_lca.parquet'],
  ['global_healthy_diet_affordability', 'global_healthy_diet_affordability.parquet'],
];

const registeredViews = new Set<string>();
const unavailableViews = new Set<string>();

export async function getDuckDBConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    for (const [, file] of VIEW_DEFINITIONS) {
      await db.registerFileURL(
        file,
        absoluteAssetUrl(`data/parquet/${file}`),
        duckdb.DuckDBDataProtocol.HTTP,
        false
      );
    }

    const conn = await db.connect();

    for (const [viewName, file] of VIEW_DEFINITIONS) {
      try {
        await conn.query(
          `CREATE VIEW IF NOT EXISTS ${viewName} AS SELECT * FROM parquet_scan('${file}');`
        );
        registeredViews.add(viewName);
      } catch {
        unavailableViews.add(viewName);
      }
    }

    dbInstance = db;
    connInstance = conn;
    return conn;
  })();

  return initPromise;
}

export function getDuckDBViewAvailability(): {
  registeredViews: string[];
  unavailableViews: string[];
} {
  return {
    registeredViews: Array.from(registeredViews),
    unavailableViews: Array.from(unavailableViews),
  };
}

export async function runDuckDBQuery(sql: string): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  elapsedMs: number;
}> {
  const t0 = performance.now();
  const conn = await getDuckDBConnection();
  const arrowResult = await conn.query(sql);
  const elapsedMs = +(performance.now() - t0).toFixed(1);

  const columns = arrowResult.schema.fields.map((f) => f.name);
  const rows: Record<string, unknown>[] = arrowResult.toArray().map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col];
      obj[col] = typeof val === 'bigint' ? Number(val) : val;
    }
    return obj;
  });

  return { columns, rows, elapsedMs };
}

export { dbInstance };
