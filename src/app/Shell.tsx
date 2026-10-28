import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Moon, Search, Sun } from 'lucide-react';
import { Logo, SidebarArt } from '@/design/illustrations';
import { cx, IconButton } from '@/design/ui';
import { BOTTOM_NAV, NAV } from './nav';
import { BackgroundLayer } from './BackgroundLayer';
import { StatusBanner } from './pwa';
import { usePrefs } from './PrefsProvider';

function Sidebar() {
  const { prefs, update } = usePrefs();
  const dark = prefs.theme === 'dark';
  return (
    <aside
      aria-label="Primary"
      className="pp-card sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col overflow-hidden p-4 lg:flex"
    >
      <div className="flex items-center gap-3 px-2 pb-5 pt-1">
        <Logo className="size-12" />
        <div>
          <p className="font-display text-2xl font-semibold leading-none">PantryPal</p>
          <p className="mt-1 text-xs text-ink-soft">Your Kitchen, Organized</p>
        </div>
      </div>
      <nav aria-label="Main" className="grid gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cx(
                'flex min-h-11 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium transition',
                isActive ? 'bg-accent text-accent-ink shadow-sm' : 'text-ink hover:bg-surface-2',
              )
            }
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <SidebarArt className="pointer-events-none absolute -bottom-3 -right-4 h-48" />
      <div className="relative mt-auto pt-4">
        <button
          type="button"
          onClick={() => update({ theme: dark ? 'light' : 'dark' })}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
        >
          {dark ? 'Switch to light theme' : 'Switch to dark theme'}
          {dark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const { prefs } = usePrefs();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/recipes?q=${encodeURIComponent(q.trim())}` : '/recipes');
  };
  const today = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  return (
    <div className="mb-5 hidden items-center gap-3 lg:flex">
      <form role="search" onSubmit={submit} className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="search"
          aria-label="Search recipes and ingredients"
          placeholder={'Search recipes, ingredients or try "pasta"…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-12 w-full rounded-full border border-line bg-surface pl-12 pr-4 text-base placeholder:text-ink-soft/70"
        />
      </form>
      <IconButton label="Expiring soon" onClick={() => navigate('/expiring')}>
        <Bell aria-hidden className="size-5" />
      </IconButton>
      <div className="pp-card flex min-h-12 items-center rounded-full px-5 text-sm font-medium">
        {today}
      </div>
      <div
        aria-label={prefs.name ? `Profile: ${prefs.name}` : 'Profile'}
        className="grid size-12 place-items-center rounded-full bg-accent font-display text-lg font-semibold text-accent-ink"
      >
        {(prefs.name || 'P').slice(0, 1).toUpperCase()}
      </div>
    </div>
  );
}

function MobileTopBar() {
  return (
    <div className="mb-4 flex items-center justify-between lg:hidden">
      <Link to="/" className="flex min-h-11 items-center gap-2" aria-label="PantryPal home">
        <Logo className="size-9" />
        <span className="font-display text-2xl font-semibold">PantryPal</span>
      </Link>
      <Link
        to="/expiring"
        aria-label="Expiring soon"
        className="inline-grid size-11 place-items-center rounded-full border border-line bg-surface"
      >
        <Bell aria-hidden className="size-5" />
      </Link>
    </div>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                  isActive ? 'text-accent-text' : 'text-ink-soft',
                )
              }
            >
              <Icon aria-hidden className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <BackgroundLayer />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 pb-28 pt-4 safe-top sm:px-6 lg:px-6 lg:pb-8">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1">
          <TopBar />
          <MobileTopBar />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
      <StatusBanner />
    </>
  );
}
