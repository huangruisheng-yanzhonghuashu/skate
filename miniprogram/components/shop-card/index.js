/* 店铺卡片：服务标签 + 营业状态 + 拨号 */
const cloud = require('../../utils/cloud.js')

Component({
  properties: {
    shop: { type: Object, value: null },
    index: { type: Number, value: 0 },
  },

  data: {
    status: '',
    openNow: false,
  },

  observers: {
    shop(shop) {
      if (!shop) return
      const status = cloud.openStatus(shop)
      this.setData({ status: status, openNow: status === '营业中' })
    },
  },

  methods: {
    go() {
      this.triggerEvent('go', { id: this.data.shop.id })
    },
    call(e) {
      /* 拨号按钮：阻止卡片点击冒泡 */
      const phone = e.currentTarget.dataset.phone
      if (!phone) {
        wx.showToast({ title: '该店铺未留电话', icon: 'none' })
        return
      }
      wx.makePhoneCall({ phoneNumber: phone, fail: function () { /* 用户取消 */ } })
    },
  },
})
