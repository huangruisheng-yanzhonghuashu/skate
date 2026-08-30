import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FEED_LIST, getVenue } from '../data/mock.js'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from '../components/Toast.jsx'
import { fmtAgo } from '../lib/format.js'
import { Heart, MessageCircle, NavDiscover } from '../components/icons.jsx'

export default function Discover() {
  const [tab, setTab] = useState('latest')
  const { likes, toggleLike } = useApp()
  const toast = useToast()

  const list = useMemo(() => {
    const arr = [...FEED_LIST]
    if (tab === 'hot') {
      arr.sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2))
    } else {
      arr.sort((a, b) => new Date(b.at) - new Date(a.at))
    }
    return arr
  }, [tab])

  return (
    <>
      {/* 页头 */}
      <header className="bg-ink px-4 pb-3 pt-1">
        <div className="mx-auto flex max-w-md items-center justify-center gap-1.5">
          <NavDiscover className="h-5.5 w-5.5 shrink-0 text-primary" />
          <h1 className="text-lg font-semibold text-white">发现</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md pb-6">
        {/* 最新/热门切换 */}
        <div className="sticky top-0 z-10 bg-white">
          <div className="flex items-center justify-center gap-8 border-b border-fog">
            {[
              { key: 'latest', label: '最新' },
              { key: 'hot', label: '热门' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative px-1 py-3 text-[15px] font-medium transition-colors ${
                  tab === key ? 'text-primary' : 'text-ash'
                }`}
              >
                {label}
                {tab === key && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 动态流 */}
        <div className="space-y-3 p-3">
          {list.map((item) => {
            const liked = !!likes[item.id]
            const venue = getVenue(item.venueId)
            return (
              <article key={item.id} className="rounded-lg bg-white p-3 shadow-sm">
                <div className="mb-2.5 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: item.avatarColor }}
                  >
                    {item.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{item.user}</span>
                      <span className="text-ash">·</span>
                      <Link
                        to={`/venue/${item.venueId}`}
                        className="truncate text-[13px] text-primary hover:underline"
                      >
                        {venue?.name}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-xs text-ash">{fmtAgo(item.at)}</div>
                  </div>
                </div>
                <p className="mb-2.5 text-[15px] leading-relaxed text-ink">{item.text}</p>
                {item.photos.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    {item.photos.map((src, i) => (
                      <div key={i} className="img-skeleton aspect-square overflow-hidden rounded-md bg-mist">
                        <img
                          src={src}
                          alt={`${venue?.name}照片${i + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-5 text-[13px] text-ash">
                  <button
                    type="button"
                    onClick={() => toggleLike(item.id)}
                    aria-pressed={liked}
                    className={`flex items-center gap-1.5 transition-colors ${
                      liked ? 'text-primary' : 'hover:text-primary'
                    }`}
                  >
                    <Heart className="h-[18px] w-[18px]" filled={liked} />
                    <span>{item.likes + (liked ? 1 : 0)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toast('评论区即将开放，敬请期待')}
                    className="flex items-center gap-1.5 transition-colors hover:text-primary"
                  >
                    <MessageCircle className="h-[18px] w-[18px]" />
                    <span>{item.comments}</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </main>
    </>
  )
}
