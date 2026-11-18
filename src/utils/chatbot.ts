export type ChatbotRoleId =
  | 'wellness_coach'
  | 'strength_specialist'
  | 'nutrition_strategist'
  | 'recovery_guide';

export type ChatbotRoutingMode = 'auto' | 'fast' | 'general' | 'complex' | 'deep';

export type GeminiChatModel = 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen';

export type GeminiThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export interface ChatbotRoleConfig {
  id: ChatbotRoleId;
  label: string;
  shortLabel: string;
  tagline: string;
  systemDirective: string;
  starterPrompts: string[];
}

export interface ChatTurnMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  roleId: ChatbotRoleId;
  modelUsed?: GeminiChatModel;
  thinkingLevel?: GeminiThinkingLevel;
  tierLabel?: string;
}

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface ChatUserContext {
  profileSummary?: {
    name?: string;
    sex?: string;
    age?: number;
    diet?: string;
    equipment?: string;
    stage?: string;
    primaryGoal?: string;
    allergies?: string[];
    medicalHistory?: string[];
  };
  dailyTelemetry?: {
    steps?: number;
    sleepHours?: number;
    hrvMs?: number;
    rhrBpm?: number;
    streak?: number;
    remKcal?: number;
    remProt?: number;
    waterLitres?: number;
    minimumDueMode?: boolean;
  };
  safeMealNames?: string[];
}

export const ALLOWED_GEMINI_CHAT_MODELS: readonly GeminiChatModel[] = [
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
] as const;

export const CHATBOT_ROLES: readonly ChatbotRoleConfig[] = [
  {
    id: 'wellness_coach',
    label: 'Clinical Wellness Coach',
    shortLabel: 'Wellness Coach',
    tagline: 'Balanced daily coaching across habits, training, and nutrition.',
    systemDirective: [
      'You are the Clinical Wellness Coach inside The System.',
      'Give practical, encouraging, plain-English guidance grounded in the member’s daily metrics.',
      'Lead with the most actionable recommendation first, followed by 2-4 crisp supporting points.',
    ].join(' '),
    starterPrompts: [
      'What should I prioritize for the rest of today?',
      'How can I stay consistent on a busy workday?',
      'Summarize my recovery and remaining macro targets.',
    ],
  },
  {
    id: 'strength_specialist',
    label: 'Strength & Biomechanics Specialist',
    shortLabel: 'Strength Coach',
    tagline: 'Form cues, equipment swaps, progressive overload, and express sets.',
    systemDirective: [
      'You are the Strength & Biomechanics Specialist inside The System.',
      'Focus on joint-safe movement patterns, progressive overload, equipment substitutions, and time-boxed workouts.',
      'Adapt every recommendation to the user’s available equipment, mobility, and fatigue levels.',
    ].join(' '),
    starterPrompts: [
      'Design a 20-minute express strength circuit for today.',
      'Give me knee-friendly swaps for lower-body compound sets.',
      'How should I progress reps vs. weight this week?',
    ],
  },
  {
    id: 'nutrition_strategist',
    label: 'Metabolic & Allergy Nutritionist',
    shortLabel: 'Nutritionist',
    tagline: 'Macro-accurate meal ideas and strict allergen-safe swaps.',
    systemDirective: [
      'You are the Metabolic & Allergy Nutrition Strategist inside The System.',
      'Focus on hitting protein and calorie targets with realistic meals tailored to the user’s diet style.',
      'Never suggest any ingredient on the user’s allergy exclusion list, and verify cross-contact pitfalls.',
    ].join(' '),
    starterPrompts: [
      'Suggest a high-protein dinner that fits my remaining macros.',
      'What quick allergen-safe snacks boost protein without excess calories?',
      'How do I structure pre- and post-workout meals today?',
    ],
  },
  {
    id: 'recovery_guide',
    label: 'Sleep, HRV & Cycle Recovery Guide',
    shortLabel: 'Recovery Guide',
    tagline: 'Autonomic readiness, stress pacing, and Minimum Due days.',
    systemDirective: [
      'You are the Sleep, HRV & Cycle Recovery Guide inside The System.',
      'Interpret sleep duration, HRV, resting heart rate, and life-stage context (including pregnancy or postpartum when present).',
      'Recommend gentle deloads, hydration, breathing resets, or Minimum Due mode whenever recovery signals dip.',
    ].join(' '),
    starterPrompts: [
      'Analyze my sleep and HRV readiness for today’s training.',
      'When should I switch to Minimum Due mode to protect my streak?',
      'Give me a 10-minute evening wind-down protocol.',
    ],
  },
] as const;

