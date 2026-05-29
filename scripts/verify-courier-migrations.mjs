/**
 * Probes Supabase REST for courier migration artifacts.
 * Run: node scripts/verify-courier-migrations.mjs
 */
const SUPABASE_URL = "https://gbzmqlamuimtiunofgxu.supabase.co";
const SUPABASE_KEY =
  "sb_publishable_RWnWRlA_Do1Yb4N9uibZkA_nr1RMx7f";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

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

async function probeRpc(name, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const text = await res.text();
  return { http: res.status, ...rpcExistsFromResponse(res.status, text) };
}

async function probeSelect(table, selectCols) {
  const q = encodeURIComponent(selectCols);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${q}&limit=0`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const text = await res.text();
  const lower = text.toLowerCase();
  if (lower.includes("column") && lower.includes("does not exist")) {
    return { exists: false, http: res.status, note: text.slice(0, 220) };
  }
  if (res.ok) return { exists: true, http: res.status, note: "ok" };
  return { exists: true, http: res.status, note: text.slice(0, 220) };
}

async function probeSelectRows(table, selectCols, filters = "") {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(selectCols)}${filters}&limit=5`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const text = await res.text();
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

async function main() {
  const courierDeliveries = {
    deliveries_venue_id: await probeSelect("deliveries", "venue_id"),
    deliveries_business_owner_id: await probeSelect(
      "deliveries",
      "business_owner_id"
    ),
    rpc_get_courier_delivery_pool: await probeRpc("get_courier_delivery_pool"),
    rpc_accept_courier_delivery: await probeRpc("accept_courier_delivery", {
      p_delivery_id: "00000000-0000-0000-0000-000000000001",
    }),
    rpc_update_courier_delivery_status: await probeRpc(
      "update_courier_delivery_status",
      {
        p_delivery_id: "00000000-0000-0000-0000-000000000001",
        p_new_status: "picked_up",
      }
    ),
    rpc_ensure_courier_delivery_for_order: await probeRpc(
      "ensure_courier_delivery_for_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
  };

  const courierEmail = {
    couriers_email: await probeSelect("couriers", "email"),
    couriers_user_id_nullable: await probeSelect("couriers", "user_id"),
    rpc_resolve_my_active_courier: await probeRpc("resolve_my_active_courier"),
    rpc_admin_upsert_courier: await probeRpc("admin_upsert_courier", {
      p_email: "migration-probe@tanidik.invalid",
      p_full_name: "Migration Probe",
      p_user_id: null,
      p_status: "inactive",
    }),
  };

  const auditFix = {
    rpc_get_courier_delivery_history: await probeRpc(
      "get_courier_delivery_history",
      { p_limit: 1 }
    ),
    rpc_admin_assign_courier_delivery: await probeRpc(
      "admin_assign_courier_delivery",
      {
        p_delivery_id: "00000000-0000-0000-0000-000000000001",
        p_courier_id: "00000000-0000-0000-0000-000000000001",
      }
    ),
    rpc_get_admin_delivery_dispatch_board: await probeRpc(
      "get_admin_delivery_dispatch_board"
    ),
  };

  const legacy = {
    rpc_accept_delivery: await probeRpc("accept_delivery", {
      p_delivery_id: "00000000-0000-0000-0000-000000000001",
    }),
    rpc_update_delivery_status: await probeRpc("update_delivery_status", {
      p_delivery_id: "00000000-0000-0000-0000-000000000001",
      p_new_status: "picked_up",
    }),
    rpc_ensure_open_delivery_for_order: await probeRpc(
      "ensure_open_delivery_for_order",
      { p_order_id: "00000000-0000-0000-0000-000000000001" }
    ),
    rpc_update_restaurant_order_status: await probeRpc(
      "update_restaurant_order_status",
      {
        p_order_id: "00000000-0000-0000-0000-000000000001",
        p_new_status: "accepted",
      }
    ),
    rpc_get_my_restaurant_orders: await probeRpc("get_my_restaurant_orders"),
    deliveries_status_open: await probeSelectRows(
      "deliveries",
      "id,status,courier_id,order_id",
      "&status=in.(open,available,pending)&courier_id=is.null"
    ),
  };

  const report = {
    project: "gbzmqlamuimtiunofgxu",
    url: SUPABASE_URL,
    timestamp: new Date().toISOString(),
    verdict: {
      courier_deliveries_mvp: migrationVerdict(courierDeliveries),
      courier_email_link_mvp: migrationVerdict(courierEmail),
      courier_system_audit_fix: migrationVerdict(auditFix),
    },
    migrations: {
      courier_deliveries_mvp: courierDeliveries,
      courier_email_link_mvp: courierEmail,
      courier_system_audit_fix: auditFix,
      legacy_baseline: legacy,
    },
    e2e: {
      note: "Full E2E requires authenticated test accounts; anon probes only.",
      anon_couriers_visible: await probeSelectRows(
        "couriers",
        "id,email,user_id,status"
      ),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
