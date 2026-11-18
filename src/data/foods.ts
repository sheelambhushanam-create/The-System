import type { AllergyTag, FeedPost, MealCombo, StatKey, StoryItem } from '../types/system';

export const ALLERGY_OPTIONS: Array<{
  id: AllergyTag;
  label: string;
  detail: string;
}> = [
  {
    id: 'dairy_lactose',
    label: 'Dairy / Lactose',
    detail: 'Hides paneer, curd, milk, and whey everywhere',
  },
  {
    id: 'soy',
    label: 'Soy / Soya',
    detail: 'Hides soya chunks, tofu, and soy protein',
  },
  {
    id: 'gluten_wheat',
    label: 'Gluten / Wheat',
    detail: 'Hides whole wheat roti, upma/sooji, and oats',
  },
  {
    id: 'eggs',
    label: 'Eggs',
    detail: 'Hides boiled eggs and egg bhurji',
  },
  {
    id: 'peanuts_nuts',
    label: 'Peanuts / Tree Nuts',
    detail: 'Hides peanuts, almonds, and nut snacks',
  },
  {
    id: 'lentils_beans',
    label: 'Lentils / Legumes',
    detail: 'Hides dal, rajma, chole, sprouts, idli/dosa, and besan',
  },
];

export interface FoodCatalogItem {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  category: string;
  costInr: number;
  allergenTags: AllergyTag[];
}

export const FOODS: FoodCatalogItem[] = [
  { name: 'Whole wheat roti', kcal: 104, p: 3, c: 18, f: 2, category: 'Pantry & Dals', costInr: 4, allergenTags: ['gluten_wheat'] },
  { name: 'Soya chunks (30 g)', kcal: 104, p: 15, c: 10, f: 0, category: 'Dairy & Protein', costInr: 8, allergenTags: ['soy'] },
  { name: 'Low-fat paneer (100 g)', kcal: 200, p: 20, c: 4, f: 11, category: 'Dairy & Protein', costInr: 38, allergenTags: ['dairy_lactose'] },
  { name: 'Moong dal (1 cup)', kcal: 212, p: 14, c: 38, f: 1, category: 'Pantry & Dals', costInr: 14, allergenTags: ['lentils_beans'] },
  { name: 'Curd / dahi (1 cup)', kcal: 98, p: 11, c: 8, f: 4, category: 'Dairy & Protein', costInr: 15, allergenTags: ['dairy_lactose'] },
  { name: 'Sprouts (1 cup)', kcal: 100, p: 9, c: 18, f: 1, category: 'Sabzi Mandi', costInr: 10, allergenTags: ['lentils_beans'] },
  { name: 'Besan chilla', kcal: 120, p: 6, c: 14, f: 4, category: 'Pantry & Dals', costInr: 12, allergenTags: ['lentils_beans'] },
  { name: 'Boiled egg', kcal: 78, p: 6, c: 1, f: 5, category: 'Dairy & Protein', costInr: 8, allergenTags: ['eggs'] },
  { name: 'Chicken breast (100 g)', kcal: 165, p: 31, c: 0, f: 4, category: 'Dairy & Protein', costInr: 35, allergenTags: [] },
  { name: 'Poha (1 cup)', kcal: 180, p: 3, c: 34, f: 4, category: 'Pantry & Dals', costInr: 10, allergenTags: [] },
  { name: 'Idli', kcal: 58, p: 2, c: 12, f: 0, category: 'Pantry & Dals', costInr: 8, allergenTags: ['lentils_beans'] },
  { name: 'Oats (40 g)', kcal: 150, p: 5, c: 27, f: 3, category: 'Pantry & Dals', costInr: 10, allergenTags: ['gluten_wheat'] },
  { name: 'Cooked rice (1 cup)', kcal: 205, p: 4, c: 45, f: 0, category: 'Pantry & Dals', costInr: 8, allergenTags: [] },
  { name: 'Almonds (10)', kcal: 70, p: 3, c: 3, f: 6, category: 'Pantry & Dals', costInr: 12, allergenTags: ['peanuts_nuts'] },
  { name: 'Whey scoop', kcal: 120, p: 24, c: 3, f: 2, category: 'Dairy & Protein', costInr: 55, allergenTags: ['dairy_lactose'] },
  { name: 'Rajma (1 cup)', kcal: 225, p: 15, c: 40, f: 1, category: 'Pantry & Dals', costInr: 16, allergenTags: ['lentils_beans'] },
  { name: 'Chole (1 cup)', kcal: 270, p: 14, c: 45, f: 4, category: 'Pantry & Dals', costInr: 16, allergenTags: ['lentils_beans'] },
  { name: 'Dosa', kcal: 133, p: 3, c: 22, f: 4, category: 'Pantry & Dals', costInr: 12, allergenTags: ['lentils_beans'] },
  { name: 'Banana', kcal: 105, p: 1, c: 27, f: 0, category: 'Sabzi Mandi', costInr: 6, allergenTags: [] },
  { name: 'Milk (1 glass)', kcal: 150, p: 8, c: 12, f: 8, category: 'Dairy & Protein', costInr: 14, allergenTags: ['dairy_lactose'] },
  { name: 'Peanuts (30 g)', kcal: 170, p: 7, c: 5, f: 14, category: 'Pantry & Dals', costInr: 7, allergenTags: ['peanuts_nuts'] },
  { name: 'Tofu (100 g)', kcal: 76, p: 8, c: 2, f: 5, category: 'Dairy & Protein', costInr: 25, allergenTags: ['soy'] },
  { name: 'Upma (1 cup)', kcal: 190, p: 5, c: 30, f: 6, category: 'Pantry & Dals', costInr: 12, allergenTags: ['gluten_wheat'] },
  { name: 'Palak / Spinach sabzi (1 cup)', kcal: 110, p: 4, c: 10, f: 5, category: 'Sabzi Mandi', costInr: 12, allergenTags: [] },
  { name: 'Ragi roti', kcal: 115, p: 3, c: 22, f: 2, category: 'Pantry & Dals', costInr: 6, allergenTags: [] },
  { name: 'Pumpkin & Hemp Seed Mix (30 g)', kcal: 165, p: 9, c: 4, f: 13, category: 'Sabzi Mandi', costInr: 26, allergenTags: [] },
  { name: 'Quinoa & Veggie Bowl (1 cup)', kcal: 220, p: 8, c: 39, f: 3.5, category: 'Pantry & Dals', costInr: 34, allergenTags: [] },
];