export const CHATBOT_ROUTING_OPTIONS: ReadonlyArray<{
  id: ChatbotRoutingMode;
  label: string;
  description: string;
}> = [
  {
    id: 'auto',
    label: 'Auto (Complexity Router)',
    description: 'Routes quick queries to Flash-Lite and complex/deep coaching to Gemini 4 Hydrogen.',
  },
  {
    id: 'fast',
    label: 'Fast · Gemini 3.1 Flash-Lite',
    description: 'Lowest latency for quick swaps, short definitions, and rapid check-ins.',
  },
  {
    id: 'general',
    label: 'General · Gemini 4 Hydrogen',
    description: 'Balanced everyday coaching and conversational follow-ups.',
  },
  {
    id: 'complex',
    label: 'Complex · Gemini 4 Hydrogen (High)',
    description: 'Multi-constraint workout, meal, or schedule planning.',
  },
  {
    id: 'deep',
    label: 'Deep Reasoning · Gemini 4 Hydrogen (XHigh)',
    description: 'Maximum reasoning depth for root-cause biometric and protocol synthesis.',
  },
];

export function getChatbotRole(roleId: ChatbotRoleId): ChatbotRoleConfig {
  return CHATBOT_ROLES.find((r) => r.id === roleId) ?? CHATBOT_ROLES[0];
}

export function isValidChatbotRole(value: unknown): value is ChatbotRoleId {
  return typeof value === 'string' && CHATBOT_ROLES.some((r) => r.id === value);
}

export function isValidRoutingMode(value: unknown): value is ChatbotRoutingMode {
  return (
    value === 'auto' ||
    value === 'fast' ||
    value === 'general' ||
    value === 'complex' ||
    value === 'deep'
  );
}

export function resolveChatModelAndThinking(
  prompt: string,
  roleId: ChatbotRoleId,
  routingMode: ChatbotRoutingMode,
  historyLength = 0
): {
  model: GeminiChatModel;
  thinkingLevel: GeminiThinkingLevel;
  tierLabel: string;
} {
  if (routingMode === 'fast') {
    return {
      model: 'gemini-3.1-flash-lite',
      thinkingLevel: 'LOW',
      tierLabel: 'Fast',
    };
  }
  if (routingMode === 'general') {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'MEDIUM',
      tierLabel: 'General',
    };
  }
  if (routingMode === 'complex') {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'HIGH',
      tierLabel: 'Complex',
    };
  }
  if (routingMode === 'deep') {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'XHIGH',
      tierLabel: 'Deep Reasoning',
    };
  }

  // Auto complexity routing
  const normalized = prompt.trim().toLowerCase();
  const deepSignals = [
    /\b(root cause|analy[sz]e|periodiz|protocol|synthesize|trade-?off|compare|optimize|diagnostic|comprehensive)\b/,
    /\b(trimester|pregnancy|postpartum|pcos|thyroid|injury|rehab|autonomic|hrv)\b/,
    /\b(7-day|weekly plan|full plan|step-by-step|why am i)\b/,
  ];
  const complexSignals = [
    /\b(schedule|plan|workout|circuit|macros?|protein|allergy|meal|dinner|breakfast|lunch|swap|adjust|tired|sleep)\b/,
    /\b(how should|what should|build me|recommend)\b/,
  ];

  const deepMatches = deepSignals.filter((rx) => rx.test(normalized)).length;
  const complexMatches = complexSignals.filter((rx) => rx.test(normalized)).length;
  const questionMarks = (normalized.match(/\?/g) || []).length;

  if (deepMatches >= 2 || normalized.length > 180 || (deepMatches >= 1 && questionMarks >= 2)) {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'XHIGH',
      tierLabel: 'Deep Reasoning',
    };
  }

  if (
    deepMatches >= 1 ||
    complexMatches >= 1 ||
    normalized.length > 75 ||
    historyLength >= 4 ||
    roleId === 'recovery_guide'
  ) {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'HIGH',
      tierLabel: 'Complex',
    };
  }

  if (normalized.length <= 45 && complexMatches === 0 && deepMatches === 0) {
    return {
      model: 'gemini-3.1-flash-lite',
      thinkingLevel: 'LOW',
      tierLabel: 'Fast',
    };
  }

  return {
    model: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
    tierLabel: 'General',
  };
}

