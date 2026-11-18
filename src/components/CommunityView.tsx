import React, { useState } from 'react';
import { Flame, Heart, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { PEERS, type PeerProfile } from '../data/foods';
import type { AppState, StoryItem } from '../types/system';
import { getGoalProgress, getLevelInfo, getRank } from '../utils/metabolic';
import { resolveAuthorStreak } from '../utils/onboarding';
import { THEME_COPY, todayISO } from '../utils/storage';
import { ProgressBar } from './ProgressBar';

interface CommunityViewProps {
  state: AppState;
  onCreatePost: (text: string, isTip: boolean, mediaUrl?: string) => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, comment: string) => void;
  onDeletePost: (postId: string) => void;
  onAddStory: (text: string, mediaUrl?: string) => void;
  onViewStory: (story: StoryItem) => void;
  onSendChat: (channel: 'g' | 'v', message: string) => void;
  onCheerPeer: (peerName: string) => void;
}

const timeAgo = (ts: number) => {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
};

export const CommunityView: React.FC<CommunityViewProps> = ({
  state,
  onCreatePost,
  onToggleLike,
  onAddComment,
  onDeletePost,
  onAddStory,
  onViewStory,
  onSendChat,
  onCheerPeer,
}) => {
  const copy = THEME_COPY[state.theme];
  const [subView, setSubView] = useState<'feed' | 'chat'>('feed');
  const [chatChannel, setChatChannel] = useState<'g' | 'v'>('g');
  const [postText, setPostText] = useState('');
  const [postTip, setPostTip] = useState(false);
  const [postMedia, setPostMedia] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState('');
  const [storyDraft, setStoryDraft] = useState('');
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [comparePeer, setComparePeer] = useState<PeerProfile | null>(null);

  const pubName = state.priv.name ? state.p.name : 'Anonymous Member';
  const myLevel = getLevelInfo(state.xp).l;
  const myGoalPct = getGoalProgress(state, todayISO());
  const myPeer: PeerProfile = {
    name: `${pubName} (You)`,
    lv: myLevel,
    stats: [
      state.stats.STR,
      state.stats.AGI,
      state.stats.INT,
      state.stats.VIT,
      state.stats.SEN,
    ],
    streak: state.streak,
    goalPct: myGoalPct,
  };

  const leaderboard = [...PEERS, ...(state.priv.on ? [myPeer] : [])].sort((a, b) => b.lv - a.lv);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const activeStories = state.stories.filter((s) => Date.now() - s.ts < 86400_000);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left / Primary Column: Feed or Chat */}
      <div className="space-y-6 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold">{copy.communityTitle}</h1>
          <div
            className="inline-flex rounded-xl p-1"
            style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
          >
            <button
              type="button"
              onClick={() => setSubView('feed')}
              className="min-h-[38px] rounded-lg px-4 text-xs font-semibold"
              style={{
                backgroundColor: subView === 'feed' ? 'var(--sys-primary)' : 'transparent',
                color: subView === 'feed' ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
              }}
            >
              Feed &amp; Stories
            </button>
            <button
              type="button"
              onClick={() => setSubView('chat')}
              className="min-h-[38px] rounded-lg px-4 text-xs font-semibold"
              style={{
                backgroundColor: subView === 'chat' ? 'var(--sys-primary)' : 'transparent',
                color: subView === 'chat' ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
              }}
            >
              Group Chat
            </button>
          </div>
        </div>

        {subView === 'feed' ? (
          <>
            {/* 24h Stories Strip */}
            <div className="sys-card p-4">
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setShowStoryForm((v) => !v)}
                  className="flex min-w-[68px] flex-col items-center gap-1 text-center"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2"
                    style={{ borderColor: 'var(--sys-primary)', color: 'var(--sys-primary)' }}
                  >
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                    Your Story
                  </span>
                </button>

                {activeStories.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onViewStory(st)}
                    className="flex min-w-[68px] flex-col items-center gap-1 text-center"
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold"
                      style={{
                        borderColor: 'var(--sys-secondary)',
                        backgroundColor: 'var(--sys-surface-high)',
                      }}
                    >
                      {st.mediaUrl ? (
                        <img
                          src={st.mediaUrl}
                          alt={st.u}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        st.u[0]
                      )}
                    </span>
                    <span className="max-w-[68px] truncate text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      {st.u}
                    </span>
                  </button>
                ))}
              </div>

              {showStoryForm && (
                <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--sys-border)' }}>
                  <input
                    type="text"
                    value={storyDraft}
                    onChange={(e) => setStoryDraft(e.target.value)}
                    placeholder="Quick 24h update…"
                    maxLength={80}
                    className="sys-input flex-1 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!storyDraft.trim()) return;
                      onAddStory(storyDraft.trim());
                      setStoryDraft('');
                      setShowStoryForm(false);
                    }}
                    className="sys-btn-primary min-h-[38px] px-4 text-xs"
                  >
                    Share Story
                  </button>
                </div>
              )}
            </div>

            {/* Post Composer */}
            <div className="sys-card p-5">
              <div className="mb-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold">{pubName}</span>
                <span
                  className="font-mono-num inline-flex items-center gap-1 font-semibold"
                  style={{ color: 'var(--sys-warn)' }}
                  aria-label={`Your current streak is ${state.streak} days`}
                >
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{state.streak}d streak</span>
                </span>
              </div>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share a workout PR, meal idea, or wellness reflection…"
                maxLength={280}
                rows={3}
                className="sys-input w-full p-3 text-sm"
              />
              {postMedia && (
                <img
                  src={postMedia}
                  alt="Post attachment preview"
                  referrerPolicy="no-referrer"
                  className="sys-media-img mt-2 max-h-48 w-full rounded-lg object-cover"
                />
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="sys-btn-secondary inline-flex min-h-[38px] cursor-pointer items-center px-3 text-xs">
                    Add Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleImagePick(e, setPostMedia)}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={postTip}
                      onChange={(e) => setPostTip(e.target.checked)}
                      className="h-4 w-4 accent-[var(--sys-secondary)]"
                    />
                    <span>Mark as Tip</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!postText.trim() && !postMedia) return;
                    onCreatePost(postText.trim(), postTip, postMedia || undefined);
                    setPostText('');
                    setPostTip(false);
                    setPostMedia('');
                  }}
                  className="sys-btn-primary min-h-[40px] px-5 text-xs"
                >
                  Post Update
                </button>
              </div>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
              {state.feed.map((post) => {
                const postStreak = resolveAuthorStreak(post.u, state, {
                  isCurrentUser: post.me,
                  fallbackStreak: post.authorStreak,
                });
                return (
                <article key={post.id} className="sys-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span>{post.u}</span>
                      <span
                        className="font-mono-num inline-flex items-center gap-0.5 text-xs font-semibold"
                        style={{ color: 'var(--sys-warn)' }}
                        aria-label={`${post.u} ${postStreak}-day streak`}
                      >
                        <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{postStreak}d</span>
                      </span>
                      {post.tip && (
                        <span className="font-mono-num text-xs" style={{ color: 'var(--sys-secondary)' }}>
                          · Tip
                        </span>
                      )}
                    </div>
                    <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {timeAgo(post.ts)}
                    </span>
                  </div>

                  {post.t && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.t}</p>}
                  {post.mediaUrl && (
                    <img
                      src={post.mediaUrl}
                      alt="Community post"
                      referrerPolicy="no-referrer"
                      className="sys-media-img mt-3 max-h-72 w-full rounded-xl object-cover"
                    />
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => onToggleLike(post.id)}
                        className="sys-btn-secondary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
                        style={{
                          color: post.likes.includes('me') ? 'var(--sys-danger)' : 'var(--sys-text)',
                        }}
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span className="font-mono-num">{post.likes.length}</span>
                      </button>
                      <span
                        className="font-mono-num inline-flex items-center gap-1 text-xs"
                        style={{ color: 'var(--sys-muted)' }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {post.cm.length}
                      </span>
                    </div>
                    {post.me && (
                      <button
                        type="button"
                        aria-label="Delete post"
                        onClick={() => onDeletePost(post.id)}
                        className="flex min-h-[36px] items-center gap-1 px-2 text-xs"
                        style={{ color: 'var(--sys-danger)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  {post.cm.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t pt-2.5 text-xs" style={{ borderColor: 'var(--sys-border)' }}>
                      {post.cm.map(([author, body], idx) => {
                        const commentStreak = resolveAuthorStreak(author, state, {
                          isCurrentUser: author === pubName || author === state.p.name,
                        });
                        return (
                        <div key={idx} className="flex flex-wrap items-baseline gap-1.5">
                          <strong style={{ color: 'var(--sys-text)' }}>{author}</strong>
                          <span
                            className="font-mono-num inline-flex items-center gap-0.5 text-[11px] font-semibold"
                            style={{ color: 'var(--sys-warn)' }}
                            aria-label={`${author} ${commentStreak}-day streak`}
                          >
                            <Flame className="h-3 w-3" aria-hidden="true" />
                            <span>{commentStreak}d</span>
                          </span>
                          <span style={{ color: 'var(--sys-muted)' }}>·</span>
                          <span>{body}</span>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      aria-label={`Comment on ${post.u}'s post`}
                      value={commentDrafts[post.id] || ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (commentDrafts[post.id] || '').trim()) {
                          onAddComment(post.id, commentDrafts[post.id].trim());
                          setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                        }
                      }}
                      placeholder="Write a comment…"
                      className="sys-input flex-1 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const text = (commentDrafts[post.id] || '').trim();
                        if (!text) return;
                        onAddComment(post.id, text);
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                      }}
                      className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
                    >
                      Send
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </>
        ) : (
          /* Group Chat View */
          <div className="sys-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChatChannel('g')}
                  className={`${chatChannel === 'g' ? 'sys-btn-primary' : 'sys-btn-secondary'} min-h-[38px] px-3 text-xs`}
                >
                  Global Lounge
                </button>
                <button
                  type="button"
                  onClick={() => setChatChannel('v')}
                  className={`${chatChannel === 'v' ? 'sys-btn-primary' : 'sys-btn-secondary'} min-h-[38px] px-3 text-xs`}
                >
                  Squad Check-In
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const summary = `Progress update: ${state.priv.rank ? `Lv ${myLevel} (Rank ${getRank(myLevel)}) · ` : ''}${state.streak}d streak${state.priv.prog ? ` · Goal ${myGoalPct}%` : ''}`;
                  onSendChat(chatChannel, summary);
                }}
                className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
              >
                Share Progress Card
              </button>
            </div>

            <div className="sys-card-nested mt-4 max-h-72 space-y-2.5 overflow-y-auto p-4 text-sm">
              {state.chat[chatChannel].map(([sender, msg], i) => (
                <div key={i}>
                  <strong className="text-xs" style={{ color: 'var(--sys-primary)' }}>
                    {sender}:{' '}
                  </strong>
                  <span>{msg}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    onSendChat(chatChannel, chatInput.trim());
                    setChatInput('');
                  }
                }}
                placeholder="Message group…"
                className="sys-input flex-1 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (!chatInput.trim()) return;
                  onSendChat(chatChannel, chatInput.trim());
                  setChatInput('');
                }}
                className="sys-btn-primary min-h-[40px] px-4 text-xs"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Leaderboard */}
      <div className="space-y-6 lg:col-span-5">
        <div className="sys-card p-5">
          <h2 className="font-display text-lg font-semibold">Community Leaderboard</h2>
          <div className="mt-3 space-y-2.5">
            {leaderboard.map((peer, idx) => {
              const isMe = peer.name.endsWith('(You)');
              return (
                <div
                  key={peer.name}
                  className="sys-card-nested flex flex-wrap items-center justify-between gap-2 p-3"
                  style={{
                    borderColor: isMe ? 'var(--sys-secondary)' : 'var(--sys-border)',
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold">
                      <span className="font-mono-num" style={{ color: 'var(--sys-primary)' }}>
                        #{idx + 1}
                      </span>{' '}
                      {peer.name}
                    </div>
                    <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {isMe && !state.priv.rank
                        ? 'Rank hidden'
                        : `Lv ${peer.lv} · Rank ${getRank(peer.lv)}`}{' '}
                      · {peer.streak}d streak
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setComparePeer(peer)}
                      className="sys-btn-secondary min-h-[36px] px-2.5 text-xs"
                    >
                      Compare
                    </button>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => onCheerPeer(peer.name)}
                        className="sys-btn-secondary min-h-[36px] px-2.5 text-xs"
                        style={{ color: 'var(--sys-secondary)' }}
                      >
                        Cheer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {comparePeer && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--sys-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">
                  You vs {comparePeer.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setComparePeer(null)}
                  className="text-xs underline"
                  style={{ color: 'var(--sys-muted)' }}
                >
                  Close
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {[
                  ['LVL', myPeer.lv, comparePeer.lv],
                  ['STR', myPeer.stats[0], comparePeer.stats[0]],
                  ['AGI', myPeer.stats[1], comparePeer.stats[1]],
                  ['INT', myPeer.stats[2], comparePeer.stats[2]],
                  ['VIT', myPeer.stats[3], comparePeer.stats[3]],
                  ['SEN', myPeer.stats[4], comparePeer.stats[4]],
                  ['STREAK', myPeer.streak, comparePeer.streak],
                  ['GOAL %', myPeer.goalPct, comparePeer.goalPct],
                ].map(([label, mine, theirs]) => (
                  <div key={String(label)} className="grid grid-cols-[1fr_64px_1fr] items-center gap-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={Number(mine)} max={Math.max(Number(mine), Number(theirs), 1)} />
                      <span className="font-mono-num w-8 text-right">{mine}</span>
                    </div>
                    <span className="font-mono-num text-center font-semibold" style={{ color: 'var(--sys-muted)' }}>
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num w-8">{theirs}</span>
                      <ProgressBar
                        value={Number(theirs)}
                        max={Math.max(Number(mine), Number(theirs), 1)}
                        tone="secondary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(state.b2b.crossGymEvents || []).filter((e) => e.active).length > 0 && (
          <div className="sys-card p-5">
            <h2 className="font-display text-base font-semibold">Cross-Gym Partner Battles</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
              Co-hosted inter-club and corporate team challenges synced from studio check-ins.
            </p>
            <div className="mt-3 space-y-3">
              {(state.b2b.crossGymEvents || [])
                .filter((e) => e.active)
                .map((ev) => {
                  const total = Math.max(1, ev.hostScore + ev.partnerScore);
                  const hostLeading = ev.hostScore >= ev.partnerScore;
                  return (
                    <div key={ev.id} className="sys-card-nested p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{ev.title}</span>
                        <span className="font-mono-num text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                          {ev.endsLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span style={{ color: hostLeading ? 'var(--sys-secondary)' : 'var(--sys-text)' }}>
                          <strong>{ev.hostOrgName}</strong> ({ev.hostScore.toLocaleString()} {ev.metric.toUpperCase()})
                        </span>
                        <span style={{ color: !hostLeading ? 'var(--sys-secondary)' : 'var(--sys-text)' }}>
                          <strong>{ev.partnerOrgName}</strong> ({ev.partnerScore.toLocaleString()} {ev.metric.toUpperCase()})
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={ev.hostScore} max={total} tone={hostLeading ? 'secondary' : 'primary'} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
