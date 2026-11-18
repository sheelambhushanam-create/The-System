import type { AllergyTag } from '../types/system';

export interface CodexRecipeItem {
  name: string;
  costInr: number;
  macros: [number, number, number, number];
  ingredients: string;
  steps: string;
  tag: 'Eggetarian' | 'Veg' | 'Female' | 'Omnivore';
  allergenTags: AllergyTag[];
}

export interface ClinicalCodex {
  version: string;
  updatedAt: string;
  guidelines: {
    proteinPerKgStandard: number;
    proteinPerKgPcos: number;
    mastersLeucineAge: number;
    mastersProteinMultiplier: number;
    rpeTargetDefault: number;
    defaultRestSec: number;
    metabolicRestSec: number;
    sources: string[];
  };
  contraindicationsNote: string;
  recipes: CodexRecipeItem[];
}

const VALID_ALLERGY_TAGS: AllergyTag[] = [
  'dairy_lactose',
  'soy',
  'gluten_wheat',
  'eggs',
  'peanuts_nuts',
  'lentils_beans',
];

export const DEFAULT_CLINICAL_CODEX: ClinicalCodex = {
  version: '1.0.0',
  updatedAt: '2026-11-17',
  guidelines: {
    proteinPerKgStandard: 1.8,
    proteinPerKgPcos: 1.9,
    mastersLeucineAge: 40,
    mastersProteinMultiplier: 1.1,
    rpeTargetDefault: 8,
    defaultRestSec: 60,
    metabolicRestSec: 45,
    sources: [
      'ISSN Position Stand: Protein & Exercise',
      'ACSM Resistance Training Progression Models',
      'Mifflin-St Jeor Resting Metabolic Rate Equation',
    ],
  },
  contraindicationsNote:
    'Offline-first ACSM & ISSN clinical baseline active: maternal T2/T3 supine swaps and +2.5 kg progressive overload rules enforced locally.',
  recipes: [],
};

const CODEX_LS_KEY = 'thesystem_clinical_codex_v1';
const CODEX_IDB_NAME = 'thesystem_codex_db';
const CODEX_IDB_STORE = 'codex_store';
const CODEX_IDB_KEY = 'latest';

export function validateCodexPayload(raw: unknown): ClinicalCodex | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<ClinicalCodex>;
  if (typeof obj.version !== 'string' || !obj.version.trim()) return null;
  if (!obj.guidelines || typeof obj.guidelines !== 'object') return null;

  const g = obj.guidelines;
  if (
    typeof g.proteinPerKgStandard !== 'number' ||
    g.proteinPerKgStandard < 1.0 ||
    g.proteinPerKgStandard > 3.0 ||
    typeof g.rpeTargetDefault !== 'number' ||
    g.rpeTargetDefault < 5 ||
    g.rpeTargetDefault > 10 ||
    typeof g.defaultRestSec !== 'number' ||
    g.defaultRestSec < 15
  ) {
    return null;
  }

  const rawRecipes = Array.isArray(obj.recipes) ? obj.recipes : [];
  const cleanRecipes: CodexRecipeItem[] = [];
  for (const r of rawRecipes) {
    if (!r || typeof r !== 'object') continue;
    const item = r as Partial<CodexRecipeItem>;
    if (
      typeof item.name === 'string' &&
      typeof item.costInr === 'number' &&
      Array.isArray(item.macros) &&
      item.macros.length === 4 &&
      item.macros.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      typeof item.ingredients === 'string' &&
      typeof item.steps === 'string'
    ) {
      const safeTags = Array.isArray(item.allergenTags)
        ? item.allergenTags.filter((t): t is AllergyTag => VALID_ALLERGY_TAGS.includes(t))
        : [];
      cleanRecipes.push({
        name: item.name,
        costInr: item.costInr,
        macros: [item.macros[0], item.macros[1], item.macros[2], item.macros[3]],
        ingredients: item.ingredients,
        steps: item.steps,
        tag:
          item.tag === 'Eggetarian' ||
          item.tag === 'Female' ||
          item.tag === 'Omnivore'
            ? item.tag
            : 'Veg',
        allergenTags: safeTags,
      });
    }
  }

  return {
    version: obj.version.trim(),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString().slice(0, 10),
    guidelines: {
      proteinPerKgStandard: g.proteinPerKgStandard,
      proteinPerKgPcos: typeof g.proteinPerKgPcos === 'number' ? g.proteinPerKgPcos : 1.9,
      mastersLeucineAge: typeof g.mastersLeucineAge === 'number' ? g.mastersLeucineAge : 40,
      mastersProteinMultiplier:
        typeof g.mastersProteinMultiplier === 'number' ? g.mastersProteinMultiplier : 1.1,
      rpeTargetDefault: g.rpeTargetDefault,
      defaultRestSec: g.defaultRestSec,
      metabolicRestSec: typeof g.metabolicRestSec === 'number' ? g.metabolicRestSec : 45,
      sources: Array.isArray(g.sources)
        ? g.sources.filter((s): s is string => typeof s === 'string')
        : DEFAULT_CLINICAL_CODEX.guidelines.sources,
    },
    contraindicationsNote:
      typeof obj.contraindicationsNote === 'string'
        ? obj.contraindicationsNote
        : DEFAULT_CLINICAL_CODEX.contraindicationsNote,
    recipes: cleanRecipes,
  };
}

