export const LANGUAGE_STORAGE_KEY = 'codeomnivis-lang'
export type SupportedLanguage = 'zh-CN' | 'en-US'

interface ReadableStorage {
  getItem: (key: string) => string | null
}

interface WritableStorage {
  setItem: (key: string, value: string) => void
}

export function readStoredLanguage(storage?: ReadableStorage): SupportedLanguage {
  try {
    return storage?.getItem(LANGUAGE_STORAGE_KEY) === 'zh-CN' ? 'zh-CN' : 'en-US'
  } catch {
    return 'en-US'
  }
}

export function persistLanguage(
  storage: WritableStorage | undefined,
  language: SupportedLanguage,
): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Persistence is optional; the active i18n instance still changes language.
  }
}

export function readBrowserLanguage(): SupportedLanguage {
  return readStoredLanguage(typeof localStorage === 'undefined' ? undefined : localStorage)
}

export function persistBrowserLanguage(language: SupportedLanguage): void {
  persistLanguage(typeof localStorage === 'undefined' ? undefined : localStorage, language)
}
