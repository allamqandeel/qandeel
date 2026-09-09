// T-12P §2.3 — the ONE build-time boundary where environment variables become mobile config.
//
// `app.json` stays the static identity of the app and is untouched. This file only adds `extra`,
// which Expo embeds in the built bundle and `expo-constants` reads back at runtime. Runtime
// Product code never reads `process.env`: it consumes the validated `MobilePublicConfig` built
// from these values by `src/runtime-entry/config/mobile-public-config.ts`.
//
// EVERYTHING PLACED IN `extra` SHIPS INSIDE THE APP BUNDLE AND IS READABLE BY ANYONE WHO HAS THE
// BINARY. Only public facts belong here: the API origin, the Supabase project URL and the
// Supabase publishable key (which Supabase documents as safe to expose because Row Level Security,
// not the key, is the boundary). A Supabase secret key, a provider key, a database password or any
// other private credential must never appear here or anywhere else in this workspace.
//
// Missing values stay `null` on purpose. A build with no configuration produces a bundle that
// fails closed at runtime with a typed error naming the missing keys, rather than a bundle that
// silently points at the wrong backend.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    /** Origin plus any base path of the QANDEEL API, without a trailing slash. */
    qandeelApiBaseUrl: process.env.QANDEEL_API_BASE_URL ?? null,
    /** The Supabase project URL, without a trailing slash. */
    supabaseUrl: process.env.QANDEEL_SUPABASE_URL ?? null,
    /** The Supabase PUBLISHABLE key. Never the secret key. */
    supabasePublishableKey: process.env.QANDEEL_SUPABASE_PUBLIC_KEY ?? null,
  },
});