function readLocalStorageCodex(): ClinicalCodex | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CODEX_LS_KEY);
    if (!raw) return null;
    return validateCodexPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStorageCodex(codex: ClinicalCodex): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CODEX_LS_KEY, JSON.stringify(codex));
  } catch {
    // Ignore storage quota errors
  }
}

function openCodexDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CODEX_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CODEX_IDB_STORE)) {
          db.createObjectStore(CODEX_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadCachedCodex(): Promise<ClinicalCodex> {
  const lsCached = readLocalStorageCodex();
  const db = await openCodexDb();
  if (!db) {
    return lsCached || DEFAULT_CLINICAL_CODEX;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CODEX_IDB_STORE, 'readonly');
      const req = tx.objectStore(CODEX_IDB_STORE).get(CODEX_IDB_KEY);
      req.onsuccess = () => {
        const valid = validateCodexPayload(req.result);
        db.close();
        resolve(valid || lsCached || DEFAULT_CLINICAL_CODEX);
      };
      req.onerror = () => {
        db.close();
        resolve(lsCached || DEFAULT_CLINICAL_CODEX);
      };
    } catch {
      db.close();
      resolve(lsCached || DEFAULT_CLINICAL_CODEX);
    }
  });
}

export async function saveCodexToCache(codex: ClinicalCodex): Promise<void> {
  writeLocalStorageCodex(codex);
  const db = await openCodexDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CODEX_IDB_STORE, 'readwrite');
      tx.objectStore(CODEX_IDB_STORE).put(codex, CODEX_IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function syncClinicalCodex(
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
  endpoint = '/codex/v1.json'
): Promise<{ codex: ClinicalCodex; source: 'remote' | 'cache' | 'fallback' }> {
  const cached = await loadCachedCodex();
  const hasRealCache = cached.version !== DEFAULT_CLINICAL_CODEX.version || cached.recipes.length > 0;

  if (!fetchImpl) {
    return { codex: cached, source: hasRealCache ? 'cache' : 'fallback' };
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), 3000)
        : null;

    const resp = await fetchImpl(endpoint, {
      cache: 'no-cache',
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!resp || !resp.ok) {
      return { codex: cached, source: hasRealCache ? 'cache' : 'fallback' };
    }

    const json = await resp.json();
    const validated = validateCodexPayload(json);
    if (!validated) {
      return { codex: cached, source: hasRealCache ? 'cache' : 'fallback' };
    }

    await saveCodexToCache(validated);
    return { codex: validated, source: 'remote' };
  } catch {
    return { codex: cached, source: hasRealCache ? 'cache' : 'fallback' };
  }
}
