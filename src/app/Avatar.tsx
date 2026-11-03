import { usePrefs } from './PrefsProvider';
import { useMediaUrl } from './useMediaUrl';
import { cx } from '@/design/ui';

/** Profile picture (stored locally) or the first initial on an accent circle. */
export function Avatar({ className }: { className?: string }) {
  const { prefs } = usePrefs();
  const url = useMediaUrl(prefs.avatarId);
  return url ? (
    <img
      src={url}
      alt="Your profile picture"
      className={cx('rounded-full object-cover', className)}
    />
  ) : (
    <span
      aria-hidden
      className={cx(
        'grid place-items-center rounded-full bg-accent font-display font-semibold text-accent-ink',
        className,
      )}
    >
      {(prefs.name || 'P').slice(0, 1).toUpperCase()}
    </span>
  );
}
