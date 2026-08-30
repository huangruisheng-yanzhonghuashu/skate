import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from '../components/Toast.jsx'
import { fmtRel } from '../lib/format.js'
import { ChevronRight, FileText, MapPin, NavDiscover, NavProfile, Settings, StatFlame } from '../components/icons.jsx'

export default function Profile() {
  const { user, city, checkins, stats } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const recent = checkins.slice(0, 3)

  const menu = [
    {
      key: 'my-checkin',
      icon: <MapPin className="h-5 w-5 text-primary" />,
      label: '我的签到',
      value: `${stats.total}次`,
      onClick: () => navigate('/checkins'),
    },
    {
      key: 'my-reports',
      icon: <FileText className="h-5 w-5 text-primary" />,
      label: '我的报错',
      value: '2条',
      onClick: () => toast('报错记录即将上线'),
    },
    {
      key: 'suggest-venue',
      icon: <FileText className="h-5 w-5 text-primary" />,
      label: '场地建议',
      value: '',
      onClick: () => toast('感谢支持，建议入口即将开放'),
    },
    {
      key: 'settings',
      icon: <Settings className="h-5 w-5 text-primary" />,
      label: '设置',
      value: '',
      onClick: () => toast('设置功能开发中'),
    },
  ]

  return (
    <main className="flex flex-1 flex-col px-4 pb-6 pt-4">
      {/* 页头 */}
      <header className="-mx-4 mb-3 bg-ink px-4 pb-3 pt-1">
        <div className="relative flex h-11 items-center justify-center">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold text-white">
            <NavProfile className="h-[22px] w-[22px] text-primary" />
            我的
          </h1>
        </div>
      </header>

      {/* 个人卡片 */}
      <section className="mb-3 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold text-ink">{user.name}</div>
            <div className="mt-1.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-sm text-graphite">
                <NavDiscover className="h-4 w-4 text-primary" />
                <span>滑龄 {user.skateYears}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-graphite">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{city}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 菜单列表 */}
      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        {menu.map((m, i) => (
          <button
            key={m.key}
            onClick={m.onClick}
            className={`flex w-full items-center justify-between px-4 py-4 text-left transition-colors active:bg-primary-50 ${
              i < menu.length - 1 ? 'border-b border-mist' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {m.icon}
              <span className="text-[15px] text-ink">{m.label}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-ash">
              {m.value && <span>{m.value}</span>}
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </section>

      {/* 最近签到记录 */}
      <section className="mt-4">
        <div className="flex items-center justify-center gap-2 py-3 text-sm tracking-wide text-ash">
          <span className="h-px w-8 bg-fog" />
          <span className="flex items-center gap-1">
            <StatFlame className="h-4 w-4 text-primary" />
            最近签到记录
          </span>
          <span className="h-px w-8 bg-fog" />
        </div>
        <div className="space-y-2">
          {recent.map((c) => (
            <Link
              key={c.id}
              to={`/venue/${c.venueId}`}
              className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm no-underline transition-colors active:bg-primary-50"
            >
              <MapPin className="h-[18px] w-[18px] shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-ink">{c.venueName}</div>
              </div>
              <div className="whitespace-nowrap text-sm text-ash">{fmtRel(c.at)}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
