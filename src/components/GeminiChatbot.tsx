import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import { FOODS, RECIPES, getSafeFoods, getSafeRecipes } from '../data/foods';
import type { AppState } from '../types/system';
import {
  CHATBOT_ROLES,
  CHATBOT_ROUTING_OPTIONS,
  getChatbotRole,
  loadPersistedChatSession,
  resolveChatModelAndThinking,
  savePersistedChatSession,
  type ChatTurnMessage,
  type ChatbotRoleId,
  type ChatbotRoutingMode,
} from '../utils/chatbot';
import { getAutonomicReadiness } from '../utils/clinical';
import type { ClinicalCodex } from '../utils/codex';
import { calculateMacros, isFemaleProfile, sumDailyMacros } from '../utils/metabolic';
import { todayISO } from '../utils/storage';

interface GeminiChatbotProps {
  state: AppState;
  codex: ClinicalCodex;
  onSwitchToOfflineCodex?: () => void;
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderFormattedReply(text: string): React.ReactNode {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`${keyPrefix}-ul`} className="my-1.5 space-y-1 pl-4 list-disc">
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineBold(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`l${idx}`);
      return;
    }

    const bulletMatch = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }

    flushList(`h${idx}`);

    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      const cleanHeading = headingMatch[1].replace(/\*\*/g, '');
      blocks.push(
        <div key={`hd-${idx}`} className="mt-2 mb-1 text-xs font-bold">
          {cleanHeading}
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className={idx > 0 ? 'mt-1.5' : undefined}>
        {renderInlineBold(line)}
      </p>
    );
  });

  flushList('end');
  return <>{blocks}</>;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  state,
  codex,
  onSwitchToOfflineCodex,
}) => {
  const initialSession = useMemo(() => loadPersistedChatSession(), []);
  const [roleId, setRoleId] = useState<ChatbotRoleId>(initialSession.roleId);
  const [routingMode, setRoutingMode] = useState<ChatbotRoutingMode>(initialSession.routingMode);
  const [messages, setMessages] = useState<ChatTurnMessage[]>(initialSession.messages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; retryPrompt?: string } | null>(
    null
  );

  const threadRef = useRef<HTMLDivElement | null>(null);
  const activeRole = useMemo(() => getChatbotRole(roleId), [roleId]);

  useEffect(() => {
    savePersistedChatSession({
      roleId,
      routingMode,
      messages,
    });
  }, [roleId, routingMode, messages]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading, errorInfo]);

  const previewRoute = useMemo(
    () => resolveChatModelAndThinking(draft || 'check', roleId, routingMode, messages.length),
    [draft, roleId, routingMode, messages.length]
  );

  const buildLiveContext = () => {
    const dateStr = todayISO();
    const macros = calculateMacros(state.p);
    const logged = sumDailyMacros(state.log[dateStr] || []);
    const readiness = getAutonomicReadiness(state, dateStr);
    const allergies = state.p.allergies || [];
    const safeRecipes = getSafeRecipes([...RECIPES, ...(codex.recipes || [])], allergies, {
      isFemaleOrWomen: isFemaleProfile(state.p) || state.theme === 'women',
      diet: state.p.diet,
    });
    const safeFoods = getSafeFoods(allergies, FOODS);

    return {
      profileSummary: {
        name: state.p.name,
        sex: state.p.sex,
        age: state.p.age,
        diet: state.p.diet,
        equipment: state.p.eq,
        stage: state.p.fstage,
        primaryGoal: state.p.primaryGoal,
        allergies,
        medicalHistory: state.p.medicalHistory || [],
      },
      dailyTelemetry: {
        steps: state.watch.steps,
        sleepHours: state.watch.sleep,
        hrvMs: readiness.hrvMs,
        rhrBpm: readiness.rhrBpm,
        streak: state.streak,
        remKcal: Math.max(0, macros.t - Math.round(logged.k)),
        remProt: Math.max(0, macros.pr - Math.round(logged.p)),
        waterLitres: Number(state.water[dateStr] || 0),
        minimumDueMode: Boolean(state.minimumDueDays?.[dateStr]),
      },
      safeMealNames: [
        ...safeRecipes.slice(0, 5).map((r) => r.name),
        ...safeFoods.slice(0, 4).map((f) => f.name),
      ],
    };
  };

  const sendMessage = async (
    rawText: string,
    options?: { isRetry?: boolean; overrideRouting?: ChatbotRoutingMode }
  ) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    const effectiveRouting = options?.overrideRouting ?? routingMode;
    if (options?.overrideRouting) {
      setRoutingMode(options.overrideRouting);
    }

    setErrorInfo(null);
    if (!options?.isRetry) {
      setDraft('');
    }

    const historySnapshot = options?.isRetry ? messages.slice(0, -1) : messages;
    const nextMessages: ChatTurnMessage[] = options?.isRetry
      ? messages
      : [
          ...messages,
          {
            id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'user',
            text: trimmed,
            timestamp: new Date().toISOString(),
            roleId,
          },
        ];

    if (!options?.isRetry) {
      setMessages(nextMessages);
    }

    setLoading(true);
    try {
      const ctx = buildLiveContext();
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historySnapshot.map((m) => ({ role: m.role, text: m.text })),
          roleId,
          routingMode: effectiveRouting,
          ...ctx,
        }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok || !data?.reply) {
        const errMsg =
          data?.error ||
          `Gemini Chat request failed (HTTP ${resp.status}). Please verify your connection or API key.`;
        setErrorInfo({ message: errMsg, retryPrompt: trimmed });
        return;
      }

      const modelMessage: ChatTurnMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'model',
        text: String(data.reply),
        timestamp: new Date().toISOString(),
        roleId,
        modelUsed: data.modelUsed,
        thinkingLevel: data.thinkingLevel,
        tierLabel: data.tierLabel,
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch {
      setErrorInfo({
        message: 'Network error reaching the Gemini Chat server. Check your connection and retry.',
        retryPrompt: trimmed,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearThread = () => {
    if (loading) return;
    setMessages([]);
    setErrorInfo(null);
  };

  return (
    <div className="mt-3 space-y-2.5" data-testid="gemini-chatbot-panel">
      {/* Role & Model Routing Controls */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
        <div>
          <label
            htmlFor="gemini-chat-role"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--sys-muted)' }}
          >
            Assistant Role (System Prompt)
          </label>
          <select
            id="gemini-chat-role"
            value={roleId}
            disabled={loading}
            onChange={(e) => setRoleId(e.target.value as ChatbotRoleId)}
            className="sys-input min-h-[38px] w-full px-2.5 py-1.5 text-xs font-medium"
          >
            {CHATBOT_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="gemini-chat-routing"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--sys-muted)' }}
          >
            Model &amp; Complexity Routing
          </label>
          <select
            id="gemini-chat-routing"
            value={routingMode}
            disabled={loading}
            onChange={(e) => setRoutingMode(e.target.value as ChatbotRoutingMode)}
            className="sys-input min-h-[38px] w-full px-2.5 py-1.5 text-xs font-medium"
          >
            {CHATBOT_ROUTING_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Role Summary + Clear Conversation */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[11px]"
        style={{
          backgroundColor: 'var(--sys-surface-lowest)',
          borderColor: 'var(--sys-border)',
          color: 'var(--sys-muted)',
        }}
      >
        <div className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold" style={{ color: 'var(--sys-text)' }}>
            {activeRole.shortLabel}:
          </span>{' '}
          <span>{activeRole.tagline}</span>
        </div>
        <button
          type="button"
          onClick={handleClearThread}
          disabled={loading || (messages.length === 0 && !errorInfo)}
          aria-label="Start new Gemini chat conversation"
          className="sys-btn-secondary inline-flex min-h-[30px] shrink-0 items-center gap-1 px-2.5 text-[11px] font-semibold disabled:opacity-45"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div
        ref={threadRef}
        role="log"
        aria-live="polite"
        aria-label="Gemini conversation history"
        data-testid="gemini-chat-thread"
        className="sys-card-nested h-[240px] space-y-3 overflow-y-auto p-3 sm:h-[320px] sm:p-3.5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-between gap-3 py-1">
            <div className="space-y-1.5">
              <div
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--sys-text)' }}
              >
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--sys-primary)' }}
                  aria-hidden="true"
                />
                <span>Multi-Turn {activeRole.label}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                Ask follow-up questions with full conversation memory. Responses adapt to your live
                steps, sleep, HRV, remaining macros, and declared allergies.
              </p>
            </div>

            <div className="space-y-1.5">
              <div
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--sys-muted)' }}
              >
                Suggested starters
              </div>
              <div className="flex flex-col gap-1.5">
                {activeRole.starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => sendMessage(prompt)}
                    className="sys-btn-secondary flex min-h-[36px] w-full items-center justify-between px-3 py-2 text-left text-xs font-medium disabled:opacity-50"
                  >
                    <span>{prompt}</span>
                    <Send className="ml-2 h-3 w-3 shrink-0 opacity-65" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const msgRole = getChatbotRole(m.roleId);
            return (
              <div
                key={m.id}
                data-testid={isUser ? 'chat-msg-user' : 'chat-msg-model'}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px]"
                  style={{ color: 'var(--sys-muted)' }}
                >
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="h-3 w-3" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <Bot
                        className="h-3 w-3"
                        style={{ color: 'var(--sys-primary)' }}
                        aria-hidden="true"
                      />
                      <span className="font-semibold" style={{ color: 'var(--sys-text)' }}>
                        {msgRole.shortLabel}
                      </span>
                      {m.modelUsed && (
                        <span className="font-mono-num">
                          · {m.modelUsed} ({m.tierLabel || m.thinkingLevel})
                        </span>
                      )}
                    </>
                  )}
                  {m.timestamp && (
                    <span className="font-mono-num opacity-75">
                      · {formatMessageTime(m.timestamp)}
                    </span>
                  )}
                </div>

                <div
                  className="max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                  style={{
                    backgroundColor: isUser ? 'var(--sys-primary)' : 'var(--sys-surface-high)',
                    color: isUser ? 'var(--sys-on-primary)' : 'var(--sys-text)',
                  }}
                >
                  {isUser ? (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  ) : (
                    renderFormattedReply(m.text)
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex flex-col items-start" data-testid="chat-loading-indicator">
            <div
              className="mb-1 flex items-center gap-1.5 text-[10px]"
              style={{ color: 'var(--sys-muted)' }}
            >
              <Bot
                className="h-3 w-3"
                style={{ color: 'var(--sys-primary)' }}
                aria-hidden="true"
              />
              <span>
                {activeRole.shortLabel} · {previewRoute.model} ({previewRoute.tierLabel})
              </span>
            </div>
            <div
              className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{
                backgroundColor: 'var(--sys-surface-high)',
                color: 'var(--sys-muted)',
              }}
            >
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Real API Error Display (no silent fake fallback) */}
      {errorInfo && (
        <div
          role="alert"
          data-testid="gemini-chat-error"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs"
          style={{
            borderColor: 'var(--sys-warn)',
            backgroundColor: 'var(--sys-surface-lowest)',
            color: 'var(--sys-text)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: 'var(--sys-warn)' }}
              aria-hidden="true"
            />
            <span>{errorInfo.message}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {errorInfo.retryPrompt && (
              <button
                type="button"
                onClick={() => sendMessage(errorInfo.retryPrompt!, { isRetry: true })}
                className="sys-btn-secondary min-h-[32px] px-2.5 text-[11px] font-semibold"
              >
                Retry
              </button>
            )}
            {errorInfo.retryPrompt && routingMode !== 'fast' && (
              <button
                type="button"
                onClick={() =>
                  sendMessage(errorInfo.retryPrompt!, {
                    isRetry: true,
                    overrideRouting: 'fast',
                  })
                }
                className="sys-btn-secondary min-h-[32px] px-2.5 text-[11px] font-semibold"
              >
                Try Fast Mode
              </button>
            )}
            {onSwitchToOfflineCodex && (
              <button
                type="button"
                onClick={onSwitchToOfflineCodex}
                className="sys-btn-secondary min-h-[32px] px-2.5 text-[11px] font-semibold"
              >
                Offline Codex
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-turn Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(draft);
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1">
          <label htmlFor="gemini-chat-input" className="sr-only">
            Message Gemini assistant
          </label>
          <textarea
            id="gemini-chat-input"
            rows={2}
            value={draft}
            disabled={loading}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(draft);
              }
            }}
            placeholder={`Ask ${activeRole.shortLabel}… (Enter to send)`}
            className="sys-input w-full resize-none px-3 py-2 text-sm leading-snug"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          aria-label="Send message to Gemini"
          className="sys-btn-primary inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-4 text-xs font-semibold disabled:opacity-45"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{loading ? 'Sending…' : 'Send'}</span>
        </button>
      </form>

      <div
        className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
        style={{ color: 'var(--sys-muted)' }}
      >
        <span>
          {messages.length} {messages.length === 1 ? 'message' : 'messages'} in thread · Saved
          locally
        </span>
        <span className="font-mono-num">
          Route: {previewRoute.model} ({previewRoute.thinkingLevel})
        </span>
      </div>
    </div>
  );
};
