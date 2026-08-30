import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getVenue } from '../data/mock.js'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from '../components/Toast.jsx'
import CheckinModal from '../components/CheckinModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { fmtAgo } from '../lib/format.js'
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Flag, MapPin,
  Navigation, Share, Star, TagCement, TagFree, TagLight, TagMixed,
} from '../components/icons.jsx'

const TAG_ICONS = { mixed: TagMixed, free: TagFree, light: TagLight, cement: TagCement }
const LIVE_AVATARS = [
  { text: 'AK', color: '#FF5A36' },
  { text: 'LY', color: '#2A8CFF' },
  { text: 'MC', color: '#FFB800' },
  { text: 'JD', color: '#00D4AA' },
]

export default function VenueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const venue = getVenue(id)
  const { checkins, checkedToday } = useApp()

  const [idx, setIdx] = useState(0)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [online, setOnline] = useState(venue?.online ?? 0)
  const touchX = useRef(null)

  useEffect(() => {
    setOnline(venue?.online ?? 0)
    setIdx(0)
  }, [id])

  useEffect(() => {
    const t = setInterval(() => {
      setOnline((n) => Math.min(30, Math.max(1, n + (Math.random() > 0.5 ? 1 : -1))))
    }, 5000)
    return () => clearInterval(t)
  }, [])

  /* 打卡动态 = 用户真实签到(带留言) + mock 动态，取最近3条 */
  const feed = useMemo(() => {
    if (!venue) return []
    const mine = checkins
      .filter((c) => c.venueId === venue.id && c.note)
      .map((c) => ({ user: '我', avatar: '张', color: '#FF5A36', time: fmtAgo(c.at), text: c.note }))
    return [...mine, ...venue.feed].slice(0, 3)
  }, [venue, checkins])

  if (!venue) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-ash">场地不存在或已下线</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white">回到首页</Link>
      </div>
    )
  }

  const checked = checkedToday(venue.id)
  const prev = () => setIdx((i) => (i - 1 + venue.photos.length) % venue.photos.length)
  const next = () => setIdx((i) => (i + 1) % venue.photos.length)

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 48) (dx < 0 ? next : prev)()
    touchX.current = null
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/venue/${venue.id}`)
      toast('链接已复制，去分享吧')
    } catch {
      toast('分享面板即将开放')
    }
  }

  return (
    <div className="pb-16">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 bg-ink">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="-ml-2 rounded-full p-2 text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft />
          </button>
          <h1 className="truncate px-2 text-lg font-semibold text-white">{venue.name}</h1>
          <button
            onClick={share}
            aria-label="分享"
            className="-mr-2 rounded-full p-2 text-white transition-colors hover:bg-white/10"
          >
            <Share />
          </button>
        </div>
      </header>

      {/* 图片轮播（支持滑动/按钮/键盘切换） */}
      <section
        className="relative h-[50vh] w-full overflow-hidden bg-ink"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {venue.photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${venue.name}照片${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable="false"
              className="h-full w-full shrink-0 select-none object-cover"
            />
          ))}
        </div>

        {venue.photos.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="上一张"
              className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm transition-colors hover:bg-white"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={next}
              aria-label="下一张"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm transition-colors hover:bg-white"
            >
              <ChevronRight />
            </button>
            <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
              {idx + 1}/{venue.photos.length}
            </div>
          </>
        )}
      </section>

      {/* 名称 / 评分 / 地址 / 标签 */}
      <section className="bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold leading-tight text-ink">{venue.name}</h2>
          <div className="flex shrink-0 items-center gap-1 text-warning">
            <Star className="h-4 w-4" />
            <span className="text-base font-semibold text-ink">{venue.rating.toFixed(1)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-sm text-graphite">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{venue.address}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {venue.tags.map((tag) => {
            const Icon = TAG_ICONS[tag.icon] ?? TagMixed
            return (
              <span
                key={tag.label}
                className="inline-flex items-center gap-1 rounded-full border border-fog px-2.5 py-1 text-xs text-graphite"
              >
                <Icon className="h-3.5 w-3.5 text-ash" />
                {tag.label}
              </span>
            )
          })}
        </div>
      </section>

      {/* 实时状态 */}
      <section className="mx-4 mt-3 rounded-lg bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="text-sm font-medium text-ink">此刻 {online} 位滑手在此</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {LIVE_AVATARS.map((a) => (
            <div
              key={a.text}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: a.color }}
            >
              {a.text}
            </div>
          ))}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fog text-xs font-semibold text-graphite">
            +{Math.max(0, online - LIVE_AVATARS.length)}
          </div>
        </div>
      </section>

      {/* 打卡动态 */}
      <section className="mt-3 px-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">打卡动态 (最近3条)</h3>
          <button
            onClick={() => toast('全部打卡列表即将开放')}
            className="flex items-center gap-0.5 text-sm text-ash transition-colors hover:text-primary"
          >
            查看全部打卡
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {feed.map((f, i) => (
            <article key={`${f.user}-${i}`} className="rounded-lg bg-white p-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: f.color }}
                >
                  {f.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{f.user}</p>
                  <p className="text-xs text-ash">{f.time}</p>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 底部固定操作栏（悬于全局导航之上） */}
      <div
        className="fixed inset-x-0 z-20 border-t border-fog bg-white"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid h-14 max-w-md grid-cols-3">
          <button
            type="button"
            onClick={() => toast('已唤起地图导航')}
            className="flex flex-col items-center justify-center gap-1 text-graphite transition-colors hover:bg-mist"
          >
            <Navigation className="h-5 w-5 text-primary" />
            <span className="text-xs">导航</span>
          </button>
          {checked ? (
            <button
              type="button"
              disabled
              className="flex flex-col items-center justify-center gap-1 bg-success text-white"
            >
              <Check className="h-5 w-5" />
              <span className="text-xs font-medium">已签到</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCheckinOpen(true)}
              className="flex flex-col items-center justify-center gap-1 bg-primary text-white transition-colors hover:bg-primary-600"
            >
              <Check className="h-5 w-5" />
              <span className="text-xs font-medium">签到</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-graphite transition-colors hover:bg-mist"
          >
            <Flag className="h-5 w-5 text-ash" />
            <span className="text-xs">报错</span>
          </button>
        </div>
      </div>

      <CheckinModal open={checkinOpen} onClose={() => setCheckinOpen(false)} venue={venue} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} venue={venue} />
    </div>
  )
}
