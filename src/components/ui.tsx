import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'text-bad border border-bad/40 hover:bg-bad-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Button styles, also for links that should look like buttons. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cx(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150',
    'disabled:opacity-45 disabled:pointer-events-none cursor-pointer',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors',
        'hover:bg-surface-2 hover:text-fg cursor-pointer disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>;
}

type Tone = 'neutral' | 'accent' | 'ok' | 'bad' | 'warn';
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

/** A pill-shaped toggle, used for choosing among a few options. */
export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors cursor-pointer',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min = 1,
  max,
  placeholder,
  className,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  label: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value ?? ''}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={e => {
        const v = e.target.value.trim();
        onChange(v === '' ? null : Math.floor(Number(v)));
      }}
      className={cx(
        'h-9 w-20 rounded-lg border border-line bg-surface-2 px-2.5 text-sm tabular-nums text-fg',
        'placeholder:text-muted/70 focus:border-accent focus:outline-none',
        className,
      )}
    />
  );
}

/**
 * A number field with − / + buttons. It keeps its own text while typing, so "1"
 * on the way to "15" doesn't jump around; values are clamped to [min, max].
 */
export function Stepper({
  value,
  onChange,
  label,
  min = 1,
  max,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const set = (n: number) => onChange(Math.min(Math.max(min, n), max));

  return (
    <div className={cx('inline-flex items-center rounded-xl border border-line bg-surface-2', className)}>
      <IconButton label={`Decrease ${label}`} onClick={() => set(value - 1)} disabled={value <= min}>
        <Minus className="size-4" />
      </IconButton>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={label}
        value={text}
        onChange={e => {
          setText(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (n >= min) set(n);
        }}
        onBlur={() => setText(String(value))}
        onFocus={e => e.target.select()}
        className="h-9 w-16 bg-transparent text-center text-base font-semibold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <IconButton label={`Increase ${label}`} onClick={() => set(value + 1)} disabled={value >= max}>
        <Plus className="size-4" />
      </IconButton>
    </div>
  );
}

export interface Segment {
  value: number;
  className: string;
  label: string;
}

/** A thin stacked bar. */
export function SegmentBar({ segments, className }: { segments: Segment[]; className?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div
      className={cx('flex h-2 w-full gap-0.5 overflow-hidden rounded-full', total === 0 && 'bg-surface-2', className)}
      role="img"
      aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}
    >
      {total > 0 &&
        segments
          .filter(s => s.value > 0)
          .map(s => (
            <div key={s.label} className={cx('h-full first:rounded-l-full last:rounded-r-full', s.className)} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
    </div>
  );
}

/** Legend key: a colored swatch beside plain text (text never wears the data color). */
export function LegendItem({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx('size-2 rounded-full', swatch)} aria-hidden />
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted">
      {children}
    </kbd>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => e.target === ref.current && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl"
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </dialog>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}
