import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import type { AppState, ThemeMode } from '../types/system';
import {
  buildMeasurementSeries,
  type BiometricMetricKey,
} from '../utils/biometrics';
import { todayISO } from '../utils/storage';

interface BiometricsChartCardProps {
  state: AppState;
  onLogBiometrics: (weight: number, waist: number, neck: number, hip: number, date?: string) => void;
}

interface MetricConfig {
  key: BiometricMetricKey;
  trendKey: 'weightTrend' | 'waistTrend' | 'neckTrend' | 'hipTrend';
  label: string;
  unit: 'kg' | 'cm';
  yAxisId: 'kg' | 'cm';
  colors: Record<ThemeMode, string>;
}

const METRICS: MetricConfig[] = [
  {
    key: 'weight',
    trendKey: 'weightTrend',
    label: 'Weight',
    unit: 'kg',
    yAxisId: 'kg',
    colors: {
      clean: '#06b6d4',
      women: '#f472b6',
      rpg: '#00e5ff',
    },
  },
  {
    key: 'waist',
    trendKey: 'waistTrend',
    label: 'Waist',
    unit: 'cm',
    yAxisId: 'cm',
    colors: {
      clean: '#10b981',
      women: '#34d399',
      rpg: '#fbbf24',
    },
  },
  {
    key: 'neck',
    trendKey: 'neckTrend',
    label: 'Neck',
    unit: 'cm',
    yAxisId: 'cm',
    colors: {
      clean: '#f59e0b',
      women: '#fb923c',
      rpg: '#ff3366',
    },
  },
  {
    key: 'hip',
    trendKey: 'hipTrend',
    label: 'Hip',
    unit: 'cm',
    yAxisId: 'cm',
    colors: {
      clean: '#a78bfa',
      women: '#c084fc',
      rpg: '#a855f7',
    },
  },
];

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: { date: string };
}

