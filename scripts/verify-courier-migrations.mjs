/**
 * Probes Supabase REST for fulfillment golden migration artifacts + RLS regression.
 *
 * Usage:
 *   node scripts/verify-courier-migrations.mjs
 *   node scripts/verify-courier-migrations.mjs --compare
 *   SUPABASE_URL=... SUPABASE_KEY=... node scripts/verify-courier-migrations.mjs
 *
 * Optional staging compare:
 *   SUPABASE_URL_STAGING=... SUPABASE_KEY_STAGING=...
 *   SUPABASE_URL_PRODUCTION=... SUPABASE_KEY_PRODUCTION=...
 */
const DEFAULT_URL = "https://gbzmqlamuimtiunofgxu.supabase.co";
const DEFAULT_KEY = "sb_publishable_RWnWRlA_Do1Yb4N9uibZkA_nr1RMx7f";

const GOLDEN_MIGRATION_ID = "tanidik_fulfillment_golden_v1";

const args = new Set(process.argv.slice(2));
const compareMode = args.has("--compare");

function loadEnvConfig(suffix = "") {
  const urlKey = suffix ? `SUPABASE_URL_${suffix}` : "SUPABASE_URL";
  const keyKey = suffix ? `SUPABASE_KEY_${suffix}` : "SUPABASE_KEY";
  return {
    label: suffix ? suffix.toLowerCase() : "default",
    url: process.env[urlKey] || (suffix ? null : DEFAULT_URL),
    key: process.env[keyKey] || (suffix ? null : DEFAULT_KEY),
  };
}

function headers(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function rpcExistsFromResponse(status, bodyText) {
  const lower = bodyText.toLowerCase();
  if (
    status === 404 ||
    lower.includes("pgrst202") ||
    lower.includes("could not find the function")
  ) {
    return { exists: false, note: bodyText.slice(0, 220) };
  }
  return { exists: true, note: bodyText.slice(0, 220) || `HTTP ${status}` };
}

function isRlsRecursion(bodyText) {
  const lower = (bodyText || "").toLowerCase();
  return (
    lower.includes("42p17") ||
    lower.includes("infinite recursion") ||
    lower.includes("infinite recursion detected")
  );
}

async function probeRpc(baseUrl, key, name, params = {}) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify(params),
  });
  const text = await res.text();
  return { http: res.status, ...rpcExistsFromResponse(res.status, text) };
}

