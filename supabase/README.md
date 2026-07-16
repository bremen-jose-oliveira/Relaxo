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
   - Create a **Services ID** (for web/OAuth if needed) and a **Key** for Apple Sign In  
2. Supabase → **Authentication → Providers → Apple** → enable  
   - Client IDs: include your iOS bundle id `com.joseoliv.relaxo`  
   - Secret: JWT generated from your Apple key (see [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple))

## 4. App env

Copy `.env.example` → `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Get both from Supabase → **Project Settings → API** (use the **Publishable** key; not the Secret key).

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
