/* 我的签到：统计 + 日历 + 排行榜 + 打卡记录（可删除） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')
const { fmtRel } = require('../../utils/format.js')

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const BOARD_LIMIT = 20

Page({
  data: {
    stats: { total: 0, streak: 0, weekDays: 0 },
    weekLabels: WEEK_LABELS,
    cells: [],
    monthTitle: '',
    board: [],
    boardExpanded: false,
    boardLoaded: false,
    records: [],
    icons: {
      trophy: ICON.trophyOrange,
      flame: ICON.flameOrangeStat,
      calendar: ICON.calendarOrange,
      pin: ICON.pinOrange,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 2 })
    this.refresh()
    if (!this.data.boardLoaded) this.loadBoard(this.data.boardExpanded)
  },

  /* 云端排行榜：聚合所有人场地签到数（店铺打卡不计入），需 checkins"所有用户可读"权限 */
  loadBoard(expanded) {
    cloud.getLeaderboard(expanded ? BOARD_LIMIT : 5).then((board) => {
      this.setData({ board, boardLoaded: true })
    })
  },

  /* 下拉刷新：统计/日历/记录/榜单全量重取 */
  onPullDownRefresh() {
    this.refresh()
    this.loadBoard(this.data.boardExpanded)
    wx.stopPullDownRefresh()
  },

  toggleBoard() {
    const expanded = !this.data.boardExpanded
    this.setData({ boardExpanded: expanded })
    if (expanded) {
      this.loadBoard(true)
      wx.showToast({ title: '已展开完整榜单', icon: 'none' })
    } else {
      this.loadBoard(false)
    }
  },

  refresh() {
    const s = store.calcStats()
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, checked: s.monthDays.has(d), isToday: d === now.getDate() })
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0 })

    /* 打卡记录（最近 30 条）：地点 + 类型 + 时间 + 留言 + 首图 */
    const records = store.getState().checkins.slice(0, 30).map((c) => ({
      id: c.id,
      venueId: c.venueId,
      venueName: c.venueName,
      kind: c.kind || 'venue',
      timeText: fmtRel(c.at),
      note: c.note || '',
      photo: (c.photos && c.photos[0]) || '',
    }))

    this.setData({
      stats: { total: s.total, streak: s.streak, weekDays: s.weekDays },
      cells,
      records,
      monthTitle: '签到日历（' + (month + 1) + '月）',
    })
  },

  /* 打卡记录：点击进对应详情页 */
  goRecord(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 打卡记录：删除（二次确认，本地+云端） */
  delRecord(e) {
    const id = e.currentTarget.dataset.id
    const rec = this.data.records.find((r) => r.id === id)
    wx.showModal({
      title: '删除打卡',
      content: '删除「' + (rec ? rec.venueName : '该打卡') + '」的这条打卡记录？',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        store.deleteCheckin(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.refresh()
        })
      },
    })
  },

  previewRecordPhoto(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] })
  },
})
