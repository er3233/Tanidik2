# TANIDIK Deployment Order

Database stabilization for restaurant ordering and courier fulfillment.  
**Single golden migration** — do not run legacy patch files on new environments.

---

## Phase 0 — Fulfillment (this document)

| Step | Action | Environment |
|------|--------|-------------|
| 0.1 | Run `sql/tanidik_fulfillment_golden.sql` | **Staging first**, then **Production** |
| 0.2 | Verify: `node scripts/verify-courier-migrations.mjs` | Both |
| 0.3 | Compare staging vs production (script `--compare`) | Both must match |

### Golden migration

**File:** [`sql/tanidik_fulfillment_golden.sql`](sql/tanidik_fulfillment_golden.sql)

- Idempotent (safe to re-run)
- Creates/updates: `orders`, `order_items`, `deliveries`, `couriers`, menus, RPCs, RLS, grants
- Records version in `public.schema_migrations` → `tanidik_fulfillment_golden_v1`

### Deprecated (superseded by golden — do not run on fresh deploy)

| Legacy file | Reason |
|-------------|--------|
| `restaurant_ordering_courier_mvp.sql` | Base tables + old statuses |
| `restaurant_courier_dispatch_mvp.sql` | Status vocabulary patch |
| `courier_deliveries_mvp.sql` | Pool RPC + venue_id columns |
| `courier_pool_hotfix.sql` | RLS recursion + pending→available |
| `courier_email_link_mvp.sql` | Email invite couriers |
| `courier_system_audit_fix.sql` | History + admin dispatch |
| `admin_upsert_courier_fix.sql` | Admin courier merge |
| `orders_customer_read_rpc.sql` | Customer order RPCs |
| `restaurant_ordering_security_grants.sql` | Grant cleanup |

Existing production that already ran legacy files: **only run golden** to converge schema.

---

## How to apply (Supabase SQL Editor)

1. Open project → **SQL Editor** → New query
2. Paste full contents of `sql/tanidik_fulfillment_golden.sql`
3. Run (expect ~5–30s depending on data backfill)
4. Confirm ledger row:

```sql
select id, applied_at, notes
from public.schema_migrations
where id = 'tanidik_fulfillment_golden_v1';
```

---

## Verification

```bash
# Production (default)
node scripts/verify-courier-migrations.mjs

# Staging
SUPABASE_URL=https://YOUR_STAGING.supabase.co \
SUPABASE_KEY=your_publishable_or_anon_key \
node scripts/verify-courier-migrations.mjs

# Compare staging vs production schema probes
node scripts/verify-courier-migrations.mjs --compare
```

**Pass criteria:**

- `verdict.golden_fulfillment` = `APPLIED`
- `verdict.rls_regression` = `PASS`
- `--compare`: `environments_match` = `true`

---

## Environment parity checklist

Run on **both** staging and production:

- [ ] `schema_migrations.tanidik_fulfillment_golden_v1` exists
- [ ] RPCs: `get_courier_delivery_pool`, `ensure_courier_delivery_for_order`, `resolve_my_active_courier`
- [ ] Columns: `deliveries.venue_id`, `couriers.email`
- [ ] No RLS infinite recursion on `deliveries` SELECT (42P17)
- [ ] `admin_upsert_courier` accepts email-only invite

---

## Phase 1B — Courier Operations Pack v1

| Step | Action |
|------|--------|
| 1B.1 | Run `sql/courier_operations_pack_v1.sql` after golden + realtime |
| 1B.2 | Smoke: `courier.html`, `admin-couriers.html`, `admin-deliveries.html`, `order-detail.html` |

---

## Phase 1A — Realtime operations

| Step | Action |
|------|--------|
| 1A.1 | After golden migration: run `sql/fulfillment_realtime_1a.sql` (staging → production) |
| 1A.2 | Supabase Dashboard → Database → Replication: confirm `orders`, `deliveries` enabled |
| 1A.3 | Smoke test: `restaurant-orders.html`, `courier.html`, `admin-deliveries.html` (two browsers) |

---

## Phase 1+ (other features)

Other SQL in `sql/` (reservations, messaging, store orders, venue photos, etc.) remains independent.  
Apply those per feature area; they are **not** included in the golden fulfillment migration.

Suggested order for full platform (reference only):

1. Core venue/business (already in base Supabase)
2. **Phase 0:** `tanidik_fulfillment_golden.sql`
3. Reservations: `reservation_rls_and_status_workflow.sql`, `create_reservation_with_capacity_check.sql`
4. Messaging: `direct_messaging.sql`, `message_*`
5. Store: `store_orders.sql`, `venue_products.sql`

---

## Rollback

Golden migration is additive/idempotent. There is no automatic down migration.

If a deploy fails mid-transaction, re-run the full golden file (wrapped in `BEGIN`/`COMMIT`).  
Do **not** drop fulfillment tables in production without a planned maintenance window.

---

## Support contacts / refs

- Verify script: [`scripts/verify-courier-migrations.mjs`](scripts/verify-courier-migrations.mjs)
- Production project ref: `gbzmqlamuimtiunofgxu` (configure staging via env vars)
