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

/* 打卡媒体合成（微博式混排展示）→ [{type:'image'|'video', url, local}]
 * 存储仍是 photos（图片）/ videos（视频）两个数组；mediaOrder 为用户选择时的混排顺序
 * 标记（'p0'/'v1' 引用两数组的下标），有则按其重建顺序，无（旧记录）退化为图片在前视频在后；
 * local=true 表示还是本地临时路径（微博式异步上传中，云端他人暂不可见） */
function toMedia(photos, videos, order) {
  const p = photos || []
  const v = videos || []
  const item = function (type, url) {
    return { type: type, url: url, local: url.indexOf('cloud://') !== 0 }
  }
  if (order && order.length) {
    const list = []
    order.forEach(function (t) {
      const idx = parseInt(t.slice(1), 10)
      if (t.charAt(0) === 'p' && p[idx]) list.push(item('image', p[idx]))
      else if (t.charAt(0) === 'v' && v[idx]) list.push(item('video', v[idx]))
    })
    return list
  }
  const m = []
  p.forEach(function (u) { m.push(item('image', u)) })
  v.forEach(function (u) { m.push(item('video', u)) })
  return m
}

module.exports = { fmtRel, fmtAgo, isSameDay, dayKey, pad, toMedia }
