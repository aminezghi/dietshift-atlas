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

export async function getDuckDBConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    const parquetFiles = [
      'agribalyse_31.parquet',
      'openfoodfacts_eu.parquet',
      'efsa_foodex2_surveys.parquet',
      'crosswalk_rosetta.parquet',
      'nsi_subnational_quintiles.parquet',
      'ml_timesfm_forecasts.parquet',
      'consumer_behavior_pulse.parquet',
      'social_discourse_velocity.parquet',
      'gi_terroir_registry.parquet',
      'gs1_immagino_observatory.parquet',
      'scrapling_retail_claims.parquet',
      'pan_eu_retail_scanner.parquet',
    ];

    for (const file of parquetFiles) {
      await db.registerFileURL(
        file,
        absoluteAssetUrl(`data/parquet/${file}`),
        duckdb.DuckDBDataProtocol.HTTP,
        false
      );
    }

    const conn = await db.connect();

    await conn.query(`
      CREATE VIEW IF NOT EXISTS agribalyse AS SELECT * FROM parquet_scan('agribalyse_31.parquet');
      CREATE VIEW IF NOT EXISTS openfoodfacts AS SELECT * FROM parquet_scan('openfoodfacts_eu.parquet');
      CREATE VIEW IF NOT EXISTS efsa_foodex2 AS SELECT * FROM parquet_scan('efsa_foodex2_surveys.parquet');
      CREATE VIEW IF NOT EXISTS crosswalk_rosetta AS SELECT * FROM parquet_scan('crosswalk_rosetta.parquet');
      CREATE VIEW IF NOT EXISTS nsi_subnational_quintiles AS SELECT * FROM parquet_scan('nsi_subnational_quintiles.parquet');
      CREATE VIEW IF NOT EXISTS ml_timesfm_forecasts AS SELECT * FROM parquet_scan('ml_timesfm_forecasts.parquet');
      CREATE VIEW IF NOT EXISTS consumer_behavior_pulse AS SELECT * FROM parquet_scan('consumer_behavior_pulse.parquet');
      CREATE VIEW IF NOT EXISTS social_discourse_velocity AS SELECT * FROM parquet_scan('social_discourse_velocity.parquet');
      CREATE VIEW IF NOT EXISTS gi_terroir_registry AS SELECT * FROM parquet_scan('gi_terroir_registry.parquet');
      CREATE VIEW IF NOT EXISTS gs1_immagino_observatory AS SELECT * FROM parquet_scan('gs1_immagino_observatory.parquet');
      CREATE VIEW IF NOT EXISTS scrapling_retail_claims AS SELECT * FROM parquet_scan('scrapling_retail_claims.parquet');
      CREATE VIEW IF NOT EXISTS pan_eu_retail_scanner AS SELECT * FROM parquet_scan('pan_eu_retail_scanner.parquet');
    `);

    dbInstance = db;
    connInstance = conn;
    return conn;
  })();

  return initPromise;
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