export interface RecipeItem {
  name: string;
  costInr: number;
  macros: [number, number, number, number];
  ingredients: string;
  steps: string;
  tag: 'Eggetarian' | 'Veg' | 'Female' | 'Omnivore';
  allergenTags: AllergyTag[];
}

export const RECIPES: RecipeItem[] = [
  {
    name: 'Masala egg bhurji',
    costInr: 28,
    macros: [234, 18, 3, 15],
    ingredients: 'Eggs, onion, tomato, chilli, turmeric',
    steps: 'Chop onion/tomato · Sauté with spices 3 min · Scramble in 3 eggs',
    tag: 'Eggetarian',
    allergenTags: ['eggs'],
  },
  {
    name: 'Soya chunk pulao',
    costInr: 35,
    macros: [420, 24, 55, 8],
    ingredients: 'Soya chunks, rice, peas, spices',
    steps: 'Soak soya 5 min · Fry spices + peas · Add rice & water; cook 2 whistles',
    tag: 'Veg',
    allergenTags: ['soy'],
  },
  {
    name: 'Moong dal chilla x2',
    costInr: 20,
    macros: [240, 14, 32, 6],
    ingredients: 'Moong flour, onion, coriander',
    steps: 'Mix batter with water · Pour on tawa · Cook both sides 2 min',
    tag: 'Veg',
    allergenTags: ['lentils_beans'],
  },
  {
    name: 'Curd sprout chaat',
    costInr: 25,
    macros: [210, 17, 26, 5],
    ingredients: 'Curd, sprouts, onion, chaat masala',
    steps: 'Mix sprouts + curd · Add onion, lemon · Season and eat',
    tag: 'Veg',
    allergenTags: ['dairy_lactose', 'lentils_beans'],
  },
  {
    name: 'Paneer bhurji',
    costInr: 58,
    macros: [320, 22, 8, 22],
    ingredients: 'Low-fat paneer, onion, tomato',
    steps: 'Crumble paneer · Sauté onion-tomato masala · Add paneer, cook 3 min',
    tag: 'Veg',
    allergenTags: ['dairy_lactose'],
  },
  {
    name: 'Palak Dal & Ragi Roti (Iron/Folate)',
    costInr: 32,
    macros: [340, 16, 48, 7],
    ingredients: 'Spinach, moong dal, ragi flour, lemon',
    steps: 'Simmer spinach & dal · Squeeze fresh lemon for iron absorption · Serve with ragi roti',
    tag: 'Female',
    allergenTags: ['lentils_beans'],
  },
  {
    name: 'Palak Ragi & Pumpkin Seed Bowl',
    costInr: 34,
    macros: [315, 13, 44, 10],
    ingredients: 'Ragi roti, palak sabzi, roasted pumpkin seeds, lemon',
    steps: 'Toss sautéed palak with toasted pumpkin seeds · Serve warm with 2 ragi rotis',
    tag: 'Veg',
    allergenTags: [],
  },
  {
    name: 'Spiced Herb Chicken & Rice Bowl',
    costInr: 54,
    macros: [370, 34, 45, 5],
    ingredients: 'Chicken breast, steamed rice, spinach, garlic, lemon',
    steps: 'Pan-sear spiced chicken breast 6 min · Toss spinach · Serve over warm rice',
    tag: 'Omnivore',
    allergenTags: [],
  },
];

