import { useMemo } from 'react'
import { LEADERBOARD } from '../data/mock.js'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from '../components/Toast.jsx'
import { MapPin, StatCalendar, StatFlame, StatTrophy } from '../components/icons.jsx'

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export default function MyCheckins() {
  const { stats, monthDays } = useApp()
  const toast = useToast()
  const now = new Date()

  /* 当月日历网格：前置空位 + 日期格（有签到标点、今日高亮） */
  const grid = useMemo(() => {
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = Array.from({ length: firstWeekday }, () => null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [now.getFullYear(), now.getMonth()])

  const today = now.getDate()

  return (
    <main className="flex flex-1 flex-col">
      {/* 页头 */}
      <header className="bg-ink px-4 pb-4 pt-2">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-primary" />
          <h1 className="text-lg font-semibold text-white">我的签到</h1>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* 统计卡片 */}
        <section className="grid grid-cols-3 gap-2 rounded-lg bg-white p-4">
          {[
            { icon: <StatTrophy className="h-6 w-6 shrink-0" />, label: '总签到', value: `${stats.total}次` },
            { icon: <StatFlame className="h-6 w-6 shrink-0" />, label: '连续签到', value: `${stats.streak}天` },
            { icon: <StatCalendar className="h-6 w-6 shrink-0" />, label: '本周签到', value: `${stats.weekDays}天` },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5">
              <span className="text-primary">{s.icon}</span>
              <span className="text-xs text-ash">{s.label}</span>
              <span className="text-base font-semibold text-ink">{s.value}</span>
            </div>
          ))}
        </section>

        {/* 签到日历 */}
        <section className="rounded-lg bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-ink">
            签到日历（{now.getMonth() + 1}月）
          </h2>
          <div className="mb-2 grid grid-cols-7 text-center">
            {WEEK_LABELS.map((w) => (
              <div key={w} className="py-1 text-xs text-ash">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center">
            {grid.map((day, i) => {
              if (day == null) return <div key={`empty-${i}`} className="py-1" />
              const checked = monthDays.has(day)
              const isToday = day === today
              return (
                <div key={day} className="flex flex-col items-center justify-center gap-1 py-1">
                  {isToday ? (
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-medium ${
                        checked ? 'border-primary text-primary' : 'border-fog text-ash'
                      }`}
                    >
                      {day}
                    </span>
                  ) : (
                    <span className={`text-sm ${checked ? 'text-ink' : 'text-graphite'}`}>{day}</span>
                  )}
                  <span className={`h-1 w-1 rounded-full ${checked ? 'bg-primary' : 'bg-transparent'}`} />
                </div>
              )
            })}
          </div>
        </section>

        {/* 签到排行榜 */}
        <section className="rounded-lg bg-white p-4">
          <h2 className="mb-3 flex items-center justify-center gap-2 text-center text-base font-semibold text-ink">
            <span className="h-px w-6 bg-fog" />
            签到排行榜 (本周)
            <span className="h-px w-6 bg-fog" />
          </h2>
          <ul className="space-y-3">
            {LEADERBOARD.map((item) => {
              const top = item.rank <= 3
              return (
                <li key={item.user} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        top ? 'bg-primary-50 font-bold text-primary' : 'bg-mist font-medium text-ash'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <span className={`text-sm ${item.self ? 'font-semibold text-primary' : 'text-ink'}`}>
                      {item.user}
                      {item.self && <span className="ml-1 text-xs text-ash">(我)</span>}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${top ? 'text-primary' : 'text-ash'}`}>{item.count}次</span>
                </li>
              )
            })}
          </ul>
          <button
            onClick={() => toast('完整排行榜即将开放')}
            className="mt-4 block w-full text-center text-sm text-primary"
          >
            查看全部排行榜 &gt;
          </button>
        </section>
      </div>
    </main>
  )
}
