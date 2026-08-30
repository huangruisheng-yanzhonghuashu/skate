import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'skatespot-state-v1'

/* 基于当前时间生成种子签到记录（共16条，含今日/昨日/前日连续3天） */
function seedCheckins() {
  const now = new Date()
  const rel = (daysAgo, h, m, venueId, venueName) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(h, m, 0, 0)
    return { id: `seed-${daysAgo}-${h}`, venueId, venueName, at: d.toISOString(), note: '' }
  }
  return [
    rel(0, 14, 30, 'binjiang', '滨江滑板公园'),
    rel(1, 18, 0, 'hongkou', '虹口碗池公园'),
    rel(2, 10, 0, 'xuhui', '徐汇滨江平地'),
    rel(3, 16, 20, 'binjiang', '滨江滑板公园'),
    rel(5, 9, 40, 'yangpu', '杨浦U池公园'),
    rel(6, 19, 5, 'jingan', '静安街式广场'),
    rel(8, 15, 0, 'hongkou', '虹口碗池公园'),
    rel(9, 11, 30, 'binjiang', '滨江滑板公园'),
    rel(11, 17, 10, 'xuhui', '徐汇滨江平地'),
    rel(13, 10, 50, 'yangpu', '杨浦U池公园'),
    rel(15, 14, 15, 'binjiang', '滨江滑板公园'),
    rel(18, 16, 0, 'jingan', '静安街式广场'),
    rel(21, 9, 30, 'hongkou', '虹口碗池公园'),
    rel(24, 15, 40, 'binjiang', '滨江滑板公园'),
    rel(27, 11, 0, 'xuhui', '徐汇滨江平地'),
    rel(30, 10, 20, 'binjiang', '滨江滑板公园'),
  ]
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.checkins)) return parsed
    }
  } catch { /* ignore */ }
  return { checkins: seedCheckins(), likes: {}, city: '上海' }
}

const AppContext = createContext(null)

const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const value = useMemo(() => {
    const { checkins, likes, city } = state
    const now = new Date()
    const todayKey = dayKey(now)

    /* 今日是否已在某场地签到（不传 venueId 则任意场地） */
    const checkedToday = (venueId) =>
      checkins.some((c) => dayKey(c.at) === todayKey && (!venueId || c.venueId === venueId))

    /* 总签到 */
    const total = checkins.length

    /* 连续签到天数（自今日或昨日起往前数） */
    const keys = new Set(checkins.map((c) => dayKey(c.at)))
    const shiftDay = (base, delta) => {
      const d = new Date(base)
      d.setDate(d.getDate() + delta)
      return dayKey(d)
    }
    let streak = 0
    let cursor = keys.has(todayKey) ? 0 : -1
    while (keys.has(shiftDay(now, cursor - streak))) streak++

    /* 本周签到天数（周一起） */
    const monday = new Date(now)
    const weekday = (now.getDay() + 6) % 7
    monday.setDate(now.getDate() - weekday)
    monday.setHours(0, 0, 0, 0)
    const weekDays = new Set(
      checkins.filter((c) => new Date(c.at) >= monday).map((c) => dayKey(c.at)),
    ).size

    /* 签到日历：本月各天是否有签到 */
    const monthDays = new Set(
      checkins
        .filter((c) => {
          const d = new Date(c.at)
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        })
        .map((c) => new Date(c.at).getDate()),
    )

    const addCheckin = (venueId, venueName, note = '') =>
      setState((s) => ({
        ...s,
        checkins: [{ id: `c-${Date.now()}`, venueId, venueName, note, at: new Date().toISOString() }, ...s.checkins],
      }))

    const toggleLike = (feedId) =>
      setState((s) => ({ ...s, likes: { ...s.likes, [feedId]: !s.likes[feedId] } }))

    const setCity = (c) => setState((s) => ({ ...s, city: c }))

    return {
      user: { name: '板仔小张', avatar: '张', skateYears: '2年' },
      checkins,
      likes,
      city,
      checkedToday,
      stats: { total, streak, weekDays },
      monthDays,
      addCheckin,
      toggleLike,
      setCity,
    }
  }, [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