export function hasAllergenOverlap(
  itemAllergens: AllergyTag[] | undefined,
  userAllergies: AllergyTag[] = []
): boolean {
  if (!userAllergies.length || !itemAllergens?.length) return false;
  return itemAllergens.some((tag) => userAllergies.includes(tag));
}

export function getSafeFoods(
  allergies: AllergyTag[] = [],
  catalog: FoodCatalogItem[] = FOODS
): FoodCatalogItem[] {
  if (!allergies.length) return catalog;
  return catalog.filter((item) => !hasAllergenOverlap(item.allergenTags, allergies));
}

export function getSafeRecipes(
  recipeDatabase: RecipeItem[],
  allergies: AllergyTag[] = [],
  options?: { isFemaleOrWomen?: boolean; diet?: string }
): RecipeItem[] {
  const seen = new Set<string>();
  return recipeDatabase.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    if (hasAllergenOverlap(r.allergenTags, allergies)) return false;
    if (options && !options.isFemaleOrWomen && r.tag === 'Female') return false;
    if (options?.diet) {
      const isVeg = /Veg|Plant-Based/i.test(options.diet);
      const isEgg = /Eggetarian/i.test(options.diet);
      if (isVeg && (r.tag === 'Eggetarian' || r.tag === 'Omnivore')) return false;
      if (isEgg && r.tag === 'Omnivore') return false;
    }
    return true;
  });
}

export function isComboSafe(
  combo: MealCombo,
  allergies: AllergyTag[] = [],
  catalog: FoodCatalogItem[] = FOODS
): boolean {
  if (!allergies.length) return true;
  if (combo.items) {
    return combo.items.every(([name]) => {
      const match = catalog.find((f) => f.name === name);
      if (!match) return true;
      return !hasAllergenOverlap(match.allergenTags, allergies);
    });
  }
  if (combo.raw) {
    return combo.raw.every(([name]) => {
      const match = catalog.find(
        (f) => f.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(f.name.toLowerCase())
      );
      if (!match) return true;
      return !hasAllergenOverlap(match.allergenTags, allergies);
    });
  }
  return true;
}

