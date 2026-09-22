import { useLayoutEffect, useRef, useState } from 'react';
import { formatDate } from '../lib/format';

export interface TrendPoint {
  key: number;
  date: string;
  value: number; // 0-100
  detail: string;
}

const HEIGHT = 200;
const M = { top: 14, right: 40, bottom: 26, left: 40 };
const TICKS = [0, 25, 50, 75, 100];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Single-series line of quiz scores (0-100%). One series, so no legend: the
 * card title names it. Hover or arrow keys move a crosshair with a tooltip; the
 * history table below it is the table view.
 */
export function TrendChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => M.top + plotH - (v / 100) * plotH;
  const step = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const showMarkers = step >= 14;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = points.length > 1 ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  const lastI = points.length - 1;
  const shown = active ?? null;

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - M.left;
    return Math.min(lastI, Math.max(0, Math.round(points.length === 1 ? 0 : px / step)));
  };

  return (
    <div
      ref={ref}
      className="relative select-none outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-accent"
      tabIndex={0}
      role="img"
      aria-label={`${label}. ${points.length} quizzes, latest ${Math.round(points[lastI]?.value ?? 0)}%. Use arrow keys to read each one.`}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') setActive(a => Math.max(0, (a ?? lastI + 1) - 1));
        else if (e.key === 'ArrowRight') setActive(a => Math.min(lastI, (a ?? -1) + 1));
        else if (e.key === 'Escape') setActive(null);
        else return;
        e.preventDefault();
      }}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block overflow-visible">
          {TICKS.map(t => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {t}%
              </text>
            </g>
          ))}

          {area && <path d={area} fill="var(--chart-line)" opacity={0.1} />}
          <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) =>
            showMarkers || i === lastI || i === shown ? (
              <circle key={p.key} cx={x(i)} cy={y(p.value)} r={4} fill="var(--chart-line)" stroke="var(--surface)" strokeWidth={2} />
            ) : null,
          )}

          {/* Direct label on the latest point only. */}
          {points.length > 0 && (
            <text x={x(lastI) + 8} y={y(points[lastI].value)} dy="0.32em" className="fill-fg text-xs font-semibold tabular-nums">
              {Math.round(points[lastI].value)}%
            </text>
          )}

          {/* X axis: first and last date only. */}
          {points.length > 0 && (
            <>
              <text x={x(0)} y={HEIGHT - 6} textAnchor={points.length === 1 ? 'middle' : 'start'} className="fill-muted text-[11px] tabular-nums">
                {formatDate(points[0].date).slice(5, 10)}
              </text>
              {points.length > 1 && (
                <text x={x(lastI)} y={HEIGHT - 6} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {formatDate(points[lastI].date).slice(5, 10)}
                </text>
              )}
            </>
          )}

          {shown !== null && (
            <line x1={x(shown)} x2={x(shown)} y1={M.top} y2={M.top + plotH} stroke="var(--muted)" strokeWidth={1} shapeRendering="crispEdges" />
          )}

          {/* Hit area: the whole plot, snapping to the nearest quiz. */}
          <rect
            x={M.left - step / 2}
            y={0}
            width={plotW + step}
            height={HEIGHT}
            fill="transparent"
            onPointerMove={e => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {shown !== null && points[shown] && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-56 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(shown), 90), width - 90) }}
        >
          <p className="text-base font-bold">{Math.round(points[shown].value)}%</p>
          <p className="text-muted">{points[shown].detail}</p>
          <p className="text-muted">{formatDate(points[shown].date)}</p>
        </div>
      )}
    </div>
  );
}
