/* 打卡媒体互斥选择（图/视频二选一）：图片最多 9 张，或仅 1 个视频
 * post-publish / venue-detail / shop-detail 三处打卡弹窗共用，规则只维护一份
 *
 * 三态模式（modeOf）：
 *   ''     未定 —— 可选图或视频（mix，单次混选整批拦截）
 *   image  图片态 —— 只能继续加图（mediaType 收窄为 image）
 *   video  视频态 —— 已满，不再提供添加入口（pick 直接拒绝兜底） */
const MAX_PHOTOS = 9
const MAX_VIDEOS = 1

/* 当前媒体模式：'' 未定 / 'image' 图片态 / 'video' 视频态 */
function modeOf(media) {
  const list = media || []
  if (list.some((m) => m.type === 'video')) return 'video'
  return list.length ? 'image' : ''
}

/* 发布前硬校验（防状态被绕过）：合法返回 ''，否则返回拦截文案 */
function validate(media) {
  const list = media || []
  const hasImage = list.some((m) => m.type === 'image')
  const hasVideo = list.some((m) => m.type === 'video')
  if (hasImage && hasVideo) return '图片和视频不能同时发布'
  if (list.filter((m) => m.type === 'video').length > MAX_VIDEOS) return '视频仅支持 1 个'
  if (list.filter((m) => m.type === 'image').length > MAX_PHOTOS) return '图片最多 ' + MAX_PHOTOS + ' 张'
  return ''
}

/* 拉起系统选择器：按当前模式限制 mediaType/count，从源头避免混选。
 * 返回 Promise<{ added }>（用户取消视为未添加）；
 * 单次混选、多选视频等越界场景 reject({ msg })，由调用方 toast */
function pick(current) {
  const mode = modeOf(current)
  if (mode === 'video') return Promise.reject({ msg: '视频仅支持 1 个，请先删除已选视频' })
  const remain = MAX_PHOTOS - (current || []).length
  if (remain <= 0) return Promise.resolve({ added: [] })
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: remain,
      mediaType: mode === 'image' ? ['image'] : ['mix'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = (res.tempFiles || []).map((f) => ({
          type: f.fileType === 'video' ? 'video' : 'image',
          url: f.tempFilePath,
          duration: f.duration || 0, /* 视频时长（秒），用于选择态角标 */
        }))
        const images = added.filter((m) => m.type === 'image')
        const videos = added.filter((m) => m.type === 'video')
        if (images.length && videos.length) {
          reject({ msg: '图片和视频不能同时选择，请分开添加' })
          return
        }
        if (videos.length > MAX_VIDEOS) {
          reject({ msg: '视频仅支持 1 个，请重新选择' })
          return
        }
        resolve({ added })
      },
      fail: () => resolve({ added: [] }),
    })
  })
}

/* 秒 → mm:ss（无时长返回 ''，角标隐藏） */
function fmtDuration(sec) {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s)
}

module.exports = { MAX_PHOTOS, MAX_VIDEOS, modeOf, validate, pick, fmtDuration }
