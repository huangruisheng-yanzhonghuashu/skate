/* 我的报错：查看场地报错的官方处理进度（venue_reports 集合，仅创建者可读写）
 * 报错从场地详情页提交，本页只做列表与状态展示 */
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')

const STATUS_TEXT = { pending: '待处理', done: '已处理', rejected: '已驳回' }

/* 数据库记录 → 展示结构（旧数据无 status/photos 时兜底） */
function mapReport(d) {
  const status = d.status || 'pending'
  return {
    id: d._id,
    venueId: d.venueId || '',
    venueName: d.venueName || '场地',
    type: d.type || '其他',
    desc: d.desc || '',
    photos: d.photos || [],
    status: status,
    statusText: STATUS_TEXT[status] || STATUS_TEXT.pending,
    reply: d.reply || '',
    replyAt: d.replyAt ? fmtRel(d.replyAt) : '',
    timeText: fmtRel(d.at),
  }
}

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    cloud.getMyReports().then((list) => {
      this.setData({ list: list.map(mapReport), loading: false })
    })
  },

  previewPhoto(e) {
    wx.previewImage({ urls: e.currentTarget.dataset.photos, current: e.currentTarget.dataset.src })
  },

  /* 报错关联的场地，点击回详情页核对信息 */
  goVenue(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
  },
})
