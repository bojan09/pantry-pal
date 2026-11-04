import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/design/ui';
import { useToast } from '@/app/Toast';

type Perm = 'unsupported' | NotificationPermission;
const current = (): Perm =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

/** Plain-language explanation of what reminders can and cannot do without a server. */
export function NotificationHelp() {
  const toast = useToast();
  const [perm, setPerm] = useState<Perm>(current);
  return (
    <div className="grid gap-3 text-sm">
      <p>
        PantryPal has no server, so it cannot send you a message when the app is closed. What it
        does instead:
      </p>
      <ul className="list-disc pl-5 text-ink-soft">
        <li>
          <strong className="text-ink">Cooking timers</strong> keep correct time even if you switch
          tabs or reload, and ring when the app is open. With notifications allowed they also show
          an alert while the tab is in the background.
        </li>
        <li>
          <strong className="text-ink">Dates coming up</strong> are shown inside the app on Home and
          on the Expiring Soon page. Choose how many days ahead counts under &ldquo;Expiry
          alerts&rdquo; above.
        </li>
        <li>Nothing can ring once the app or browser is fully closed.</li>
      </ul>
      <p aria-live="polite">
        Browser notifications:{' '}
        <strong>
          {perm === 'granted'
            ? 'allowed'
            : perm === 'denied'
              ? 'blocked'
              : perm === 'default'
                ? 'not asked yet'
                : 'not supported here'}
        </strong>
      </p>
      {perm === 'default' && (
        <div>
          <Button
            variant="ghost"
            onClick={async () => {
              const r = await Notification.requestPermission();
              setPerm(r);
              toast({
                message: r === 'granted' ? 'Timer alerts are on' : 'No notifications will be shown',
              });
            }}
          >
            <Bell aria-hidden className="size-4" /> Allow timer alerts
          </Button>
        </div>
      )}
      {perm === 'denied' && (
        <p className="text-ink-soft">
          Notifications are blocked for this site. To allow them, open your browser&apos;s site
          settings (the lock or tune icon in the address bar), set Notifications to Allow, and
          reload.
        </p>
      )}
      {perm === 'unsupported' && (
        <p className="text-ink-soft">
          This browser does not support web notifications (iPhone and iPad only allow them for apps
          added to the Home Screen). Timers still ring inside the app.
        </p>
      )}
    </div>
  );
}
