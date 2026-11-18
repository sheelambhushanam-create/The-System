import React, { useEffect, useRef, useState } from 'react';
import {
  Leaf,
  Mic,
  MicOff,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import {
  ALLERGY_OPTIONS,
  FOODS,
  RECIPES,
  SANCTUARY_PRACTICES,
  getDailyChefRecommendation,
  getMacroSubstitutions,
  getSafeFallbackCombos,
  getSafeFoods,
  getSafeRecipes,
  isComboSafe,
  type RecipeItem,
} from '../data/foods';
import type { AppState, LoggedFood, StatKey } from '../types/system';
import { computeMicronutrients } from '../utils/clinical';
import {
  calculateMacros,
  getCyclePhaseInsight,
  getProgramDayNumber,
  isFemaleProfile,
  isMaternalProfile,
  sumDailyMacros,
} from '../utils/metabolic';
import { THEME_COPY, todayISO } from '../utils/storage';
import { ProgressBar } from './ProgressBar';

function capitalizeStep(text: string): string {
  const cleaned = text.replace(/^[.;\s]+|[.;\s]+$/g, '').trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function splitRecipePrepSteps(ingredients: string, steps: string): string[] {
  const sentences = steps
    .split(/[.;]\s+/)
    .map(capitalizeStep)
    .filter(Boolean);
  const stepTwo = sentences[0] || capitalizeStep(steps);
  const stepThree =
    sentences.length > 1
      ? sentences.slice(1).join('. ')
      : 'Serve warm with water or lemon to support mineral absorption.';
  return [capitalizeStep(ingredients), stepTwo, stepThree];
}

interface NutritionViewProps {
  state: AppState;
  codexRecipes?: RecipeItem[];
  onLogFood: (item: LoggedFood) => void;
  onQuickLogText: (raw: string) => void;
  onDeleteLoggedFood: (idx: number) => void;
  onLogCombo: (comboIdx: number) => void;
  onLogQuickFallbackCombo: (items: Array<[string, number]>, comboName: string) => void;
  onSaveCurrentAsCombo: (name: string) => void;
  onOpenGroceryList: () => void;
  onLogWater: (delta: number) => void;
  onCompleteSanctuary: (idx: number, title: string, stat: StatKey) => void;
  onCreateCustomSanctuary: (name: string) => void;
}

export const NutritionView: React.FC<NutritionViewProps> = ({
  state,
  codexRecipes = [],
  onLogFood,
  onQuickLogText,
  onDeleteLoggedFood,
  onLogCombo,
  onLogQuickFallbackCombo,
  onSaveCurrentAsCombo,
  onOpenGroceryList,
  onLogWater,
  onCompleteSanctuary,
  onCreateCustomSanctuary,
}) => {
  const dateStr = todayISO();
  const copy = THEME_COPY[state.theme];
  const macros = calculateMacros(state.p);
  const logged = state.log[dateStr] || [];
  const totals = sumDailyMacros(logged);
  const maternal = isMaternalProfile(state.p);
  const isClean = state.theme === 'clean';
  const showWomenGuidance = state.theme === 'women' || isFemaleProfile(state.p);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const cycleInsight = getCyclePhaseInsight(dayNum, state.p);
  const micros = computeMicronutrients(logged, state.p);
  const waterLitres = Number(state.water[dateStr] || 0);
  const energyUnit = isClean ? 'kcal' : 'cal';
  const allergies = state.p.allergies || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodKcal, setCustomFoodKcal] = useState('');
  const [customFoodProt, setCustomFoodProt] = useState('');
  const [comboNameInput, setComboNameInput] = useState('');
  const [showComboSave, setShowComboSave] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'cheap' | 'pro'>('all');
  const [customSanctName, setCustomSanctName] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceIsError, setVoiceIsError] = useState(false);

  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const latestTranscriptRef = useRef('');
  const voiceLoggedRef = useRef(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const handleToggleVoiceLog = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    type SpeechRecognitionResultItem = {
      isFinal?: boolean;
      0?: { transcript?: string };
    };
    type SpeechRecognitionEventLike = {
      results: ArrayLike<SpeechRecognitionResultItem>;
    };
    type SpeechRecognitionInstance = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      abort: () => void;
      onstart: (() => void) | null;
      onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
      onerror: ((ev: { error?: string }) => void) | null;
      onend: (() => void) | null;
    };

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceIsError(true);
      setVoiceFeedback('Voice input is not supported in this browser — type your meal instead.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      latestTranscriptRef.current = '';
      voiceLoggedRef.current = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceIsError(false);
        setVoiceFeedback('Listening… say e.g. "2 chapati and dal"');
      };

      recognition.onresult = (event) => {
        let combined = '';
        let hasFinal = false;
        for (let i = 0; i < event.results.length; i += 1) {
          const res = event.results[i];
          const text = res?.[0]?.transcript || '';
          combined += text;
          if (res?.isFinal) hasFinal = true;
        }
        const cleaned = combined.trim();
        if (!cleaned) return;
        latestTranscriptRef.current = cleaned;
        setSearchTerm(cleaned);

        if (hasFinal && !voiceLoggedRef.current) {
          voiceLoggedRef.current = true;
          onQuickLogText(cleaned);
          setSearchTerm('');
          setVoiceIsError(false);
          setVoiceFeedback(`Heard "${cleaned}"`);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setVoiceIsError(true);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceFeedback('Microphone access was denied. Allow mic permission or type your meal.');
        } else if (event.error === 'no-speech') {
          setVoiceFeedback('No speech detected — tap the mic and try again.');
        } else {
          setVoiceFeedback('Voice capture could not complete — try again or type your meal.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        const leftover = latestTranscriptRef.current.trim();
        if (leftover && !voiceLoggedRef.current) {
          voiceLoggedRef.current = true;
          onQuickLogText(leftover);
          setSearchTerm('');
          setVoiceIsError(false);
          setVoiceFeedback(`Heard "${leftover}"`);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceIsError(true);
      setVoiceFeedback('Could not start voice recognition — type your meal instead.');
    }
  };

  const safeFoods = getSafeFoods(allergies, FOODS);
  const filteredFoods = safeFoods.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const safeRecipes = getSafeRecipes([...RECIPES, ...codexRecipes], allergies, {
    isFemaleOrWomen: isFemaleProfile(state.p) || state.theme === 'women',
    diet: state.p.diet,
  });

  const visibleRecipes = safeRecipes.filter((r) => {
    if (recipeFilter === 'cheap') return r.costInr <= 30;
    if (recipeFilter === 'pro') return r.macros[1] >= 18;
    return true;
  });

  const remKcal = Math.max(0, macros.t - Math.round(totals.k));
  const proteinGap = Math.max(0, macros.pr - Math.round(totals.p));
  const dailyChefPick = getDailyChefRecommendation(safeRecipes, remKcal, proteinGap, dateStr);
  const macroSubstitutions = getMacroSubstitutions(allergies, proteinGap);
  const safeUserCombos = state.combos
    .map((cb, origIdx) => ({ cb, origIdx }))
    .filter(({ cb }) => isComboSafe(cb, allergies, FOODS));
  const safeFallbackCombos = safeUserCombos.length === 0 ? getSafeFallbackCombos(allergies, state.p.diet) : [];
  const activeAllergyLabels = ALLERGY_OPTIONS.filter((o) => allergies.includes(o.id)).map((o) => o.label);

  const allSanctuary: Array<[string, string, StatKey]> = [
    ...SANCTUARY_PRACTICES,
    ...state.customSanctuary,
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Macro Dashboard, Quick Parser, Catalog & Today's Log */}
      <div className="space-y-6 lg:col-span-7">
        {/* Macro Summary Card */}
        <div className="sys-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold">{copy.nutritionTitle}</h1>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                {macros.modeNote}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenGroceryList}
              className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>7-Day Grocery List</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: 'Energy Target', val: totals.k, max: macros.t, unit: energyUnit, overDanger: !maternal },
              { label: 'Protein', val: totals.p, max: macros.pr, unit: 'g', overDanger: false },
              { label: 'Carbohydrates', val: totals.c, max: macros.c, unit: 'g', overDanger: false },
              { label: 'Fats', val: totals.f, max: macros.f, unit: 'g', overDanger: false },
            ].map((m) => {
              const over = m.overDanger && m.val > m.max;
              const pct = Math.min(100, Math.round((m.val / Math.max(1, m.max)) * 100));
              return (
                <div key={m.label} className="sys-card-nested p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{m.label}</span>
                    <span className="font-mono-num" style={{ color: 'var(--sys-muted)' }}>
                      {Math.round(m.val)} / {m.max} {m.unit} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={m.val}
                      max={m.max}
                      tone={over ? 'danger' : 'secondary'}
                      label={m.label}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cellular Micronutrient Precision + Hydration Buffer */}
          <div
            className="mt-4 border-t pt-4"
            style={{ borderColor: 'var(--sys-border)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold">Cellular Micronutrient Precision</div>
              <button
                type="button"
                onClick={() => onLogWater(0.25)}
                className="sys-btn-secondary font-mono-num min-h-[34px] px-3 text-xs font-semibold"
              >
                +250 ml Hydration ({waterLitres.toFixed(2)} L)
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                {
                  label: 'Bioavailable Iron',
                  val: micros.ironMg,
                  max: micros.ironTargetMg,
                  unit: 'mg',
                  pct: micros.ironPct,
                },
                {
                  label: 'Magnesium',
                  val: micros.magnesiumMg,
                  max: micros.magnesiumTargetMg,
                  unit: 'mg',
                  pct: micros.magnesiumPct,
                },
                {
                  label: 'Methyl-Folate',
                  val: micros.folateMcg,
                  max: micros.folateTargetMcg,
                  unit: 'mcg',
                  pct: micros.folatePct,
                },
              ].map((micro) => (
                <div key={micro.label} className="sys-card-nested p-2.5">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-semibold">{micro.label}</span>
                    <span className="font-mono-num" style={{ color: 'var(--sys-primary)' }}>
                      {micro.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar
                      value={micro.val}
                      max={micro.max}
                      tone="primary"
                      label={micro.label}
                    />
                  </div>
                  <div className="font-mono-num mt-1 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                    {micro.val} / {micro.max} {micro.unit}
                  </div>
                </div>
              ))}
            </div>
            {showWomenGuidance && (
              <div className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                <strong style={{ color: 'var(--sys-primary)' }}>{cycleInsight.phaseLabel}</strong>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Focus: {cycleInsight.nutrientFocus} — {cycleInsight.dailyTip}</span>
              </div>
            )}
          </div>

          <div
            className="font-mono-num mt-4 flex flex-wrap items-center gap-2 text-xs"
            style={{ color: 'var(--sys-muted)' }}
          >
            <span>Resting burn (BMR): {macros.bmr} {energyUnit}</span>
            <span aria-hidden="true">·</span>
            <span>Daily burn (TDEE): {macros.tdee} {energyUnit}</span>
            <span aria-hidden="true">·</span>
            <span>BMI {macros.bmi.toFixed(1)}</span>
          </div>
        </div>

        {/* 1-Tap Meal Combos & Natural-Language Food Parser */}
        <div className="sys-card p-5">
          {activeAllergyLabels.length > 0 && (
            <div
              className="sys-card-nested mb-3 px-3 py-2 text-xs"
              style={{ borderColor: 'var(--sys-secondary)' }}
            >
              <strong style={{ color: 'var(--sys-secondary)' }}>Allergy Shield On: </strong>
              <span style={{ color: 'var(--sys-muted)' }}>
                {activeAllergyLabels.join(', ')} hidden from foods, recipes &amp; groceries.
              </span>
            </div>
          )}

          {macroSubstitutions.length > 0 && (
            <div className="sys-card-nested mb-3 p-3">
              <div className="text-xs font-semibold" style={{ color: 'var(--sys-primary)' }}>
                Safe Protein Swaps ({proteinGap} g protein left today)
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {macroSubstitutions.map((sub) => (
                  <button
                    key={sub.food.name}
                    type="button"
                    onClick={() =>
                      onLogFood({
                        n: sub.food.name,
                        k: sub.food.kcal,
                        p: sub.food.p,
                        c: sub.food.c,
                        f: sub.food.f,
                        q: 1,
                      })
                    }
                    className="sys-btn-secondary min-h-[36px] px-2.5 text-left text-xs"
                  >
                    + {sub.food.name} · <span style={{ color: 'var(--sys-muted)' }}>{sub.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs font-semibold" style={{ color: 'var(--sys-muted)' }}>
            Quick Meals (1 Tap)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {safeUserCombos.map(({ cb, origIdx }) => (
              <button
                key={`${cb.n}_${origIdx}`}
                type="button"
                onClick={() => onLogCombo(origIdx)}
                className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
                style={{ color: 'var(--sys-secondary)' }}
              >
                + {cb.n}
              </button>
            ))}
            {safeFallbackCombos.map((cb) => (
              <button
                key={cb.n}
                type="button"
                onClick={() => cb.items && onLogQuickFallbackCombo(cb.items, cb.n)}
                className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
                style={{ color: 'var(--sys-secondary)' }}
              >
                + {cb.n}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="meal-search" className="sr-only">
              Search foods or type a meal like 2 chapati and dal
            </label>
            <input
              id="meal-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  onQuickLogText(searchTerm);
                  setSearchTerm('');
                }
              }}
              placeholder="Search, type, or speak '2 chapati and dal'…"
              className="sys-input flex-1 px-3 py-2.5 text-sm"
            />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-label={isListening ? 'Stop voice meal input' : 'Voice log meal'}
                aria-pressed={isListening}
                onClick={handleToggleVoiceLog}
                className="sys-btn-secondary inline-flex min-h-[42px] items-center justify-center gap-1.5 px-3 text-xs font-semibold"
                style={{
                  borderColor: isListening ? 'var(--sys-danger)' : 'var(--sys-border)',
                  color: isListening ? 'var(--sys-danger)' : 'var(--sys-primary)',
                }}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                    <span>Listening…</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    <span>Voice</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!searchTerm.trim()) return;
                  onQuickLogText(searchTerm);
                  setSearchTerm('');
                }}
                className="sys-btn-primary min-h-[42px] flex-1 px-4 text-xs sm:flex-none"
              >
                Add Food
              </button>
            </div>
          </div>
          <p
            aria-live="polite"
            className="mt-1.5 text-[11px]"
            style={{ color: voiceIsError ? 'var(--sys-danger)' : 'var(--sys-muted)' }}
          >
            {voiceFeedback || 'Tip: tap Voice and say e.g. "2 chapati and dal" to log macros fast.'}
          </p>

          {/* Food Catalog Scroll List */}
          <div className="mt-3 max-h-60 divide-y overflow-y-auto" style={{ borderColor: 'var(--sys-border)' }}>
            {filteredFoods.length > 0 ? (
              filteredFoods.map((food) => (
                <div
                  key={food.name}
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ borderColor: 'var(--sys-border)' }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{food.name}</div>
                    <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {food.kcal} cal · P{food.p}g C{food.c}g F{food.f}g · ~₹{food.costInr}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${food.name}`}
                    onClick={() =>
                      onLogFood({
                        n: food.name,
                        k: food.kcal,
                        p: food.p,
                        c: food.c,
                        f: food.f,
                        q: 1,
                      })
                    }
                    className="sys-btn-secondary inline-flex min-h-[38px] shrink-0 items-center gap-1 px-3 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs" style={{ color: 'var(--sys-muted)' }}>
                No matches in the list. Tap Add Food above to log quantities, or enter a custom item
                below.
              </div>
            )}
          </div>

          {/* Custom Food Row */}
          <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-12" style={{ borderColor: 'var(--sys-border)' }}>
            <input
              type="text"
              aria-label="Custom food name"
              value={customFoodName}
              onChange={(e) => setCustomFoodName(e.target.value)}
              placeholder="Custom food name"
              className="sys-input px-3 py-2 text-xs sm:col-span-5"
            />
            <input
              type="number"
              aria-label="Custom food calories"
              value={customFoodKcal}
              onChange={(e) => setCustomFoodKcal(e.target.value)}
              placeholder="cal"
              className="sys-input px-3 py-2 text-xs sm:col-span-2"
            />
            <input
              type="number"
              aria-label="Custom food protein grams"
              value={customFoodProt}
              onChange={(e) => setCustomFoodProt(e.target.value)}
              placeholder="Protein g"
              className="sys-input px-3 py-2 text-xs sm:col-span-3"
            />
            <button
              type="button"
              onClick={() => {
                const k = Number(customFoodKcal);
                if (!customFoodName.trim() || k <= 0) return;
                onLogFood({
                  n: customFoodName.trim(),
                  k,
                  p: Number(customFoodProt) || 0,
                  c: 0,
                  f: 0,
                  q: 1,
                });
                setCustomFoodName('');
                setCustomFoodKcal('');
                setCustomFoodProt('');
              }}
              className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold sm:col-span-2"
            >
              Add
            </button>
          </div>
        </div>

        {/* Today's Food Log */}
        <div className="sys-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
              <h2 className="font-display text-base font-semibold">Today’s Food Log</h2>
            </div>
            {logged.length > 0 && (
              <button
                type="button"
                onClick={() => setShowComboSave((s) => !s)}
                className="sys-btn-secondary min-h-[36px] px-3 text-xs"
              >
                Save as Combo
              </button>
            )}
          </div>

          {showComboSave && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={comboNameInput}
                onChange={(e) => setComboNameInput(e.target.value)}
                placeholder="Combo name (e.g. Post-Workout Bowl)"
                className="sys-input flex-1 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!comboNameInput.trim()) return;
                  onSaveCurrentAsCombo(comboNameInput.trim());
                  setComboNameInput('');
                  setShowComboSave(false);
                }}
                className="sys-btn-primary min-h-[38px] px-3 text-xs"
              >
                Save
              </button>
            </div>
          )}

          {logged.length > 0 ? (
            <div className="mt-3 divide-y" style={{ borderColor: 'var(--sys-border)' }}>
              {logged.map((item, idx) => (
                <div
                  key={`${item.n}_${idx}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ borderColor: 'var(--sys-border)' }}
                >
                  <div>
                    <div className="text-sm font-medium">{item.n}</div>
                    <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {item.k} cal · {item.p}g protein
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.n}`}
                    onClick={() => onDeleteLoggedFood(idx)}
                    className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--sys-danger)' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs" style={{ color: 'var(--sys-muted)' }}>
              Nothing logged yet today. Use Add Food above or tap any item from the list.
            </p>
          )}
        </div>
      </div>

      {/* Right Column: Budget Kitchen Recipes & Recovery Sanctuary */}
      <div className="space-y-6 lg:col-span-5">
        <div className="sys-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Easy Budget Recipes (₹20–₹58)</h2>
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--sys-surface-lowest)' }}>
              {(
                [
                  ['all', 'All'],
                  ['cheap', '≤ ₹30'],
                  ['pro', 'High Protein'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRecipeFilter(id)}
                  className="min-h-[32px] rounded px-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: recipeFilter === id ? 'var(--sys-primary)' : 'transparent',
                    color: recipeFilter === id ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {visibleRecipes.length > 0 ? (
              visibleRecipes.map((r) => {
                const isTodayPick = dailyChefPick?.name === r.name;
                return (
                  <div
                    key={r.name}
                    className="sys-card-nested p-4"
                    style={{
                      borderColor: isTodayPick ? 'var(--sys-primary)' : 'var(--sys-border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{r.name}</div>
                        <div className="font-mono-num mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                          ₹{r.costInr} · {r.macros[0]} {energyUnit} · P{r.macros[1]}g C{r.macros[2]}g F{r.macros[3]}g
                          {isTodayPick && (
                            <span style={{ color: 'var(--sys-primary)' }}>
                              {' '}· System Recommended Today
                            </span>
                          )}
                          {r.tag === 'Female' && (
                            <span style={{ color: 'var(--sys-secondary)' }}> · Iron &amp; Folate</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onLogFood({
                            n: r.name,
                            k: r.macros[0],
                            p: r.macros[1],
                            c: r.macros[2],
                            f: r.macros[3],
                            q: 1,
                          })
                        }
                        className="sys-btn-secondary min-h-[36px] shrink-0 px-3 text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-2.5 border-t pt-2.5 text-xs" style={{ borderColor: 'var(--sys-border)' }}>
                      {allergies.length > 0 && (
                        <div className="mb-1.5 font-medium" style={{ color: 'var(--sys-secondary)' }}>
                          Allergen Checked ({activeAllergyLabels.join(', ')}) · Separate Prep Surface
                        </div>
                      )}
                      <details className="group">
                        <summary
                          className="cursor-pointer font-semibold select-none"
                          style={{ color: 'var(--sys-primary)' }}
                        >
                          Prep Sequence (3 Steps)
                        </summary>
                        <ol className="mt-2 space-y-1.5 leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                          {splitRecipePrepSteps(r.ingredients, r.steps).map((stepText, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="font-mono-num shrink-0 font-semibold" style={{ color: 'var(--sys-primary)' }}>
                                0{idx + 1}
                              </span>
                              <span>{stepText}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="sys-card-nested p-4 text-xs" style={{ color: 'var(--sys-muted)' }}>
                No preset recipes match this filter with your active allergies. Use Safe Protein
                Swaps or the food search on the left to build an allergen-safe plate.
              </div>
            )}
          </div>
        </div>

        {/* Goal-Safe Sanctuary */}
        <div className="sys-card p-5">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4" style={{ color: 'var(--sys-secondary)' }} />
            <h2 className="font-display text-lg font-semibold">{copy.sanctuaryTitle}</h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
            {isClean
              ? 'Calm recovery habits that lower daily stress and help your body repair overnight.'
              : 'Simple calming habits lower stress and earn +20 XP without changing your food goals.'}
          </p>

          <div className="mt-4 space-y-2.5">
            {allSanctuary.map(([title, desc, stat], idx) => {
              const done = Boolean(state.sanct[`${dateStr}_${idx}`]);
              return (
                <div
                  key={`${title}_${idx}`}
                  className="sys-card-nested flex items-center justify-between gap-3 p-3"
                  style={{
                    borderColor: done ? 'var(--sys-secondary)' : 'var(--sys-border)',
                  }}
                >
                  <div>
                    <div className={`text-sm font-medium ${done ? 'line-through opacity-70' : ''}`}>
                      {title}
                    </div>
                    <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {isClean ? `${desc} · Autonomic Reset` : `${desc} · +20 XP · ${stat}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => onCompleteSanctuary(idx, title, stat)}
                    className={`${done ? 'sys-btn-secondary opacity-60' : 'sys-btn-primary'} min-h-[38px] shrink-0 px-3 text-xs`}
                  >
                    {done ? 'Done' : 'Complete'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              aria-label="Custom sanctuary activity name"
              value={customSanctName}
              onChange={(e) => setCustomSanctName(e.target.value)}
              placeholder="Custom restorative habit…"
              className="sys-input flex-1 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                if (!customSanctName.trim()) return;
                onCreateCustomSanctuary(customSanctName.trim());
                setCustomSanctName('');
              }}
              className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
