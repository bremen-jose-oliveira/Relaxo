# Supabase setup (Relaxo cloud sync)

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Prefer an **EU** region if most users are in Europe

## 2. Apply the SQL schema

### Schema health (no DB password)

```bash
npm run db:supabase:status
```

Uses `EXPO_PUBLIC_SUPABASE_URL` + publishable key only.

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

(`SUPABASE_DB_REGION` is the middle part of the pooler host: `aws-0-<region>.pooler.supabase.com`. Password is set at project creation; reset it in Database settings if forgotten.)

Then:

```bash
npm run db:supabase:fresh    # empty project: full schema.sql
npm run db:supabase          # apply pending supabase/NNNN_*.sql
npm run db:supabase:new -- add_short_name   # scaffold next change
```

### SQL Editor fallback

Paste and run `supabase/schema.sql`, then any pending `supabase/NNNN_*.sql` files in order.

### When you change the cloud schema

Local phone DB stays on Drizzle (`npm run db:generate`). Cloud changes are SQL files:

```bash
npm run db:supabase:new -- add_short_name
# edit the new supabase/NNNN_….sql
# mirror the same change into supabase/schema.sql
npm run db:supabase
```

### Migration files

| File | Purpose |
|------|---------|
| [`schema.sql`](./schema.sql) | Full baseline for **new** projects (`db:supabase:fresh`) |
| [`0011_sleep_insights.sql`](./0011_sleep_insights.sql) | Nap extension + day context tags |
| [`0012_task_reminders.sql`](./0012_task_reminders.sql) | Chore reminder minutes |
| [`0013_household_select_creator.sql`](./0013_household_select_creator.sql) | Creator can read household |
| [`0014_join_household_by_invite.sql`](./0014_join_household_by_invite.sql) | Partner join by invite code + ensure `sleep_events` |

Applied versions are stored in `public.relaxo_schema_migrations`.

Without `0014`, a family member looking up an invite code always fails (RLS hides households until they are already a member), and sync may error if `sleep_events` was never created.

## 3. Enable Sign in with Apple

1. Apple Developer → Certificates, Identifiers & Profiles  
   - App ID `com.joseoliv.relaxo` → enable **Sign In with Apple**  
   - Create a **Services ID** (e.g. `com.joseoliv.relaxo.auth`) if Supabase asks for OAuth secret  
   - Create a **Key** for Sign in with Apple and download the `.p8` (only once — keep it safe)
2. Generate the Supabase **Secret Key** JWT from your `.p8` (local script — no dashboard generator needed):

```bash
npm run generate:apple-secret -- \
  --team-id=YOUR_TEAM_ID \
  --key-id=YOUR_KEY_ID \
  --client-id=com.joseoliv.relaxo.auth \
  --p8=/absolute/path/to/AuthKey_XXXXXX.p8
```

Paste the printed JWT into Supabase → **Authentication → Providers → Apple → Secret Key**.

3. Supabase → **Authentication → Providers → Apple** → enable  
   - **Client IDs**: `com.joseoliv.relaxo` (and Services ID if you created one)  
   - **Secret Key**: the JWT from the script above

Docs: [Supabase Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple)

## 4. App env

Copy `.env.example` → `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# For npm run db:supabase (pick one):
SUPABASE_DB_URL=postgresql://postgres.xxxx:…@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
# or: SUPABASE_DB_PASSWORD=…  and  SUPABASE_DB_REGION=eu-central-1
```

Get URL + publishable key from Supabase → **Project Settings → API**.  
For CLI migrations: **Database → Connect → Session mode** URI (or password + region).

Local `.env` is for `npx expo start` and `npm run db:supabase` only. **EAS cloud builds do not upload `.env`** — set the app keys as EAS project env vars (preview / production / development), e.g.:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --environment preview --visibility plaintext --non-interactive
eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..." --environment preview --visibility sensitive --non-interactive
```

Without the publishable keys, Profile shows “Cloud sync not configured” and hides Sign in with Apple.  
`SUPABASE_DB_URL` / `SUPABASE_DB_PASSWORD` stay on your machine only — never in the app binary.

## 5. Native rebuild (required)

Sign in with Apple needs a new native build (not OTA-only):

```bash
eas build --platform ios --profile preview
npm run sync:preview-build
eas update --channel preview
```

## How sync works

- Local SQLite stays primary (offline logging works)
- Sign in creates a **household** + **invite code**
- **Sync now** pushes local rows, then pulls household rows
- Partner device: Sign in → enter invite code → Sync now

## Partner invite

Owner shares the 8-character invite code from Profile → Cloud sync.
