/* 我的：签到统计 + 编辑资料 + 入口 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const SKATE_YEARS = ['1年内', '1-3年', '3-5年', '5年以上']

Page({
  data: {
    user: store.getUser(),
    profileComplete: store.isProfileComplete(),
    city: '嘉兴',
    checkinCount: 0,
    reportCount: 0,
    recent: [],
    /* 编辑资料弹窗 */
    editOpen: false,
    saving: false,
    form: { nickname: '', skateYears: '', avatarFileID: '', avatarTemp: '' },
    years: SKATE_YEARS,
    icons: {
      chevron: ICON.chevron,
      flame: ICON.flame,
      pin: ICON.pin,
      file: ICON.file,
      settings: ICON.settings,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 3 })
    this.refresh()
    this.loadCounts()
  },

  refresh() {
    const s = store.calcStats()
    const recent = store.getState().checkins.slice(0, 3).map((c) => ({
      id: c.id,
      venueId: c.venueId,
      venueName: c.venueName,
      timeText: fmtRel(c.at),
    }))
    this.setData({
      checkinCount: s.total,
      recent: recent,
      city: store.getCity(),
      user: store.getUser(),
      profileComplete: store.isProfileComplete(),
    })
  },

  /* 报错计数（真实云数据） */
  loadCounts() {
    cloud.countMyReports().then((n) => {
      this.setData({ reportCount: n })
    })
  },

  /* ===== 编辑资料 ===== */
  openEdit() {
    const u = store.getUser()
    this.setData({
      editOpen: true,
      saving: false,
      form: { nickname: u.nickname, skateYears: u.skateYears, avatarFileID: u.avatarFileID, avatarTemp: '' },
    })
  },

  closeEdit() {
    if (this.data.saving) return
    this.setData({ editOpen: false })
  },

  noop() { /* 阻止冒泡关闭弹窗 */ },

  /* 微信官方头像填写能力：返回临时文件路径 */
  onChooseAvatar(e) {
    this.setData({ 'form.avatarTemp': e.detail.avatarUrl })
  },

  onNicknameInput(e) {
    this.setData({ 'form.nickname': e.detail.value })
  },

  onYearsChange(e) {
    this.setData({ 'form.skateYears': this.data.years[Number(e.detail.value)] })
  },

  saveProfile() {
    if (this.data.saving) return
    const f = this.data.form
    const nickname = (f.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const apply = (avatarFileID) => {
      store.saveProfile({
        nickname: nickname,
        avatarFileID: avatarFileID || f.avatarFileID,
        skateYears: f.skateYears,
      }).then(() => {
        this.setData({ editOpen: false, saving: false })
        this.refresh()
        wx.showToast({ title: '资料已保存', icon: 'success' })
      }).catch((e) => {
        this.setData({ saving: false })
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
        console.warn('[profile] 资料保存失败', (e && e.errCode) || (e && e.message))
      })
    }
    if (f.avatarTemp) {
      /* 新选了头像：先传云存储拿 fileID，再保存资料 */
      cloud.uploadAvatar(f.avatarTemp).then(apply).catch((e) => {
        this.setData({ saving: false })
        wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
        console.warn('[profile] 头像上传失败', (e && e.errCode) || (e && e.message))
      })
    } else {
      apply('')
    }
  },

  /* ===== 菜单跳转 ===== */
  goCheckins() { wx.switchTab({ url: '/pages/checkins/checkins' }) },
  goReports() { wx.showToast({ title: '报错记录即将上线', icon: 'none' }) },
  goSuggest() { wx.showToast({ title: '场地推荐即将上线', icon: 'none' }) },
  goSettings() { wx.showToast({ title: '设置即将上线', icon: 'none' }) },
  goVenue(e) { wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + e.currentTarget.dataset.id }) },
})