async function probeSelect(baseUrl, key, table, selectCols) {
  const q = encodeURIComponent(selectCols);
  const res = await fetch(`${baseUrl}/rest/v1/${table}?select=${q}&limit=0`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  const lower = text.toLowerCase();
  if (isRlsRecursion(text)) {
    return {
      exists: true,
      http: res.status,
      rls_recursion: true,
      note: text.slice(0, 220),
    };
  }
  if (lower.includes("column") && lower.includes("does not exist")) {
    return { exists: false, http: res.status, note: text.slice(0, 220) };
  }
  if (lower.includes("relation") && lower.includes("does not exist")) {
    return { exists: false, http: res.status, note: text.slice(0, 220) };
  }
  if (res.ok) return { exists: true, http: res.status, note: "ok" };
  return { exists: true, http: res.status, note: text.slice(0, 220) };
}

async function probeSelectRows(baseUrl, key, table, selectCols, filters = "") {
  const res = await fetch(
    `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(selectCols)}${filters}&limit=5`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const text = await res.text();
  if (isRlsRecursion(text)) {
    return { ok: false, http: res.status, rls_recursion: true, error: text.slice(0, 300) };
  }
  if (!res.ok) return { ok: false, http: res.status, error: text.slice(0, 300) };
  try {
    return { ok: true, http: res.status, rows: JSON.parse(text) };
  } catch {
    return { ok: false, error: text.slice(0, 300) };
  }
}

function migrationVerdict(checks) {
  const values = Object.values(checks);
  const missing = values.filter((v) => v.exists === false);
  if (missing.length === 0) return "APPLIED";
  if (missing.length === values.length) return "NOT_APPLIED";
  return "PARTIAL";
}

function rlsRegressionVerdict(checks) {
  const failures = Object.entries(checks).filter(
    ([, v]) => v.rls_recursion || v.http === 500
  );
  if (failures.length === 0) return "PASS";
  return "FAIL";
}

function fingerprintChecks(checks) {
  return Object.fromEntries(
    Object.entries(checks).map(([k, v]) => [
      k,
      {
        exists: v.exists !== false,
        rls_recursion: Boolean(v.rls_recursion),
        http: v.http,
      },
    ])
  );
}

function environmentsMatch(fpA, fpB) {
  return JSON.stringify(fpA) === JSON.stringify(fpB);
}

async function runEnvironmentAudit(config) {
  if (!config.url || !config.key) {
    return { error: `Missing URL or KEY for ${config.label}` };
  }

  const golden = {
    schema_migrations_ledger: await probeSelect(
      config.url,
      config.key,
      "schema_migrations",
      "id,applied_at"
    ),
    orders_table: await probeSelect(config.url, config.key, "orders", "id,order_type,status"),
    deliveries_venue_id: await probeSelect(config.url, config.key, "deliveries", "venue_id"),
    deliveries_business_owner_id: await probeSelect(
      config.url,
      config.key,
      "deliveries",
      "business_owner_id"
    ),
    couriers_email: await probeSelect(config.url, config.key, "couriers", "email"),
    couriers_user_id_nullable: await probeSelect(config.url, config.key, "couriers", "user_id"),
    rpc_create_restaurant_order: await probeRpc(
      config.url,
      config.key,
      "create_restaurant_order",
      {
        p_venue_id: 1,
        p_order_type: "pickup",
        p_items: [],
      }
    ),
    rpc_get_courier_delivery_pool: await probeRpc(
      config.url,
      config.key,
      "get_courier_delivery_pool"
    ),
    rpc_accept_courier_delivery: await probeRpc(
      config.url,
      config.key,
      "accept_courier_delivery",
      { p_delivery_id: "00000000-0000-0000-0000-000000000001" }
    ),
    rpc_update_courier_delivery_status: await probeRpc(
      config.url,
      config.key,
      "update_courier_delivery_status",
      {
        p_delivery_id: "00000000-0000-0000-0000-000000000001",
        p_new_status: "picked_up",
      }
    ),
    rpc_ensure_courier_delivery_for_order: await probeRpc(
      config.url,
      config.key,
      "ensure_courier_delivery_for_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
    rpc_resolve_my_active_courier: await probeRpc(
      config.url,
      config.key,
      "resolve_my_active_courier"
    ),
    rpc_admin_upsert_courier: await probeRpc(
      config.url,
      config.key,
      "admin_upsert_courier",
      {
        p_email: "migration-probe@tanidik.invalid",
        p_full_name: "Migration Probe",
        p_user_id: null,
        p_status: "inactive",
      }
    ),
    rpc_get_courier_delivery_history: await probeRpc(
      config.url,
      config.key,
      "get_courier_delivery_history",
      { p_limit: 1 }
    ),
    rpc_admin_assign_courier_delivery: await probeRpc(
      config.url,
      config.key,
      "admin_assign_courier_delivery",
      {
        p_delivery_id: "00000000-0000-0000-0000-000000000001",
        p_courier_id: "00000000-0000-0000-0000-000000000001",
      }
    ),
    rpc_get_admin_delivery_dispatch_board: await probeRpc(
      config.url,
      config.key,
      "get_admin_delivery_dispatch_board"
    ),
    rpc_get_my_restaurant_orders: await probeRpc(
      config.url,
      config.key,
      "get_my_restaurant_orders"
    ),
    rpc_get_my_restaurant_order: await probeRpc(
      config.url,
      config.key,
      "get_my_restaurant_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
    rpc_get_business_restaurant_orders: await probeRpc(
      config.url,
      config.key,
      "get_business_restaurant_orders",
      { p_venue_ids: [] }
    ),
    rpc_courier_can_read_order: await probeRpc(
      config.url,
      config.key,
      "courier_can_read_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
  };

  const legacyAliases = {
    rpc_accept_delivery: await probeRpc(config.url, config.key, "accept_delivery", {
      p_delivery_id: "00000000-0000-0000-0000-000000000001",
    }),
    rpc_update_delivery_status: await probeRpc(
      config.url,
      config.key,
      "update_delivery_status",
      {
        p_delivery_id: "00000000-0000-0000-0000-000000000001",
        p_new_status: "picked_up",
      }
    ),
    rpc_ensure_open_delivery_for_order: await probeRpc(
      config.url,
      config.key,
      "ensure_open_delivery_for_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
    rpc_update_restaurant_order_status: await probeRpc(
      config.url,
      config.key,
      "update_restaurant_order_status",
      {
        p_order_id: "00000000-0000-0000-0000-000000000001",
        p_new_status: "accepted",
      }
    ),
  };

  const rlsRegression = {
    deliveries_select_anon: await probeSelectRows(
      config.url,
      config.key,
      "deliveries",
      "id,status,courier_id,order_id,venue_id"
    ),
    couriers_select_anon: await probeSelectRows(
      config.url,
      config.key,
      "couriers",
      "id,email,user_id,status"
    ),
    orders_select_anon: await probeSelectRows(
      config.url,
      config.key,
      "orders",
      "id,status,order_type"
    ),
    deliveries_pool_status_probe: await probeSelectRows(
      config.url,
      config.key,
      "deliveries",
      "id,status,courier_id,order_id",
      "&status=in.(available,open,pending)&courier_id=is.null"
    ),
  };

  let ledgerApplied = false;
  if (golden.schema_migrations_ledger.exists) {
    const ledgerRes = await probeSelectRows(
      config.url,
      config.key,
      "schema_migrations",
      "id,applied_at",
      `&id=eq.${GOLDEN_MIGRATION_ID}`
    );
    ledgerApplied = ledgerRes.ok && Array.isArray(ledgerRes.rows) && ledgerRes.rows.length > 0;
  }

  const goldenCore = { ...golden };
  delete goldenCore.schema_migrations_ledger;

  return {
    environment: config.label,
    url: config.url,
    timestamp: new Date().toISOString(),
    golden_migration_id: GOLDEN_MIGRATION_ID,
    ledger_applied: ledgerApplied,
    verdict: {
      golden_fulfillment: migrationVerdict(goldenCore),
      legacy_aliases: migrationVerdict(legacyAliases),
      rls_regression: rlsRegressionVerdict(rlsRegression),
    },
    checks: {
      golden: goldenCore,
      legacy_aliases: legacyAliases,
      rls_regression: rlsRegression,
    },
    fingerprint: fingerprintChecks({ ...goldenCore, ...legacyAliases }),
  };
}

async function main() {
  if (compareMode) {
    const staging = loadEnvConfig("STAGING");
    const production = loadEnvConfig("PRODUCTION");
    const defaultCfg = loadEnvConfig();

    const stagingCfg =
      staging.url && staging.key
        ? staging
        : { ...defaultCfg, label: "staging_unconfigured" };
    const productionCfg =
      production.url && production.key
        ? production
        : { ...defaultCfg, label: "production" };

    const [stagingReport, productionReport] = await Promise.all([
      runEnvironmentAudit(stagingCfg),
      runEnvironmentAudit(productionCfg),
    ]);

    const match =
      stagingReport.fingerprint &&
      productionReport.fingerprint &&
      environmentsMatch(stagingReport.fingerprint, productionReport.fingerprint);

    const report = {
      mode: "compare",
      environments_match: match,
      staging: stagingReport,
      production: productionReport,
      recommendation: match
        ? "Staging and production fingerprints match."
        : "Run sql/tanidik_fulfillment_golden.sql on the lagging environment, then re-verify.",
    };

    console.log(JSON.stringify(report, null, 2));

    const exitFail =
      !match ||
      stagingReport.verdict?.rls_regression === "FAIL" ||
      productionReport.verdict?.rls_regression === "FAIL";
    process.exit(exitFail ? 1 : 0);
  }

  const config = loadEnvConfig();
  const report = await runEnvironmentAudit(config);

  console.log(JSON.stringify(report, null, 2));

  const fail =
    report.verdict?.golden_fulfillment === "NOT_APPLIED" ||
    report.verdict?.rls_regression === "FAIL";
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