export function getSafeFallbackCombos(
  allergies: AllergyTag[] = [],
  diet = 'Indian High-Protein Veg'
): MealCombo[] {
  const safeFoods = getSafeFoods(allergies, FOODS);
  const hasFood = (name: string) => safeFoods.some((f) => f.name === name);
  const candidates: MealCombo[] = [
    {
      n: 'Soya & Rice Power Bowl',
      items: [
        ['Soya chunks (30 g)', 1.5],
        ['Cooked rice (1 cup)', 1],
        ['Palak / Spinach sabzi (1 cup)', 1],
      ],
    },
    {
      n: 'Ragi & Dal Recovery Thali',
      items: [
        ['Ragi roti', 2],
        ['Moong dal (1 cup)', 1],
        ['Palak / Spinach sabzi (1 cup)', 1],
      ],
    },
    {
      n: 'Gluten-Free Egg & Poha Plate',
      items: [
        ['Boiled egg', 2],
        ['Poha (1 cup)', 1],
      ],
    },
    {
      n: 'Allergen-Safe Quinoa & Seed Bowl',
      items: [
        ['Quinoa & Veggie Bowl (1 cup)', 1],
        ['Pumpkin & Hemp Seed Mix (30 g)', 1],
        ['Palak / Spinach sabzi (1 cup)', 1],
      ],
    },
  ];

  const isVeg = /Veg|Plant-Based/i.test(diet);
  return candidates.filter((cb) => {
    if (!cb.items) return false;
    if (isVeg && cb.items.some(([nm]) => /egg|chicken/i.test(nm))) return false;
    return cb.items.every(([nm]) => hasFood(nm)) && isComboSafe(cb, allergies, FOODS);
  });
}

export interface MacroSubstitutionSuggestion {
  food: FoodCatalogItem;
  reason: string;
}

export function getMacroSubstitutions(
  allergies: AllergyTag[] = [],
  openProteinDeficitG = 0
): MacroSubstitutionSuggestion[] {
  if (!allergies.length || openProteinDeficitG <= 10) return [];
  const safeFoods = getSafeFoods(allergies, FOODS);
  const pick = (name: string) => safeFoods.find((f) => f.name === name);

  const suggestions: MacroSubstitutionSuggestion[] = [];
  const addUnique = (name: string, reason: string) => {
    const food = pick(name);
    if (food && !suggestions.some((s) => s.food.name === food.name)) {
      suggestions.push({ food, reason });
    }
  };

  if (allergies.includes('dairy_lactose')) {
    addUnique('Soya chunks (30 g)', 'Dairy-free high protein swap (15g P)');
    addUnique('Sprouts (1 cup)', 'Plant protein & fiber swap (9g P)');
    addUnique('Boiled egg', 'Lactose-free complete protein (6g P)');
  }
  if (allergies.includes('soy')) {
    addUnique('Low-fat paneer (100 g)', 'Soy-free dairy protein (20g P)');
    addUnique('Curd / dahi (1 cup)', 'Probiotic soy-free protein (11g P)');
    addUnique('Moong dal (1 cup)', 'Plant protein dal swap (14g P)');
  }
  if (allergies.includes('gluten_wheat')) {
    addUnique('Besan chilla', 'Gluten-free chickpea flatbread (6g P)');
    addUnique('Ragi roti', 'Millet swap rich in calcium & iron');
    addUnique('Cooked rice (1 cup)', 'Gentle gluten-free carb base');
  }
  if (allergies.includes('lentils_beans')) {
    addUnique('Low-fat paneer (100 g)', 'Legume-free protein staple (20g P)');
    addUnique('Soya chunks (30 g)', 'High-protein swap without dals (15g P)');
    addUnique('Boiled egg', 'Legume-free complete protein (6g P)');
  }
  if (allergies.includes('eggs') || allergies.includes('peanuts_nuts')) {
    addUnique('Soya chunks (30 g)', 'Nut & egg-free protein (15g P)');
    addUnique('Moong dal (1 cup)', 'Nut & egg-free dal staple (14g P)');
  }

  // Universal fallback if combined allergies blocked above picks
  addUnique('Pumpkin & Hemp Seed Mix (30 g)', 'Top-6 allergen-free complete seeds (9g P)');
  addUnique('Quinoa & Veggie Bowl (1 cup)', 'Allergen-free complete grain protein (8g P)');

  return suggestions.slice(0, 3);
}

