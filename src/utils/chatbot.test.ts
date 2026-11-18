import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_GEMINI_CHAT_MODELS,
  CHATBOT_ROLES,
  buildChatbotSystemInstruction,
  resolveChatModelAndThinking,
  sanitizeChatHistory,
} from './chatbot';

test('resolveChatModelAndThinking routes explicitly across fast, general, complex, and deep modes using allowed models', () => {
  const fast = resolveChatModelAndThinking('hi', 'wellness_coach', 'fast');
  assert.equal(fast.model, 'gemini-3.1-flash-lite');
  assert.equal(fast.thinkingLevel, 'LOW');

  const general = resolveChatModelAndThinking('hi', 'wellness_coach', 'general');
  assert.equal(general.model, 'gemini-4-hydrogen');
  assert.equal(general.thinkingLevel, 'MEDIUM');

  const complex = resolveChatModelAndThinking('hi', 'wellness_coach', 'complex');
  assert.equal(complex.model, 'gemini-4-hydrogen');
  assert.equal(complex.thinkingLevel, 'HIGH');

  const deep = resolveChatModelAndThinking('hi', 'wellness_coach', 'deep');
  assert.equal(deep.model, 'gemini-4-hydrogen');
  assert.equal(deep.thinkingLevel, 'XHIGH');

  for (const res of [fast, general, complex, deep]) {
    assert.ok(ALLOWED_GEMINI_CHAT_MODELS.includes(res.model));
  }
});

test('resolveChatModelAndThinking auto-routes based on prompt complexity and conversation depth', () => {
  const quick = resolveChatModelAndThinking('Water goal?', 'wellness_coach', 'auto', 0);
  assert.equal(quick.model, 'gemini-3.1-flash-lite');
  assert.equal(quick.tierLabel, 'Fast');

  const mealPlan = resolveChatModelAndThinking(
    'What high-protein dinner swap fits my allergies?',
    'nutrition_strategist',
    'auto',
    0
  );
  assert.equal(mealPlan.model, 'gemini-4-hydrogen');
  assert.equal(mealPlan.thinkingLevel, 'HIGH');

  const deepAnalysis = resolveChatModelAndThinking(
    'Analyze the root cause of my low HRV and synthesize a 7-day periodized protocol for pregnancy fatigue.',
    'recovery_guide',
    'auto',
    2
  );
  assert.equal(deepAnalysis.model, 'gemini-4-hydrogen');
  assert.equal(deepAnalysis.thinkingLevel, 'XHIGH');
  assert.equal(deepAnalysis.tierLabel, 'Deep Reasoning');
});

test('buildChatbotSystemInstruction includes role directive, allergy guardrails, and live telemetry', () => {
  assert.equal(CHATBOT_ROLES.length, 4);

  const instruction = buildChatbotSystemInstruction('nutrition_strategist', {
    profileSummary: {
      name: 'Priya',
      diet: 'Vegetarian',
      allergies: ['peanuts', 'shellfish'],
      stage: 'pregnant_t2',
      medicalHistory: ['gestational_diabetes'],
    },
    dailyTelemetry: {
      steps: 5400,
      sleepHours: 6.2,
      remKcal: 620,
      remProt: 44,
    },
    safeMealNames: ['Moong Dal Chilla', 'Paneer Bhurji'],
  });

  assert.match(instruction, /Metabolic & Allergy Nutrition Strategist/);
  assert.match(instruction, /peanuts, shellfish/);
  assert.match(instruction, /pregnant_t2/);
  assert.match(instruction, /Moong Dal Chilla/);
  assert.match(instruction, /"remProt":44/);
});

test('sanitizeChatHistory trims invalid items, ensures user-first turn, merges consecutive roles, and caps length', () => {
  const raw = [
    { role: 'model', text: 'Orphan greeting should be dropped' },
    { role: 'user', text: 'First question' },
    { role: 'user', text: 'Follow-up before reply' },
    { role: 'model', text: '   ' },
    { role: 'model', text: 'Assistant answer 1' },
    { role: 'user', text: 'Second question' },
    { role: 'model', text: 'Assistant answer 2' },
  ];

  const sanitized = sanitizeChatHistory(raw, 20);
  assert.equal(sanitized.length, 4);
  assert.equal(sanitized[0].role, 'user');
  assert.equal(sanitized[0].parts[0].text, 'First question\n\nFollow-up before reply');
  assert.equal(sanitized[1].role, 'model');
  assert.equal(sanitized[1].parts[0].text, 'Assistant answer 1');
  assert.equal(sanitized[2].role, 'user');
  assert.equal(sanitized[3].role, 'model');

  const capped = sanitizeChatHistory(raw, 3);
  assert.equal(capped[0].role, 'user');
  assert.equal(capped.length, 2);
});
