const { LEADERBOARD } = require('../../data/mock.js')
const store = require('../../utils/store.js')
const { ICON } = require('../../utils/icons.js')

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    stats: { total: 0, streak: 0, weekDays: 0 },
    weekLabels: WEEK_LABELS,
    cells: [],
    monthTitle: '',
    board: LEADERBOARD,
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

    this.setData({
      stats: { total: s.total, streak: s.streak, weekDays: s.weekDays },
      cells,
      monthTitle: '签到日历（' + (month + 1) + '月）',
    })
  },

  showAllBoard() {
    wx.showToast({ title: '完整排行榜即将开放', icon: 'none' })
  },
})
