# Supabase setup (Relaxo cloud sync)

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Prefer an **EU** region if most users are in Europe

## 2. Run the SQL schema

In Supabase → **SQL Editor**, paste and run:

`supabase/schema.sql`

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
```

Get both from Supabase → **Project Settings → API** (use the **Publishable** key; not the Secret key).

Local `.env` is for `npx expo start` only. **EAS cloud builds do not upload `.env`** — set the same keys as EAS project env vars (preview / production / development), e.g.:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --environment preview --visibility plaintext --non-interactive
eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..." --environment preview --visibility sensitive --non-interactive
```

Without those, Profile shows “Cloud sync not configured” and hides Sign in with Apple.

If the project already ran an older `schema.sql`, also run [`0011_sleep_insights.sql`](./0011_sleep_insights.sql) (nap extension + day context tags).

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
