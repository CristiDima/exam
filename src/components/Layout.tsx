import { ChartNoAxesColumn, GraduationCap, Library, Settings } from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { useQuestions } from '../lib/questions';
import { Spinner, cx } from './ui';

const NAV = [
  { to: '/', label: 'Practice', icon: GraduationCap },
  { to: '/questions', label: 'Questions', icon: Library },
  { to: '/stats', label: 'Stats', icon: ChartNoAxesColumn },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight">
      <img src="/icon.svg" alt="" className="size-7 rounded-lg ring-1 ring-line" />
      EPSO Practice
    </span>
  );
}

/** Wraps every route: waits for the question sets to load. */
export function Shell() {
  const { status, error } = useQuestions();
  return (
    <>
      <ScrollRestoration />
      {status === 'loading' && <Spinner label="Loading questions…" />}
      {status === 'error' && <p className="mx-auto max-w-md px-4 py-24 text-center text-bad">{error}</p>}
      {status === 'ready' && <Outlet />}
    </>
  );
}

/** Pages with navigation: a top bar on desktop, a tab bar on phones. */
export function MainLayout() {
  return (
    <div className="min-h-dvh pb-24 sm:pb-12">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <NavLink to="/" aria-label="Home">
            <Logo />
          </NavLink>
          <nav className="hidden gap-1 sm:flex" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
