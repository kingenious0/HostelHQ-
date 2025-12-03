"use client";

import { z } from 'zod';

// Schema with versioning for forward-compatible migrations
export const settingsSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    theme: z.enum(["system","light","dark"]).default("system"),
    density: z.enum(["comfortable","compact"]).default("comfortable"),
    language: z.string().default("en"),
    dateFormat: z.string().default("auto"),
    numberFormat: z.string().default("auto"),
    fontScale: z.number().min(0.8).max(1.4).default(1),
    reducedMotion: z.boolean().default(false),
    highContrast: z.boolean().default(false),
    focusRing: z.enum(["default","strong","hidden"]).default("default"),
  }),
  notifications: z.object({
    enableToasts: z.boolean().default(true),
    marketing: z.boolean().default(false),
    product: z.boolean().default(true),
    security: z.boolean().default(true),
    quietHours: z.object({ start: z.string().default("22:00"), end: z.string().default("07:00") })
  }),
  privacy: z.object({
    requireReauth: z.boolean().default(true),
  }),
  data: z.object({
    lowDataMode: z.boolean().default(false),
    prefetchOnWifi: z.boolean().default(true),
    firestorePersistence: z.boolean().default(true),
    imageCacheTtlHours: z.number().min(1).max(168).default(24),
    avatarMaxKB: z.number().min(50).max(1024).default(200),
  }),
  advanced: z.object({
    developerMode: z.boolean().default(false),
    featureFlagsPreview: z.boolean().default(false),
  })
});

export type ClientSettings = z.infer<typeof settingsSchema>;

const STORAGE_KEY = "hostelhq:settings";

const defaultSettings: ClientSettings = {
  version: 1,
  profile: { theme: "system", density: "comfortable", language: "en", dateFormat: "auto", numberFormat: "auto", fontScale: 1, reducedMotion: false, highContrast: false, focusRing: "default" },
  notifications: { enableToasts: true, marketing: false, product: true, security: true, quietHours: { start: "22:00", end: "07:00" } },
  privacy: { requireReauth: true },
  data: { lowDataMode: false, prefetchOnWifi: true, firestorePersistence: true, imageCacheTtlHours: 24, avatarMaxKB: 200 },
  advanced: { developerMode: false, featureFlagsPreview: false }
};

function safeParse(json: string | null): ClientSettings | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const result = settingsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function loadSettings(): ClientSettings {
  if (typeof window === 'undefined') return defaultSettings;
  const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
  if (!storage || typeof storage.getItem !== 'function') return defaultSettings;
  const existing = safeParse(storage.getItem(STORAGE_KEY));
  if (existing) return existing;
  storage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
  return defaultSettings;
}

export function saveSettings(next: ClientSettings) {
  if (typeof window === 'undefined') return;
  const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
  if (!storage || typeof storage.setItem !== 'function') return;
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function exportSettings(): string {
  return JSON.stringify(loadSettings());
}

export function importSettings(json: string): { ok: boolean; error?: string } {
  const data = safeParse(json);
  if (!data) return { ok: false, error: 'Invalid settings file' };
  saveSettings(data);
  return { ok: true };
}

export function clearLocalData() {
  if (typeof window === 'undefined') return;
  try {
    // Clear app-specific keys; avoid wiping unrelated site storage
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (storage && typeof storage.removeItem === 'function') {
      storage.removeItem(STORAGE_KEY);
    }
    // Clear Firestore persistence caches if present
    indexedDB?.deleteDatabase('firebase-firestore-database');
  } catch {}
}


