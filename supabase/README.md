# Supabase setup (Relaxo cloud sync)

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Prefer an **EU** region if most users are in Europe

## 2. Apply the SQL schema

If `npm` is broken in your shell, use `node` directly (same scripts).

### Schema health (no DB password)

```bash
node scripts/supabase-status.mjs
# or: npm run db:supabase:status
```

Uses `EXPO_PUBLIC_SUPABASE_URL` + publishable key only. Checks **all** sync tables and required columns (sleep settle fields, chores, day tags, etc.).

### Apply migrations from the CLI (for ongoing schema work)

Postgres is separate from the HTTPS app URL. Use the **Session pooler** (IPv4); `db.<ref>.supabase.co` often fails with `ENOTFOUND`.

**Option A — paste URI**

1. Supabase → **Project Settings → Database → Connect → Session mode**
2. Copy URI into `.env`:

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

**Option B — password + region**

```
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_DB_REGION=eu-central-1
```

Then:

```bash
node scripts/supabase-migrate.mjs --fresh   # empty project: full schema.sql
node scripts/supabase-migrate.mjs           # apply pending supabase/NNNN_*.sql
node scripts/supabase-new-migration.mjs add_short_name
```

### SQL Editor fallback (no npm / no DB URL)

1. **New project:** paste and run [`schema.sql`](./schema.sql) once.
2. **Existing project:** run any pending `NNNN_*.sql` files in numeric order (see table below).
3. Re-check: `node scripts/supabase-status.mjs`

### When you change the cloud schema

Local phone DB stays on Drizzle (`npm run db:generate` / `npx drizzle-kit generate`). Cloud changes are SQL files:

```bash
node scripts/supabase-new-migration.mjs add_short_name
# edit the new supabase/NNNN_….sql
# mirror the same change into supabase/schema.sql
node scripts/supabase-migrate.mjs
```

### Migration files

| File | Purpose |
|------|---------|
| [`schema.sql`](./schema.sql) | Full baseline for **new** projects (all sync tables, settle columns, preview pointer, realtime) |
| [`0011_sleep_insights.sql`](./0011_sleep_insights.sql) | Nap extension + day context tags |
| [`0012_task_reminders.sql`](./0012_task_reminders.sql) | Chore reminder minutes |
| [`0013_household_select_creator.sql`](./0013_household_select_creator.sql) | Creator can read household |
| [`0014_join_household_by_invite.sql`](./0014_join_household_by_invite.sql) | Partner join by invite code |
| [`0016_sync_prerequisites.sql`](./0016_sync_prerequisites.sql) | Chore completions + day tags safety |
| [`0017_latest_preview_build.sql`](./0017_latest_preview_build.sql) | Preview install pointer table |
| [`0018_safe_residual_patches.sql`](./0018_safe_residual_patches.sql) | Optional leftover column/RLS patches |
| [`0019_dedupe_sync_rows.sql`](./0019_dedupe_sync_rows.sql) | Soft-delete duplicate day tags / babies diagnostics |
| [`0020_dedupe_exact_events.sql`](./0020_dedupe_exact_events.sql) | Soft-delete exact duplicate care events |
| [`0021_sleep_context.sql`](./0021_sleep_context.sql) | `onset_method` / wake manner / mood |
| [`0022_realtime_household.sql`](./0022_realtime_household.sql) | Realtime publication for partner pull |
| [`0023_sleep_settle.sql`](./0023_sleep_settle.sql) | Settle minutes / quality / aid / place |
| [`0024_day_context_tags_partial_unique.sql`](./0024_day_context_tags_partial_unique.sql) | Live-only unique index for day tags |

Applied versions are stored in `public.relaxo_schema_migrations`.

**Tables the app syncs:** `babies`, `sleep_events`, `sleep_pauses`, `feeding_events`, `diaper_events`, `bath_events`, `wake_events`, `daily_chores`, `daily_chore_completions`, `day_context_tags` (+ auth: `households`, `household_members`, `profiles`).

Without `0014` / join RPC, a family member looking up an invite code always fails (RLS hides households until they are already a member).

## 3. Enable Sign in with Apple

1. Apple Developer → Certificates, Identifiers & Profiles  
   - App ID `com.joseoliv.relaxo` → enable **Sign In with Apple**  
   - Create a **Services ID** (e.g. `com.joseoliv.relaxo.auth`) if Supabase asks for OAuth secret  
   - Create a **Key** for Sign in with Apple and download the `.p8` (only once — keep it safe)
2. Generate the Supabase **Secret Key** JWT from your `.p8`:

```bash
node scripts/generate-apple-secret.mjs \
  --team-id=YOUR_TEAM_ID \
  --key-id=YOUR_KEY_ID \
  --client-id=com.joseoliv.relaxo.auth \
  --p8=/absolute/path/to/AuthKey_XXXXXX.p8
```

Paste the printed JWT into Supabase → **Authentication → Providers → Apple → Secret Key**.

3. Supabase → **Authentication → Providers → Apple** → enable  
   - **Client IDs**: `com.joseoliv.relaxo` (and Services ID if you created one)  
   - **Secret Key**: the JWT from the script above

Docs: [Supabase Apple login](https://docs.supabase.com/guides/auth/social-login/auth-apple)

## 4. App env

Copy `.env.example` → `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# For node scripts/supabase-migrate.mjs (pick one):
SUPABASE_DB_URL=postgresql://postgres.xxxx:…@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
# or: SUPABASE_DB_PASSWORD=…  and  SUPABASE_DB_REGION=eu-central-1
```

Get URL + publishable key from Supabase → **Project Settings → API**.  
For CLI migrations: **Database → Connect → Session mode** URI (or password + region).

Local `.env` is for Expo / these scripts only. **EAS cloud builds do not upload `.env`** — set the app keys as EAS project env vars.

Without the publishable keys, Settings shows “Cloud sync not configured” and hides Sign in with Apple.  
`SUPABASE_DB_URL` / `SUPABASE_DB_PASSWORD` stay on your machine only — never in the app binary.

## 5. Native rebuild (required)

Sign in with Apple needs a new native build (not OTA-only):

```bash
eas build --platform ios --profile preview
node scripts/sync-preview-build.mjs
eas update --channel preview
```

## How sync works

- Local SQLite stays primary (offline logging works)
- Sign in creates a **household** + **invite code**
- **Sync now** pushes local rows, then pulls household rows
- Partner device: Sign in → enter invite code → Sync now
- Realtime (0022 / schema) triggers a silent pull when the partner changes data

## Partner invite

Owner shares the 8-character invite code from Settings → Cloud sync.
