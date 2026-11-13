import type { PickerOptions } from "./types.ts";
import { decodeOptions, emptyOptions } from "./validation.ts";
import { LEGACY_KEYS, OPTIONS_KEY, migrateLegacy, parseJson, serializeOptions } from "./storageMigration.ts";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadedOptions = { options: PickerOptions; warning: string | null; needsMigration: boolean };
export type OptionsStorage = ReturnType<typeof createOptionsStorage>;
type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Storage access is injected because browser permissions can reject even the property getter. */
export function createOptionsStorage(access: () => KeyValueStorage) {
  /** A read never writes or removes keys. The caller decides when to commit migration. */
  function load(): LoadedOptions {
    try {
      const storage = access();
      const raw = storage.getItem(OPTIONS_KEY);
      if (raw !== null) {
        const decoded = decodeOptions(parseJson(raw));
        return {
          options: decoded?.options ?? emptyOptions(),
          warning: !decoded || decoded.damaged ? "Some saved data could not be restored. Import the affected list again." : null,
          needsMigration: false,
        };
      }
      const legacy = LEGACY_KEYS.map(key => storage.getItem(key));
      return { options: migrateLegacy(legacy), warning: null, needsMigration: legacy.some(value => value !== null) };
    } catch {
      return { options: emptyOptions(), warning: "Browser storage is unavailable. Changes cannot be saved.", needsMigration: false };
    }
  }

  /** A failed write preserves existing data; obsolete-key cleanup is best effort after commit. */
  function save(options: PickerOptions): SaveResult {
    try {
      const storage = access();
      storage.setItem(OPTIONS_KEY, serializeOptions(options));
      for (const key of LEGACY_KEYS) {
        try { storage.removeItem(key); } catch { /* The unified record already wins on subsequent reads. */ }
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not save changes. Browser storage may be blocked or full." };
    }
  }

  /** Commit legacy conversion once at startup, before React starts rendering. */
  function initialize(): LoadedOptions {
    const loaded = load();
    if (!loaded.needsMigration) return loaded;
    const result = save(loaded.options);
    return { ...loaded, needsMigration: !result.ok, warning: result.ok ? loaded.warning : result.error };
  }

  return { load, save, initialize };
}
