import { Link, useLocation } from 'react-router-dom'
import { NavHome, NavDiscover, NavCheckin, NavProfile } from './icons.jsx'

const TABS = [
  { key: 'home', label: '首页', path: '/', icon: NavHome, match: (p) => p === '/' || p.startsWith('/venue') },
  { key: 'discover', label: '发现', path: '/discover', icon: NavDiscover, match: (p) => p.startsWith('/discover') },
  { key: 'checkin', label: '签到', path: '/checkins', icon: NavCheckin, match: (p) => p.startsWith('/checkins') },
  { key: 'profile', label: '我的', path: '/profile', icon: NavProfile, match: (p) => p.startsWith('/profile') },
]

export default function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink pb-[env(safe-area-inset-bottom)]"
      aria-label="主导航"
    >
      <div className="mx-auto grid h-14 w-full max-w-md grid-cols-4">
        {TABS.map(({ key, label, path, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={key}
              to={path}
              aria-current={active ? 'page' : undefined}
              className={`flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 no-underline outline-none transition-colors ${
                active ? 'font-medium text-primary' : 'text-ash'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate whitespace-nowrap text-[11px] leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