export function getDailyChefRecommendation(
  safeRecipes: RecipeItem[],
  remKcal: number,
  remProt: number,
  dateStr: string
): RecipeItem | null {
  if (!safeRecipes.length) return null;
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const dayOfYear = Number.isNaN(dt.getTime())
    ? 1
    : Math.floor(
        (dt.getTime() - Date.UTC(dt.getUTCFullYear(), 0, 0)) / 86400000
      );

  // Prioritize recipes that fit remaining calories and meaningfully close protein deficit
  const fitting = safeRecipes.filter(
    (r) => r.macros[0] <= Math.max(450, remKcal + 80) && (remProt <= 8 || r.macros[1] >= 12)
  );
  const pool = fitting.length > 0 ? fitting : safeRecipes;
  return pool[dayOfYear % pool.length];
}

export const SANCTUARY_PRACTICES: Array<[string, string, StatKey]> = [
  ['Morning Sunlight & Circadian Reset', '15 min of morning sun, no phone', 'SEN'],
  ['Device-Free Family Hearth', '30 min screens off with family', 'INT'],
  ['Verdant Nature Retreat', '20 min walk in a park or greenery', 'VIT'],
  ['Mindful Breathwork & Stillness', '10 min box breathing', 'SEN'],
];

interface GroceryItemSpec {
  label: string;
  costInr: number;
  allergens: AllergyTag[];
}

export function buildGroceryList(diet: string, allergies: AllergyTag[] = []) {
  const isVeg = !/Omnivore/i.test(diet);
  const dairyAllergic = allergies.includes('dairy_lactose');
  const soyAllergic = allergies.includes('soy');
  const glutenAllergic = allergies.includes('gluten_wheat');
  const legumeAllergic = allergies.includes('lentils_beans');

  const produceItems: GroceryItemSpec[] = [
    { label: 'Spinach (Palak) — 2 bunches', costInr: 40, allergens: [] },
    { label: 'Onions & Tomatoes — 2 kg total', costInr: 90, allergens: [] },
    { label: 'Bananas — 1 dozen', costInr: 60, allergens: [] },
    { label: 'Fresh Coriander, Ginger & Lemons', costInr: 45, allergens: [] },
    { label: 'Sprouts (Moong & Kala Chana) — 500 g', costInr: 65, allergens: ['lentils_beans'] },
  ];

  const proteinItems: GroceryItemSpec[] = [
    { label: 'Curd / Dahi — 1.5 kg', costInr: 110, allergens: ['dairy_lactose'] },
    { label: 'Low-Fat Paneer — 600 g', costInr: 230, allergens: ['dairy_lactose'] },
    { label: 'Soya Chunks — 500 g pack', costInr: 85, allergens: ['soy'] },
    isVeg
      ? { label: 'Tofu — 400 g', costInr: 110, allergens: ['soy'] }
      : { label: 'Chicken Breast (1 kg)', costInr: 290, allergens: [] },
    ...(!isVeg ? [{ label: 'Eggs (1 tray / 30)', costInr: 195, allergens: ['eggs'] as AllergyTag[] }] : []),
    ...(dairyAllergic || soyAllergic || legumeAllergic
      ? [{ label: 'Pumpkin & Hemp Seeds — 250 g', costInr: 190, allergens: [] as AllergyTag[] }]
      : []),
  ];

  const pantryItems: GroceryItemSpec[] = [
    glutenAllergic
      ? { label: 'Ragi & Jowar Millet Flour — 2 kg', costInr: 135, allergens: [] }
      : { label: 'Whole Wheat Atta / Ragi Flour — 2 kg', costInr: 110, allergens: ['gluten_wheat'] },
    { label: 'Yellow Moong Dal — 1 kg', costInr: 135, allergens: ['lentils_beans'] },
    { label: 'Rajma / Kabuli Chana — 500 g', costInr: 85, allergens: ['lentils_beans'] },
    glutenAllergic
      ? { label: 'Flattened Rice (Poha) & Quinoa — 1 kg total', costInr: 145, allergens: [] }
      : { label: 'Rolled Oats & Poha — 1 kg total', costInr: 120, allergens: ['gluten_wheat'] },
    { label: 'Roasted Peanuts / Almonds — 250 g', costInr: 140, allergens: ['peanuts_nuts'] },
  ];

  const filterList = (items: GroceryItemSpec[]) =>
    items
      .filter((item) => !hasAllergenOverlap(item.allergens, allergies))
      .map((item) => [item.label, item.costInr] as const);

  const categories = [
    {
      cat: 'Sabzi Mandi (Fresh Produce)',
      list: filterList(produceItems),
    },
    {
      cat: dairyAllergic ? 'Allergen-Safe Protein Staples' : 'Dairy & High-Protein Staples',
      list: filterList(proteinItems),
    },
    {
      cat: 'Kirana Pantry & Staples',
      list: filterList(pantryItems),
    },
  ].filter((c) => c.list.length > 0);

  const totalInr = categories.reduce(
    (sum, g) => sum + g.list.reduce((s, x) => s + x[1], 0),
    0
  );
  return { categories, totalInr };
}