const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const fullDate = payload[0]?.payload?.date || label;

  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-lg"
      style={{
        backgroundColor: 'var(--sys-surface)',
        borderColor: 'var(--sys-border-strong)',
        color: 'var(--sys-text)',
      }}
    >
      <div className="font-mono-num mb-1.5 font-semibold" style={{ color: 'var(--sys-muted)' }}>
        {label} ({fullDate})
      </div>
      <div className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey || item.name);
          const isTrend = key.endsWith('Trend');
          const unit = key.startsWith('weight') ? 'kg' : 'cm';
          return (
            <div key={key} className="font-mono-num flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    opacity: isTrend ? 0.6 : 1,
                  }}
                />
                <span style={{ color: isTrend ? 'var(--sys-muted)' : 'var(--sys-text)' }}>
                  {item.name}
                </span>
              </span>
              <span className="font-semibold">
                {item.value} {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BiometricsChartCard: React.FC<BiometricsChartCardProps> = ({
  state,
  onLogBiometrics,
}) => {
  const { points, summaries } = useMemo(
    () => buildMeasurementSeries(state.wt, state.meas),
    [state.wt, state.meas]
  );

  const [visible, setVisible] = useState<Record<BiometricMetricKey, boolean>>({
    weight: true,
    waist: true,
    neck: true,
    hip: true,
  });
  const [showTrends, setShowTrends] = useState(true);
  const [showLogger, setShowLogger] = useState(false);

  const [logDate, setLogDate] = useState(todayISO());
  const [weightVal, setWeightVal] = useState('');
  const [waistVal, setWaistVal] = useState('');
  const [neckVal, setNeckVal] = useState('');
  const [hipVal, setHipVal] = useState('');

  const showKgAxis = visible.weight;
  const showCmAxis = visible.waist || visible.neck || visible.hip;

  const toggleMetric = (key: BiometricMetricKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.weight && !next.waist && !next.neck && !next.hip) {
        return prev;
      }
      return next;
    });
  };

  const handleSaveEntry = () => {
    const w = Number(weightVal) || 0;
    const waist = Number(waistVal) || 0;
    const neck = Number(neckVal) || 0;
    const hip = Number(hipVal) || 0;
    if (w <= 25 && waist <= 30 && neck <= 20 && hip <= 40) return;

    onLogBiometrics(w, waist, neck, hip, logDate || todayISO());
    setWeightVal('');
    setWaistVal('');
    setNeckVal('');
    setHipVal('');
    setShowLogger(false);
  };

  return (
    <section
      aria-label="Body measurements trend visualization"
      className="sys-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">
            Body Measurements &amp; Trend Analysis
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
            Weight (kg) and tape measurements (cm) plotted over time with linear regression trend lines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showTrends}
            onClick={() => setShowTrends((v) => !v)}
            className="sys-btn-secondary min-h-[38px] px-3 text-xs font-semibold"
            style={{
              borderColor: showTrends ? 'var(--sys-primary)' : 'var(--sys-border)',
              color: showTrends ? 'var(--sys-primary)' : 'var(--sys-muted)',
            }}
          >
            {showTrends ? 'Trend Lines: On' : 'Trend Lines: Off'}
          </button>

          <button
            type="button"
            onClick={() => setShowLogger((v) => !v)}
            className="sys-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showLogger ? 'Close Logger' : 'Log Check-In'}</span>
          </button>
        </div>
      </div>

      {/* Inline Biometrics Check-In Form */}
      {showLogger && (
        <div className="sys-card-nested mt-4 p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="prof-bio-date" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Date
              </label>
              <input
                id="prof-bio-date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="sys-input w-full px-2.5 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="prof-bio-w" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Weight (kg)
              </label>
              <input
                id="prof-bio-w"
                type="number"
                step="0.1"
                value={weightVal}
                onChange={(e) => setWeightVal(e.target.value)}
                placeholder={String(summaries.weight.latest ?? state.p.w)}
                className="sys-input w-full px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prof-bio-waist" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Waist (cm)
              </label>
              <input
                id="prof-bio-waist"
                type="number"
                step="0.1"
                value={waistVal}
                onChange={(e) => setWaistVal(e.target.value)}
                placeholder={String(summaries.waist.latest ?? 84)}
                className="sys-input w-full px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prof-bio-neck" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Neck (cm)
              </label>
              <input
                id="prof-bio-neck"
                type="number"
                step="0.1"
                value={neckVal}
                onChange={(e) => setNeckVal(e.target.value)}
                placeholder={String(summaries.neck.latest ?? 38)}
                className="sys-input w-full px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prof-bio-hip" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Hip (cm)
              </label>
              <input
                id="prof-bio-hip"
                type="number"
                step="0.1"
                value={hipVal}
                onChange={(e) => setHipVal(e.target.value)}
                placeholder={String(summaries.hip.latest ?? 98)}
                className="sys-input w-full px-2.5 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSaveEntry}
              className="sys-btn-primary min-h-[38px] px-4 text-xs"
            >
              Save Measurements
            </button>
          </div>
        </div>
      )}

      {/* 4 Interactive Metric Summary Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {METRICS.map((m) => {
          const summary = summaries[m.key];
          const active = visible[m.key];
          const stroke = m.colors[state.theme];
          const hasDelta = summary.delta !== null && summary.count >= 2;

          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleMetric(m.key)}
              className="sys-card-nested flex flex-col items-start p-3 text-left transition-opacity"
              style={{
                borderColor: active ? stroke : 'var(--sys-border)',
                opacity: active ? 1 : 0.48,
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stroke }}
                  />
                  {m.label}
                </span>
                {hasDelta && (
                  <span
                    className="font-mono-num inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold"
                    style={{
                      color:
                        (summary.delta ?? 0) <= 0 ? 'var(--sys-secondary)' : 'var(--sys-warn)',
                    }}
                  >
                    {(summary.delta ?? 0) <= 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {(summary.delta ?? 0) > 0 ? `+${summary.delta}` : summary.delta} {m.unit}
                  </span>
                )}
              </div>

              <div className="font-mono-num mt-1.5 text-lg font-bold">
                {summary.latest !== null ? `${summary.latest} ${m.unit}` : '—'}
              </div>

              <div className="font-mono-num mt-0.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                {summary.slopePerWeek !== null
                  ? `Trend: ${summary.slopePerWeek > 0 ? '+' : ''}${summary.slopePerWeek} ${m.unit}/wk`
                  : summary.count === 1
                    ? 'Log 1 more entry for trend'
                    : 'No entries logged'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Recharts Multi-Metric Chart */}
      <div className="sys-card-nested mt-4 p-3 sm:p-4">
        {points.length === 0 ? (
          <div
            className="flex h-[240px] flex-col items-center justify-center text-center text-xs"
            style={{ color: 'var(--sys-muted)' }}
          >
            <p>No measurements recorded yet.</p>
            <p className="mt-1">Use &ldquo;Log Check-In&rdquo; above to plot your weight, waist, neck, and hip trends.</p>
          </div>
        ) : (
          <div className="h-[290px] w-full sm:h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 12, right: showCmAxis ? 10 : 18, left: showKgAxis ? 4 : 16, bottom: 8 }}
              >
                <CartesianGrid stroke="var(--sys-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  padding={{ left: 16, right: 16 }}
                  stroke="var(--sys-muted)"
                  tick={{ fill: 'var(--sys-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--sys-border)' }}
                />

                {showKgAxis && (
                  <YAxis
                    yAxisId="kg"
                    orientation="left"
                    domain={[
                      (dataMin: number) => Math.floor(dataMin - 2),
                      (dataMax: number) => Math.ceil(dataMax + 2),
                    ]}
                    allowDecimals={false}
                    stroke="var(--sys-muted)"
                    tick={{ fill: 'var(--sys-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v) => `${v}kg`}
                  />
                )}

                {showCmAxis && (
                  <YAxis
                    yAxisId="cm"
                    orientation="right"
                    domain={[
                      (dataMin: number) => Math.floor(dataMin - 4),
                      (dataMax: number) => Math.ceil(dataMax + 4),
                    ]}
                    allowDecimals={false}
                    stroke="var(--sys-muted)"
                    tick={{ fill: 'var(--sys-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => `${v}cm`}
                  />
                )}

                <Tooltip content={<CustomChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  iconType="plainline"
                />

                {METRICS.map((m) => {
                  if (!visible[m.key]) return null;
                  const stroke = m.colors[state.theme];
                  const hasTrend = showTrends && summaries[m.key].count >= 2;

                  return (
                    <React.Fragment key={m.key}>
                      <Line
                        yAxisId={m.yAxisId}
                        type="monotone"
                        dataKey={m.key}
                        name={`${m.label} (${m.unit})`}
                        stroke={stroke}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: stroke, strokeWidth: 1.5, stroke: 'var(--sys-bg)' }}
                        activeDot={{ r: 6 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                      {hasTrend && (
                        <Line
                          yAxisId={m.yAxisId}
                          type="linear"
                          dataKey={m.trendKey}
                          name={`${m.label} Trend`}
                          stroke={stroke}
                          strokeOpacity={0.65}
                          strokeWidth={1.75}
                          strokeDasharray="5 4"
                          dot={false}
                          activeDot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
};
