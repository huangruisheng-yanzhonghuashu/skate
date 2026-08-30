import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CITIES, MAP_MARKERS, VENUES, getVenue } from '../data/mock.js'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from '../components/Toast.jsx'
import VenueCard from '../components/VenueCard.jsx'
import { ChevronDown, Locate, MapPin, Search, Venue as VenueIcon, VenuePin, X } from '../components/icons.jsx'

const FILTERS = ['全部', '碗池', '街式', '平地', 'U池', '混合']

export default function Home() {
  const navigate = useNavigate()
  const toast = useToast()
  const { city, setCity, checkedToday } = useApp()

  const [filter, setFilter] = useState('全部')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [selected, setSelected] = useState(MAP_MARKERS[0].venueId)
  const [online, setOnline] = useState(() =>
    Object.fromEntries(VENUES.map((v) => [v.id, v.online])),
  )
  const searchRef = useRef(null)

  /* 在线人数随机波动，让页面有"实时感" */
  useEffect(() => {
    const t = setInterval(() => {
      setOnline((prev) => {
        const next = { ...prev }
        const id = VENUES[Math.floor(Math.random() * VENUES.length)].id
        next[id] = Math.min(28, Math.max(1, next[id] + (Math.random() > 0.5 ? 1 : -1)))
        return next
      })
    }, 4000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  const list = useMemo(() => {
    let arr = VENUES
    if (filter !== '全部') arr = arr.filter((v) => v.category === filter)
    if (query.trim()) arr = arr.filter((v) => v.name.includes(query.trim()))
    return arr
  }, [filter, query])

  const pickCity = (c) => {
    setCity(c)
    setCityOpen(false)
    toast(`已切换到${c}`)
  }

  /* 点标记：选中显示气泡；再点已选中的进入详情 */
  const tapMarker = (venueId) => {
    if (selected === venueId) navigate(`/venue/${venueId}`)
    else setSelected(venueId)
  }

  const selMarker = MAP_MARKERS.find((m) => m.venueId === selected) ?? MAP_MARKERS[0]
  const selVenue = getVenue(selMarker.venueId)

  return (
    <>
      {/* 应用头部：定位 + 搜索 */}
      <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-3 bg-ink px-4">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-8 flex-1 items-center gap-2 rounded-full bg-ink-line px-4">
              <Search className="h-3.5 w-3.5 text-ash" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索场地、店铺..."
                className="h-8 w-full bg-transparent text-sm text-white placeholder:text-ash focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="清空搜索"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ash/30 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => { setSearchOpen(false); setQuery('') }}
              className="shrink-0 text-sm text-ash active:text-white"
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <div className="relative shrink-0">
              <button
                onClick={() => setCityOpen((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-white"
                aria-haspopup="listbox"
                aria-expanded={cityOpen}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>{city}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {cityOpen && (
                <div className="animate-fade-in absolute left-0 top-8 z-30 w-28 overflow-hidden rounded-lg bg-white py-1 shadow-float">
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => pickCity(c)}
                      className={`block w-full px-4 py-2 text-left text-sm ${
                        c === city ? 'bg-primary-50 font-medium text-primary' : 'text-ink'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 max-w-[220px] flex-1 items-center gap-2 rounded-full bg-ink-line px-3.5 text-[13px] text-ash"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">搜索场地、店铺...</span>
            </button>
          </>
        )}
      </header>

      {/* 地图区域 */}
      <section
        className="relative h-[42vh] min-h-[260px] shrink-0 overflow-hidden bg-[#E8ECEF]"
        aria-label="附近场地地图"
      >
        {/* 风格化浅色底图 */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 375 320" aria-hidden="true">
          <path d="M-20 292 Q80 268 170 288 T400 280 L400 340 L-20 340 Z" fill="#D6E4EC" />
          <rect x="100" y="32" width="58" height="44" rx="4" fill="#DFE5EA" />
          <rect x="244" y="192" width="62" height="34" rx="4" fill="#DFE5EA" />
          <rect x="44" y="246" width="70" height="28" rx="4" fill="#DFE5EA" />
          <rect x="218" y="24" width="64" height="60" rx="10" fill="#DDE8DC" />
          <g fill="none" stroke="#D8DEE3">
            <path d="M-20 118 Q120 100 200 150 T400 176" strokeWidth="18" />
            <path d="M56 -20 Q76 90 40 168 T10 340" strokeWidth="14" />
            <path d="M298 -20 Q282 96 330 186 T358 340" strokeWidth="14" />
            <path d="M352 -20 Q272 120 168 236 T40 340" strokeWidth="14" />
            <path d="M-20 236 Q140 218 260 244 T400 232" strokeWidth="14" />
          </g>
          <g fill="none" stroke="#FFFFFF">
            <path d="M-20 118 Q120 100 200 150 T400 176" strokeWidth="2" strokeDasharray="10 14" />
            <path d="M56 -20 Q76 90 40 168 T10 340" strokeWidth="1.8" strokeDasharray="8 12" />
            <path d="M298 -20 Q282 96 330 186 T358 340" strokeWidth="1.8" strokeDasharray="8 12" />
            <path d="M352 -20 Q272 120 168 236 T40 340" strokeWidth="1.8" strokeDasharray="8 12" />
            <path d="M-20 236 Q140 218 260 244 T400 232" strokeWidth="1.8" strokeDasharray="8 12" />
          </g>
        </svg>

        {/* 当前定位呼吸点 */}
        <div
          className="pointer-events-none absolute h-8 w-8"
          style={{ left: '38%', top: '55%', margin: '-16px 0 0 -16px' }}
          aria-hidden="true"
        >
          <span className="animate-breathe absolute inset-0 rounded-full border border-info/40 bg-info/15" />
          <span className="absolute top-1/2 left-1/2 -mt-2 -ml-2 h-4 w-4 rounded-full border-[2.5px] border-white bg-info shadow-[0_1px_4px_rgba(26,26,30,0.18)]" />
        </div>

        {/* 场地标记（滑板鞋 pin，尖端锚定） */}
        {MAP_MARKERS.map((m, i) => {
          const v = getVenue(m.venueId)
          const isSelected = selected === m.venueId
          /* 今日有签到/热门的场地高亮，其余水泥灰 */
          const active = v.hot || checkedToday(v.id)
          return (
            <div
              key={m.venueId}
              className="absolute -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_3px_rgba(26,26,30,0.22)]"
              style={{ left: m.left, top: m.top, zIndex: isSelected ? 25 : 20 }}
            >
              <button
                type="button"
                onClick={() => tapMarker(m.venueId)}
                aria-label={v.name}
                className="block cursor-pointer transition-transform duration-100 active:scale-90"
              >
                <VenuePin
                  active={active}
                  className="animate-pin-in h-[26px] w-[22px]"
                  style={{ animationDelay: `${40 + i * 60}ms` }}
                />
              </button>
            </div>
          )
        })}

        {/* 选中标记气泡 */}
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
          style={{ left: selMarker.left, top: selMarker.top, marginTop: -32 }}
        >
          <div
            className="animate-callout-in relative rounded-lg bg-white px-2.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.10)]"
            style={{ animationDelay: '140ms', transformOrigin: '50% 100%' }}
          >
            <div className="text-xs leading-[1.3] font-semibold whitespace-nowrap text-ink">{selVenue.name}</div>
            <div className="mt-px text-[11px] leading-[1.3] whitespace-nowrap text-ash">距你 {selVenue.distance}</div>
            <span className="absolute -bottom-[3px] left-1/2 -ml-1 h-2 w-2 rotate-45 rounded-[1px] bg-white" aria-hidden="true" />
          </div>
        </div>

        {/* 回到当前定位 */}
        <button
          type="button"
          onClick={() => toast('已回到当前位置')}
          aria-label="回到当前位置"
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-fog bg-white text-ink shadow-[0_2px_8px_rgba(26,26,30,0.10)] transition-transform duration-100 active:scale-95"
        >
          <Locate />
        </button>
      </section>

      {/* 地图/列表分隔手柄 */}
      <div
        className="flex h-5 shrink-0 items-center justify-center bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.03)]"
        aria-hidden="true"
      >
        <span className="h-1 w-9 rounded-full bg-[#D9D9D9]" />
      </div>

      {/* 快捷筛选 */}
      <div className="shrink-0 bg-mist px-4 py-1">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-7 shrink-0 rounded-full px-4 text-[13px] leading-7 whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-primary font-semibold text-white'
                  : 'bg-[#EEEEEE] font-medium text-[#4A4A4A] active:bg-[#E2E2E2]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 场地列表 */}
      <main className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <VenueIcon className="h-10 w-10 text-fog" />
            <p className="text-sm text-ash">
              {query ? `没有找到「${query}」相关的场地` : `暂无${filter}类型的场地`}
            </p>
          </div>
        ) : (
          <>
            {list.map((v, i) => (
              <VenueCard
                key={v.id}
                venue={v}
                online={online[v.id]}
                checked={checkedToday(v.id)}
                query={query.trim()}
                index={i}
              />
            ))}
            {/* 上拉加载更多 */}
            <div className="flex items-center justify-center gap-2 pt-3 pb-1 text-xs text-ash">
              <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-fog border-t-primary" aria-hidden="true" />
              <span>上拉加载更多</span>
            </div>
          </>
        )}
      </main>
    </>
  )
}
