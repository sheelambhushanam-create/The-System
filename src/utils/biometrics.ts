export type BiometricMetricKey = 'weight' | 'waist' | 'neck' | 'hip';

export interface BiometricChartPoint {
  date: string;
  label: string;
  weight?: number;
  waist?: number;
  neck?: number;
  hip?: number;
  weightTrend?: number;
  waistTrend?: number;
  neckTrend?: number;
  hipTrend?: number;
}

export interface MetricSummary {
  key: BiometricMetricKey;
  latest: number | null;
  delta: number | null;
  slopePerWeek: number | null;
  count: number;
}

export interface BiometricSeriesResult {
  points: BiometricChartPoint[];
  summaries: Record<BiometricMetricKey, MetricSummary>;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const [, month, day] = parts;
  const monthLabel = MONTH_NAMES[(month - 1) % 12] || String(month);
  return `${monthLabel} ${day}`;
}

function dayEpoch(isoDate: string): number {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isNaN(ms) ? 0 : ms / 86_400_000;
}

function applyLinearTrend(
  points: BiometricChartPoint[],
  metricKey: BiometricMetricKey,
  trendKey: 'weightTrend' | 'waistTrend' | 'neckTrend' | 'hipTrend'
): MetricSummary {
  const valid = points
    .map((pt, idx) => ({
      idx,
      x: dayEpoch(pt.date) || idx,
      y: pt[metricKey],
    }))
    .filter((item): item is { idx: number; x: number; y: number } => typeof item.y === 'number' && item.y > 0);

  if (valid.length === 0) {
    return { key: metricKey, latest: null, delta: null, slopePerWeek: null, count: 0 };
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = valid.length >= 2 ? +(last.y - first.y).toFixed(1) : 0;

  if (valid.length < 2) {
    return {
      key: metricKey,
      latest: +last.y.toFixed(1),
      delta,
      slopePerWeek: null,
      count: valid.length,
    };
  }

  const baseX = first.x;
  const xs = valid.map((v) => v.x - baseX);
  const ys = valid.map((v) => v.y);
  const n = valid.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }

  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  points.forEach((pt, idx) => {
    const x = (dayEpoch(pt.date) || idx) - baseX;
    pt[trendKey] = +(intercept + slope * x).toFixed(1);
  });

  return {
    key: metricKey,
    latest: +last.y.toFixed(1),
    delta,
    slopePerWeek: +(slope * 7).toFixed(2),
    count: valid.length,
  };
}

export function buildMeasurementSeries(
  wt: Array<{ d: string; w: number }>,
  meas: Array<{ d: string; waist: number; neck: number; hip: number }>
): BiometricSeriesResult {
  const byDate = new Map<string, BiometricChartPoint>();

  const ensureDate = (d: string): BiometricChartPoint => {
    let existing = byDate.get(d);
    if (!existing) {
      existing = { date: d, label: formatShortDate(d) };
      byDate.set(d, existing);
    }
    return existing;
  };

  wt.forEach((entry) => {
    if (!entry.d || !(entry.w > 0)) return;
    const pt = ensureDate(entry.d);
    pt.weight = +entry.w.toFixed(1);
  });

  meas.forEach((entry) => {
    if (!entry.d) return;
    const pt = ensureDate(entry.d);
    if (entry.waist > 0) pt.waist = +entry.waist.toFixed(1);
    if (entry.neck > 0) pt.neck = +entry.neck.toFixed(1);
    if (entry.hip > 0) pt.hip = +entry.hip.toFixed(1);
  });

  const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const summaries: Record<BiometricMetricKey, MetricSummary> = {
    weight: applyLinearTrend(points, 'weight', 'weightTrend'),
    waist: applyLinearTrend(points, 'waist', 'waistTrend'),
    neck: applyLinearTrend(points, 'neck', 'neckTrend'),
    hip: applyLinearTrend(points, 'hip', 'hipTrend'),
  };

  return { points, summaries };
}