export interface PeerProfile {
  name: string;
  lv: number;
  stats: [number, number, number, number, number];
  streak: number;
  goalPct: number;
}

export const PEERS: PeerProfile[] = [
  { name: 'Vanguard_K', lv: 34, stats: [60, 44, 30, 52, 28], streak: 21, goalPct: 78 },
  { name: 'IronBhai', lv: 22, stats: [48, 30, 26, 40, 22], streak: 12, goalPct: 55 },
  { name: 'ArjunRises', lv: 17, stats: [34, 38, 22, 30, 20], streak: 9, goalPct: 40 },
  { name: 'PriyaFit', lv: 13, stats: [26, 28, 24, 29, 25], streak: 15, goalPct: 62 },
  { name: 'NightRunner', lv: 9, stats: [20, 22, 18, 21, 15], streak: 4, goalPct: 25 },
];

export const SEED_POSTS: FeedPost[] = [
  {
    id: 'seed-1',
    u: 'PriyaFit',
    t: 'Tip: add a spoon of curd to your sprouts. Protein goes up and afternoon cravings go down.',
    tip: true,
    likes: ['u1', 'u2', 'u3'],
    cm: [['ArjunRises', 'Great tip! Trying this with lunch.']],
    ts: Date.now() - 3600_000,
    authorStreak: 15,
  },
  {
    id: 'seed-2',
    u: 'IronBhai',
    t: 'Hit a new Goblet Squat PR today: 3 sets × 12 reps @ 20 kg!',
    tip: false,
    likes: ['u1', 'u2', 'u3', 'u4', 'u5'],
    cm: [],
    ts: Date.now() - 7200_000,
    authorStreak: 12,
  },
  {
    id: 'seed-3',
    u: 'Vanguard_K',
    t: 'Tip: drink a glass of water before every meal. Hydration stays on track without trying.',
    tip: true,
    likes: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'],
    cm: [['PriyaFit', 'Doing this now!']],
    ts: Date.now() - 10800_000,
    authorStreak: 21,
  },
];

export const SEED_STORIES: StoryItem[] = [
  { id: 'st-1', u: 'Vanguard_K', t: 'Leg day PR', ts: Date.now() - 3600_000 },
  { id: 'st-2', u: 'IronBhai', t: 'Sunrise 5k walk', ts: Date.now() - 7200_000 },
  { id: 'st-3', u: 'ArjunRises', t: 'Meal prep Sunday', ts: Date.now() - 10800_000 },
  { id: 'st-4', u: 'PriyaFit', t: 'Day 21 cleared', ts: Date.now() - 14400_000 },
];

export const SEED_CHAT: { g: Array<[string, string]>; v: Array<[string, string]> } = {
  g: [
    ['Vanguard_K', 'Day 21 cleared. Protein bowl was super easy today.'],
    ['PriyaFit', 'Anyone trying the soya pulao? ₹35 and 24 g protein.'],
    ['IronBhai', 'Keep pushing everyone — consistency beats intensity.'],
  ],
  v: [
    ['ArjunRises', 'Squad check-in: who finished today’s sets?'],
    ['PriyaFit', 'Done! Logged 3 sets × 12 reps.'],
  ],
};
