import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type, type Content, type FunctionDeclaration } from '@google/genai';
import {
  ALLOWED_GEMINI_CHAT_MODELS,
  buildChatbotSystemInstruction,
  isValidChatbotRole,
  isValidRoutingMode,
  resolveChatModelAndThinking,
  sanitizeChatHistory,
  type GeminiChatModel,
  type GeminiThinkingLevel,
} from './src/utils/chatbot.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const readBiometricsTool: FunctionDeclaration = {
  name: 'read_biometrics',
  description:
    'Reads the user current steps, sleep hours, HRV, resting heart rate, and streak status to assess fatigue or recovery needs.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Brief reason for checking biometrics (e.g. fatigue assessment)',
      },
    },
    required: ['reason'],
  },
};

const scheduleCalendarWorkoutTool: FunctionDeclaration = {
  name: 'schedule_calendar_workout',
  description:
    'Creates a Google Calendar workout reminder link for a busy day or scheduled express session.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Short session title, e.g. 20-Min Express Strength',
      },
      timeHHMM: {
        type: Type.STRING,
        description: '24-hour start time like 07:30 or 18:00',
      },
      dateISO: {
        type: Type.STRING,
        description: 'YYYY-MM-DD target date',
      },
      notes: {
        type: Type.STRING,
        description: 'Plain-English workout notes',
      },
    },
    required: ['title', 'timeHHMM'],
  },
};

const findSafeMealTool: FunctionDeclaration = {
  name: 'find_allergen_safe_meal',
  description:
    'Picks the best allergen-safe Indian meal or recipe from the user safe catalog matching remaining calorie and protein needs.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mealFocus: {
        type: Type.STRING,
        description: 'Focus such as high_protein, budget, or light_dinner',
      },
    },
    required: ['mealFocus'],
  },
};

function getGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function toSdkThinkingLevel(
  model: GeminiChatModel,
  level: GeminiThinkingLevel
): ThinkingLevel {
  if (model === 'gemini-3.1-flash-lite') {
    return level === 'MINIMAL' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  }
  switch (level) {
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'XHIGH':
      return ThinkingLevel.XHIGH;
    case 'HIGH':
    default:
      return ThinkingLevel.HIGH;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Clinical Codex endpoint (Pillar 1)
  app.get('/api/codex/latest', (_req, res) => {
    try {
      const codexPath = path.resolve(__dirname, 'public', 'codex', 'v1.json');
      const raw = fs.readFileSync(codexPath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(raw);
    } catch {
      res.status(500).json({ error: 'Clinical codex unavailable' });
    }
  });

  // Cloud Sync & Restore Vault + Plan Sharing (persisted in tmp JSON with Map cache)
  const vaultFile = path.join(os.tmpdir(), 'thesystem-cloud-vault.json');
  const cloudVault = new Map<string, { snapshot: unknown; syncedAt: string; cloudId: string }>();
  try {
    if (fs.existsSync(vaultFile)) {
      const saved = JSON.parse(fs.readFileSync(vaultFile, 'utf-8')) as Record<
        string,
        { snapshot: unknown; syncedAt: string; cloudId: string }
      >;
      Object.entries(saved).forEach(([k, v]) => cloudVault.set(k, v));
    }
  } catch {
    // Ignore malformed tmp cache
  }
  const persistVault = () => {
    try {
      fs.writeFileSync(vaultFile, JSON.stringify(Object.fromEntries(cloudVault.entries())), 'utf-8');
    } catch {
      // Ignore disk write issues
    }
  };

  app.post('/api/cloud/sync', (req, res) => {
    try {
      const { email, snapshot } = req.body || {};
      const key = String(email || '').trim().toLowerCase();
      if (!key || !snapshot || typeof snapshot !== 'object') {
        res.status(400).json({ ok: false, error: 'Valid email and snapshot are required.' });
        return;
      }
      const syncedAt = new Date().toISOString();
      const cloudId = `CLD-${Math.abs(Array.from(key).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase()}`;
      cloudVault.set(key, { snapshot, syncedAt, cloudId });
      persistVault();
      res.json({ ok: true, syncedAt, cloudId });
    } catch {
      res.status(500).json({ ok: false, error: 'Cloud sync failed.' });
    }
  });

  app.get('/api/cloud/restore', (req, res) => {
    const key = String(req.query.email || '').trim().toLowerCase();
    if (!key) {
      res.status(400).json({ ok: false, error: 'Email query parameter is required.' });
      return;
    }
    const entry = cloudVault.get(key);
    if (!entry) {
      res.status(404).json({ ok: false, error: 'No cloud backup found for this account yet.' });
      return;
    }
    res.json({ ok: true, ...entry });
  });

  app.post('/api/share', (req, res) => {
    try {
      const { recipient = '', senderName = 'Member', summary = '' } = req.body || {};
      const cleanRecipient = String(recipient).trim() || 'Shared Link';
      if (!String(summary).trim()) {
        res.status(400).json({ ok: false, error: 'Plan summary is required.' });
        return;
      }
      const shareId = `SHR-${Date.now().toString(36).toUpperCase()}`;
      const sentAt = new Date().toISOString();
      res.json({ ok: true, shareId, sentAt, recipient: cleanRecipient, senderName });
    } catch {
      res.status(500).json({ ok: false, error: 'Unable to send wellness plan.' });
    }
  });

  // Two-Way Smartwatch Companion & Webhook Bridge (Apple Watch Shortcuts / Wear OS / Companion Window)
  const watchBridgeFile = path.join(os.tmpdir(), 'thesystem-watch-bridge.json');
  const watchBridgeStore = new Map<
    string,
    { snapshot: unknown; pendingActions: Array<Record<string, unknown>>; updatedAt: string }
  >();
  try {
    if (fs.existsSync(watchBridgeFile)) {
      const saved = JSON.parse(fs.readFileSync(watchBridgeFile, 'utf-8')) as Record<
        string,
        { snapshot: unknown; pendingActions: Array<Record<string, unknown>>; updatedAt: string }
      >;
      Object.entries(saved).forEach(([k, v]) => watchBridgeStore.set(k, v));
    }
  } catch {
    // Ignore malformed cache
  }
  const persistWatchBridge = () => {
    try {
      fs.writeFileSync(
        watchBridgeFile,
        JSON.stringify(Object.fromEntries(watchBridgeStore.entries())),
        'utf-8'
      );
    } catch {
      // Ignore write failures
    }
  };

  app.post('/api/watch/pair', (req, res) => {
    const rawCode = String(req.body?.code || '').trim().toUpperCase();
    const code =
      rawCode ||
      Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const existing = watchBridgeStore.get(code) || {
      snapshot: null,
      pendingActions: [],
      updatedAt: new Date().toISOString(),
    };
    watchBridgeStore.set(code, existing);
    persistWatchBridge();
    res.json({ ok: true, code });
  });

  app.post('/api/watch/state', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const snapshot = req.body?.snapshot;
    if (!code || !snapshot || typeof snapshot !== 'object') {
      res.status(400).json({ ok: false, error: 'Pairing code and snapshot are required.' });
      return;
    }
    const existing = watchBridgeStore.get(code);
    watchBridgeStore.set(code, {
      snapshot,
      pendingActions: existing?.pendingActions || [],
      updatedAt: new Date().toISOString(),
    });
    persistWatchBridge();
    res.json({ ok: true, code, updatedAt: new Date().toISOString() });
  });

  app.get('/api/watch/state', (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Pairing code query parameter is required.' });
      return;
    }
    const entry = watchBridgeStore.get(code);
    if (!entry?.snapshot) {
      res.status(404).json({ ok: false, error: 'No watch state synced for this code yet.' });
      return;
    }
    res.json({ ok: true, code, snapshot: entry.snapshot, updatedAt: entry.updatedAt });
  });

  app.post('/api/watch/action', (req, res) => {
    const code = String(req.body?.code || req.query.code || '').trim().toUpperCase();
    const actionBody = req.body?.action || req.body;
    const type = String(actionBody?.type || '').trim();
    if (!code || !type) {
      res.status(400).json({ ok: false, error: 'Pairing code and action type are required.' });
      return;
    }
    const existing = watchBridgeStore.get(code) || {
      snapshot: null,
      pendingActions: [],
      updatedAt: new Date().toISOString(),
    };
    const event = {
      id: String(actionBody?.id || `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      type,
      amount: typeof actionBody?.amount === 'number' ? actionBody.amount : undefined,
      comboIdx: typeof actionBody?.comboIdx === 'number' ? actionBody.comboIdx : undefined,
      steps: typeof actionBody?.steps === 'number' ? actionBody.steps : undefined,
      sleep: typeof actionBody?.sleep === 'number' ? actionBody.sleep : undefined,
      hrvMs: typeof actionBody?.hrvMs === 'number' ? actionBody.hrvMs : undefined,
      rhrBpm: typeof actionBody?.rhrBpm === 'number' ? actionBody.rhrBpm : undefined,
      source: String(actionBody?.source || 'watch'),
      ts: Date.now(),
    };
    existing.pendingActions = [...existing.pendingActions.slice(-24), event];
    existing.updatedAt = new Date().toISOString();
    watchBridgeStore.set(code, existing);
    persistWatchBridge();
    res.json({ ok: true, queued: event });
  });

  app.get('/api/watch/actions', (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Pairing code query parameter is required.' });
      return;
    }
    const entry = watchBridgeStore.get(code);
    if (!entry) {
      res.json({ ok: true, actions: [] });
      return;
    }
    const actions = entry.pendingActions || [];
    if (actions.length > 0) {
      entry.pendingActions = [];
      watchBridgeStore.set(code, entry);
      persistWatchBridge();
    }
    res.json({ ok: true, actions });
  });

  app.get('/api/watch/stream', (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const entry = code ? watchBridgeStore.get(code) : undefined;
    if (entry?.snapshot) {
      res.write(`event: snapshot\ndata: ${JSON.stringify(entry.snapshot)}\n\n`);
    } else {
      res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, code })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  app.post('/api/watch/command', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const type = String(req.body?.type || '').trim();
    if (!code || !type) {
      res.status(400).json({ ok: false, error: 'Pairing code and command type are required.' });
      return;
    }
    const existing = watchBridgeStore.get(code) || {
      snapshot: null,
      pendingActions: [],
      updatedAt: new Date().toISOString(),
    };
    const event = {
      id: String(req.body?.id || `wcmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      type,
      payload: req.body?.payload,
      source: String(req.body?.source || 'standalone_watch_app'),
      ts: Date.now(),
    };
    existing.pendingActions = [...existing.pendingActions.slice(-24), event];
    existing.updatedAt = new Date().toISOString();
    watchBridgeStore.set(code, existing);
    persistWatchBridge();
    res.json({ ok: true, queued: event });
  });

  // Grounded Gemini AI Coach endpoint with Google Search Grounding + Function Calling
  app.post('/api/coach', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        code: 'NO_API_KEY',
        error:
          'Live Gemini AI Search requires GEMINI_API_KEY in Settings > Secrets. Using offline clinical coach.',
      });
      return;
    }

    try {
      const {
        question = '',
        profileSummary = {},
        dailyTelemetry = {},
        safeRecipes = [],
        safeFoods = [],
      } = req.body || {};

      if (!String(question).trim()) {
        res.status(400).json({ ok: false, error: 'Question is required.' });
        return;
      }

      const systemInstruction = [
        'You are the clinical wellness coach inside The System.',
        'Use the Plain English & 3-Second Rule: bold key takeaway first, 2-4 crisp sentences, zero dense medical jargon.',
        'STRICT ALLERGY RULE: NEVER mention or suggest any food or ingredient matching the user allergies list.',
        `User profile: ${JSON.stringify(profileSummary)}.`,
        `Today telemetry: ${JSON.stringify(dailyTelemetry)}.`,
        'Use read_biometrics when user asks about tiredness/sleep/readiness, schedule_calendar_workout when user mentions meetings/calendar/scheduling, find_allergen_safe_meal when user asks what to eat, and googleSearch for food nutrition or maternal safety fact-checks.',
      ].join(' ');

      const tools = [
        { googleSearch: {} },
        {
          functionDeclarations: [
            readBiometricsTool,
            scheduleCalendarWorkoutTool,
            findSafeMealTool,
          ],
        },
      ];
      const toolConfig = { includeServerSideToolInvocations: true };

      const contents: Array<Record<string, unknown>> = [
        { role: 'user', parts: [{ text: String(question).trim() }] },
      ];

      let response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contents as never,
        config: {
          systemInstruction,
          tools,
          toolConfig,
        } as never,
      });

      let suggestedFood: Record<string, unknown> | undefined;
      let calendarUrl: string | undefined;
      let actionType: 'log_food' | 'add_circuit' | 'add_walk' | 'open_calendar' | 'enable_min_due' =
        'add_walk';
      let actionLabel = '+ Add 5-Min Post-Meal Walk';
      const toolsUsed: string[] = [];

      const firstContent = response.candidates?.[0]?.content;
      const functionCalls = response.functionCalls;

      if (firstContent && functionCalls && functionCalls.length > 0) {
        const fnResponses: Array<Record<string, unknown>> = [];

        for (const call of functionCalls) {
          toolsUsed.push(call.name || 'tool');
          if (call.name === 'read_biometrics') {
            const sleepHrs = Number(dailyTelemetry?.sleepHours || 0);
            if (sleepHrs > 0 && sleepHrs < 6) {
              actionType = 'enable_min_due';
              actionLabel = 'Switch Today to Minimum Due';
            }
            fnResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { biometrics: dailyTelemetry },
              },
            });
          } else if (call.name === 'schedule_calendar_workout') {
            const args = (call.args || {}) as Record<string, string>;
            const title = args.title || 'Express 20-Min Workout';
            const timeHHMM = (args.timeHHMM || '07:30').replace(':', '').padStart(4, '0');
            const hh = Number(timeHHMM.slice(0, 2)) || 7;
            const mm = timeHHMM.slice(2, 4) || '30';
            const dateISO = args.dateISO || new Date().toISOString().slice(0, 10);
            const dFormatted = dateISO.replace(/-/g, '');
            const endHour = String((hh + 1) % 24).padStart(2, '0');
            calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
              title
            )}&dates=${dFormatted}T${timeHHMM}00/${dFormatted}T${endHour}${mm}00&details=${encodeURIComponent(
              args.notes || 'Scheduled by The System AI Coach'
            )}`;
            actionType = 'open_calendar';
            actionLabel = `Add "${title}" to Google Calendar`;
            fnResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { scheduledTitle: title, calendarUrl },
              },
            });
          } else if (call.name === 'find_allergen_safe_meal') {
            const pick = (Array.isArray(safeRecipes) && safeRecipes[0]) ||
              (Array.isArray(safeFoods) && safeFoods[0]) || null;
            if (pick) {
              const isRecipe = Array.isArray(pick.macros);
              suggestedFood = isRecipe
                ? {
                    n: pick.name,
                    k: pick.macros[0],
                    p: pick.macros[1],
                    c: pick.macros[2],
                    f: pick.macros[3],
                    q: 1,
                  }
                : {
                    n: pick.name,
                    k: pick.kcal,
                    p: pick.p,
                    c: pick.c,
                    f: pick.f,
                    q: 1,
                  };
              actionType = 'log_food';
              actionLabel = `+ Log ${pick.name} (${suggestedFood.k} kcal)`;
            }
            fnResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { safeRecipes: safeRecipes.slice(0, 3), safeFoods: safeFoods.slice(0, 3) },
              },
            });
          }
        }

        contents.push(firstContent as Record<string, unknown>);
        contents.push({ role: 'user', parts: fnResponses });

        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: contents as never,
          config: {
            systemInstruction,
            tools,
            toolConfig,
          } as never,
        });
      }

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((ch: { web?: { title?: string; uri?: string } }) => ch.web)
        .filter((w): w is { title: string; uri: string } => Boolean(w?.uri))
        .slice(0, 4)
        .map((w) => ({ title: w.title || 'Verified Source', uri: w.uri }));

      res.json({
        ok: true,
        text: response.text || 'Here is your personalized guidance.',
        sources,
        toolsUsed,
        actionType,
        actionLabel,
        suggestedFood,
        calendarUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini AI request failed.';
      res.status(502).json({
        ok: false,
        code: 'UPSTREAM_ERROR',
        error: msg,
      });
    }
  });

  // Multi-Turn Gemini Chatbot endpoint with role systemInstruction & complexity routing
  app.post('/api/chat', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        code: 'NO_API_KEY',
        error:
          'Gemini Chat requires GEMINI_API_KEY in Settings > Secrets. Add or check your key there to chat live.',
      });
      return;
    }

    try {
      const {
        message = '',
        history = [],
        roleId: rawRoleId = 'wellness_coach',
        routingMode: rawRoutingMode = 'auto',
        profileSummary = {},
        dailyTelemetry = {},
        safeMealNames = [],
      } = req.body || {};

      const cleanMessage = String(message).trim();
      if (!cleanMessage) {
        res.status(400).json({ ok: false, code: 'EMPTY_MESSAGE', error: 'Message is required.' });
        return;
      }

      const roleId = isValidChatbotRole(rawRoleId) ? rawRoleId : 'wellness_coach';
      const routingMode = isValidRoutingMode(rawRoutingMode) ? rawRoutingMode : 'auto';
      const sanitizedHistory = sanitizeChatHistory(Array.isArray(history) ? history : [], 20);
      const { model, thinkingLevel, tierLabel } = resolveChatModelAndThinking(
        cleanMessage,
        roleId,
        routingMode,
        sanitizedHistory.length
      );

      if (!ALLOWED_GEMINI_CHAT_MODELS.includes(model)) {
        res.status(400).json({ ok: false, code: 'INVALID_MODEL', error: 'Unsupported model.' });
        return;
      }

      const systemInstruction = buildChatbotSystemInstruction(roleId, {
        profileSummary,
        dailyTelemetry,
        safeMealNames,
      });

      const chatConfig: Record<string, unknown> = {
        systemInstruction,
      };
      if (routingMode !== 'general') {
        chatConfig.thinkingConfig = {
          thinkingLevel: toSdkThinkingLevel(model, thinkingLevel),
        };
      }

      const chat = ai.chats.create({
        model,
        history: sanitizedHistory as Content[],
        config: chatConfig,
      });

      const sendWithTimeout = async () => {
        const timeoutMs = routingMode === 'deep' ? 28000 : 18000;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            chat.sendMessage({ message: cleanMessage }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error(`UPSTREAM_TIMEOUT: Gemini took longer than ${timeoutMs / 1000}s.`)),
                timeoutMs
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      let response;
      try {
        response = await sendWithTimeout();
      } catch (firstErr) {
        const firstMsg = firstErr instanceof Error ? firstErr.message : '';
        const isTransient =
          /503|500|ECONNRESET|unavailable/i.test(firstMsg) &&
          !/429|RESOURCE_EXHAUSTED|quota|UPSTREAM_TIMEOUT/i.test(firstMsg);
        if (!isTransient) throw firstErr;
        await new Promise((r) => setTimeout(r, 450));
        response = await sendWithTimeout();
      }

      const replyText = (response.text || '').trim();
      if (!replyText) {
        res.status(502).json({
          ok: false,
          code: 'EMPTY_RESPONSE',
          error: 'Gemini returned an empty response. Please try rephrasing your question.',
        });
        return;
      }

      res.json({
        ok: true,
        reply: replyText,
        roleId,
        modelUsed: model,
        thinkingLevel,
        tierLabel,
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Gemini chat request failed.';
      let cleanMsg = rawMsg;
      try {
        const jsonStart = rawMsg.indexOf('{');
        if (jsonStart >= 0) {
          const parsed = JSON.parse(rawMsg.slice(jsonStart)) as {
            error?: { message?: string; code?: number; status?: string };
          };
          if (parsed?.error?.message) {
            cleanMsg = parsed.error.message;
          }
        }
      } catch {
        // Keep rawMsg if not JSON
      }

      if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(rawMsg)) {
        res.status(403).json({
          ok: false,
          code: 'API_KEY_INVALID',
          error:
            'Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (/RESOURCE_EXHAUSTED|429|quota/i.test(rawMsg)) {
        res.status(429).json({
          ok: false,
          code: 'RATE_LIMITED',
          error:
            'Gemini API quota or rate limit was reached for this model. Try Fast mode (Gemini 3.1 Flash-Lite) or check billing/quota in Settings > Secrets.',
        });
        return;
      }
      if (/503|UNAVAILABLE|high demand/i.test(rawMsg)) {
        res.status(503).json({
          ok: false,
          code: 'MODEL_UNAVAILABLE',
          error: `${cleanMsg} You can retry or switch to Fast mode (Gemini 3.1 Flash-Lite).`,
        });
        return;
      }
      res.status(502).json({
        ok: false,
        code: 'UPSTREAM_ERROR',
        error: cleanMsg,
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
