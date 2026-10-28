import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-sm',
  soft: 'bg-accent-soft text-accent-text hover:brightness-95',
  ghost: 'bg-transparent text-ink hover:bg-surface-2 border border-line',
  danger: 'bg-bad text-white hover:brightness-110',
};
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={cx(base, variants[variant], className)} {...rest} />;
}

export function LinkButton({
  variant = 'primary',
  className,
  ...rest
}: LinkProps & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...rest} />;
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 active:scale-95',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  as: Tag = 'section',
  ...rest
}: { className?: string; as?: 'section' | 'div' | 'article'; children?: ReactNode } & {
  'aria-labelledby'?: string;
}) {
  return <Tag className={cx('pp-card p-5', className)} {...rest} />;
}

export function Chip({
  selected,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition',
        selected
          ? 'border-transparent bg-accent text-accent-ink'
          : 'border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 rounded-full px-4 text-sm font-semibold transition',
            o.value === value
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-soft/70';

export function EmptyState({
  art,
  title,
  body,
  action,
}: {
  art?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 px-4 py-10 text-center">
      {art && <div className="h-20 w-24">{art}</div>}
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-md text-ink-soft">{body}</p>
      {action}
    </div>
  );
}

/** Page title row. Pass `back` on any sub-page so there is always a way back. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start gap-3 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:px-5 lg:py-4 lg:shadow-card">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="mt-0.5 inline-grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,32rem)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/40"
    >
      <div className="grid gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-2xl font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export { cx };
