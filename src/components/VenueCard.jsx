import { Link } from 'react-router-dom'
import { Check, MapPin, Star, Venue } from './icons.jsx'

/* 首页场地卡片 — 高保真版结构（热门/已签到角标、评分、地址·距离、标签行、此刻 N 人） */
export default function VenueCard({ venue, online, checked, query, index = 0 }) {
  const hot = venue.hot && !checked

  const name = query ? highlight(venue.name, query) : venue.name

  return (
    <Link
      to={`/venue/${venue.id}`}
      style={{ animationDelay: `${60 + index * 50}ms` }}
      className="skate-card animate-card-in relative flex gap-3 rounded-lg bg-white p-3.5 no-underline shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-[opacity,transform] duration-100 active:scale-[0.99] active:opacity-70"
    >
      {hot && (
        <span className="absolute left-[68px] top-3 rounded-sm bg-primary px-1.5 py-[3px] text-[10px] font-semibold leading-none whitespace-nowrap text-white">
          热门
        </span>
      )}
      {checked && (
        <span className="absolute top-3 right-3 flex items-center gap-[3px] rounded-sm bg-[#E8F8F0] px-1.5 py-[3px] text-[10px] font-semibold leading-none whitespace-nowrap text-[#00B386]">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
          已签到
        </span>
      )}

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0ED] text-primary">
        <Venue className="h-[22px] w-[22px]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className={`flex items-center justify-between gap-2 ${checked ? 'pr-[58px]' : ''}`}>
          <h3 className={`truncate text-[15px] leading-[1.35] font-bold text-ink ${hot ? 'pl-9' : ''}`}>
            {name}
          </h3>
          <div className="flex shrink-0 items-center gap-[3px] text-[13px] leading-none font-semibold text-primary">
            <Star className="h-[13px] w-[13px]" />
            <span>{venue.rating.toFixed(1)}</span>
          </div>
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-[1.4] text-ash">
          <MapPin className="h-[11px] w-[11px] shrink-0" />
          <span className="truncate">{venue.shortAddr} · 距你 {venue.distance}</span>
        </div>

        <div className="mt-1.5 flex gap-1 overflow-hidden">
          {venue.tags.slice(0, 3).map((t) => (
            <span
              key={t.label}
              className="shrink-0 rounded-sm bg-[#F0F0F0] px-1.5 py-[3px] text-[11px] leading-none whitespace-nowrap text-[#666666]"
            >
              {t.label}
            </span>
          ))}
        </div>

        <div className="mt-1.5 flex items-center gap-[5px] text-xs leading-none font-medium text-success">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          此刻 {online} 人
        </div>
      </div>
    </Link>
  )
}

/* 搜索命中文字高亮 */
function highlight(text, query) {
  const idx = text.indexOf(query)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-100 text-ink rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
