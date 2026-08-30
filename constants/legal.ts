/**
 * Store / support / legal configuration.
 * Pattern matches Lineup HQ: product Privacy/Terms in-app (or on product domain),
 * controller + Impressum on Nexorumo (https://nexorumo.com/impressum).
 *
 * Contact email matches Nexorumo Impressum source of truth.
 * When you host public product pages, set PRIVACY_URL / TERMS_URL.
 */
export const COMPANY_NAME = 'Nexorumo';
export const COMPANY_URL = 'https://nexorumo.com';
export const IMPRESSUM_URL = 'https://nexorumo.com/impressum';

/** Same inbox as nexorumo.com/impressum */
export const SUPPORT_EMAIL = 'nexorumo@protonmail.com';
export const SUPPORT_SUBJECT = 'Relaxo support';
export const PRIVACY_EMAIL = 'nexorumo@protonmail.com';

/**
 * Public HTTPS URLs for App Store Connect / “Open in browser”.
 * Host `docs/legal/privacy-policy.md` and `docs/legal/terms-of-use.md` on
 * nexorumo.com (site /privacy and /terms are website-only, not Relaxo).
 * Until then, in-app screens at /legal/* remain the source of truth.
 */
export const PRIVACY_URL = '';
export const TERMS_URL = '';

export function supportMailtoUrl(): string {
  const subject = encodeURIComponent(SUPPORT_SUBJECT);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
}
