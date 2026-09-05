/* 时间格式化：与设计稿文案风格一致（今天 14:30 / 昨天 18:00 / 2小时前） */

function pad(n) {
  return String(n).padStart(2, '0')
}

function dayKey(d) {
  const x = new Date(d)
  return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate()
}

function isSameDay(a, b) {
  return dayKey(a) === dayKey(b)
}

/* "今天 14:30" / "昨天 18:00" / "前天 10:00" / "8月12日" */
function fmtRel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
  )
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
  if (diffDays === 0) return '今天 ' + hm
  if (diffDays === 1) return '昨天 ' + hm
  if (diffDays === 2) return '前天 ' + hm
  return d.getMonth() + 1 + '月' + d.getDate() + '日'
}

/* "2小时前" / "昨天 18:30" / "3天前" */
function fmtAgo(iso) {
  const d = new Date(iso)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return diffMin + '分钟前'
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return diffHour + '小时前'
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  return diffDay + '天前'
}

/* 打卡媒体合成（微博式混排展示）：图片在前视频在后 → [{type:'image'|'video', url}]
 * 存储仍是 photos（图片）/ videos（视频）两个数组，展示时合成混排 */
function toMedia(photos, videos) {
  const m = []
  ;(photos || []).forEach(function (u) { m.push({ type: 'image', url: u }) })
  ;(videos || []).forEach(function (u) { m.push({ type: 'video', url: u }) })
  return m
}

module.exports = { fmtRel, fmtAgo, isSameDay, dayKey, pad, toMedia }