export function buildChatbotSystemInstruction(
  roleId: ChatbotRoleId,
  context: ChatUserContext = {}
): string {
  const role = getChatbotRole(roleId);
  const profile = context.profileSummary || {};
  const telemetry = context.dailyTelemetry || {};
  const allergies = Array.isArray(profile.allergies) ? profile.allergies.filter(Boolean) : [];
  const medicalHistory = Array.isArray(profile.medicalHistory)
    ? profile.medicalHistory.filter(Boolean)
    : [];
  const safeMeals = Array.isArray(context.safeMealNames)
    ? context.safeMealNames.filter(Boolean).slice(0, 8)
    : [];

  const sections = [
    role.systemDirective,
    'COMMUNICATION RULES: Use clear, concise plain English. Reference the user’s live numbers when relevant. Avoid dense clinical jargon, and never fabricate logged workouts or medical diagnoses.',
    allergies.length > 0
      ? `STRICT ALLERGY GUARDRAIL: The user has declared allergies/intolerances to [${allergies.join(', ')}]. NEVER recommend or include these ingredients or dishes containing them.`
      : 'ALLERGY STATUS: No food allergies declared.',
  ];

  if (medicalHistory.length > 0 || (profile.stage && profile.stage !== 'std')) {
    sections.push(
      `SAFETY CONTEXT: Life stage=${profile.stage || 'standard'}; medical considerations=[${
        medicalHistory.join(', ') || 'none'
      }]. Keep guidance conservative and remind the user to consult their clinician for medical symptoms.`
    );
  }

  sections.push(`USER PROFILE: ${JSON.stringify(profile)}`);
  sections.push(`TODAY TELEMETRY: ${JSON.stringify(telemetry)}`);

  if (safeMeals.length > 0) {
    sections.push(`ALLERGEN-SAFE CATALOG HIGHLIGHTS: ${safeMeals.join(', ')}`);
  }

  return sections.join('\n');
}

export function sanitizeChatHistory(
  messages: ReadonlyArray<{ role: string; text: string }>,
  maxMessages = 20
): GeminiContentTurn[] {
  const cleaned: GeminiContentTurn[] = [];

  for (const msg of messages) {
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    if (!text) continue;
    const role: 'user' | 'model' = msg.role === 'user' || msg.role === 'u' ? 'user' : 'model';

    // Ensure history starts with a user turn as expected by Gemini chat history
    if (cleaned.length === 0 && role !== 'user') continue;

    // Merge consecutive turns of the same role so user/model strictly alternate
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0] = { text: `${prev.parts[0].text}\n\n${text}` };
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  if (cleaned.length <= maxMessages) return cleaned;

  let sliced = cleaned.slice(-maxMessages);
  if (sliced.length > 0 && sliced[0].role !== 'user') {
    sliced = sliced.slice(1);
  }
  return sliced;
}

const CHAT_STORAGE_KEY = 'thesystem_gemini_chat_v1';

export interface PersistedChatSession {
  roleId: ChatbotRoleId;
  routingMode: ChatbotRoutingMode;
  messages: ChatTurnMessage[];
}

export function loadPersistedChatSession(): PersistedChatSession {
  const fallback: PersistedChatSession = {
    roleId: 'wellness_coach',
    routingMode: 'auto',
    messages: [],
  };
  if (typeof window === 'undefined' || !window.localStorage) return fallback;

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedChatSession>;
    return {
      roleId: isValidChatbotRole(parsed.roleId) ? parsed.roleId : 'wellness_coach',
      routingMode: isValidRoutingMode(parsed.routingMode) ? parsed.routingMode : 'auto',
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
            .filter(
              (m): m is ChatTurnMessage =>
                Boolean(m) &&
                typeof m.id === 'string' &&
                (m.role === 'user' || m.role === 'model') &&
                typeof m.text === 'string' &&
                m.text.trim().length > 0
            )
            .slice(-40)
        : [],
    };
  } catch {
    return fallback;
  }
}

export function savePersistedChatSession(session: PersistedChatSession): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        roleId: session.roleId,
        routingMode: session.routingMode,
        messages: session.messages.slice(-40),
      })
    );
  } catch {
    // Ignore storage quota issues
  }
}
