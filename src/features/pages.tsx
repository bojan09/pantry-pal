import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Sprig } from '@/design/illustrations';
import { Card, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { MORE_ITEMS } from '@/app/nav';

export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="grid gap-3">
        {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="pp-card flex min-h-16 items-center gap-4 px-5 text-lg font-medium hover:bg-surface-2"
            >
              <Icon aria-hidden className="size-6 text-accent-text" />
              {label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            to="/privacy"
            className="pp-card flex min-h-16 items-center gap-4 px-5 text-lg font-medium hover:bg-surface-2"
          >
            <ShieldCheck aria-hidden className="size-6 text-accent-text" />
            Privacy
          </Link>
        </li>
      </ul>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" back="/" />
      <Card>
        <EmptyState
          art={<Sprig />}
          title="We couldn't find that page"
          body="The link may be old or mistyped."
          action={<LinkButton to="/">Go home</LinkButton>}
        />
      </Card>
    </>
  );
}
