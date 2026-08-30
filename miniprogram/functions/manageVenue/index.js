const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/* 入参校验错误，抛给调用方 */
function invalid(msg) {
  const e = new Error(msg)
  e.code = 'INVALID'
  throw e
}

/* 校验调用者是管理员（config/admins.openids 白名单） */
async function assertAdmin(OPENID) {
  if (!OPENID) invalid('无身份')
  const r = await db.collection('config').doc('admins').get()
  const openids = (r.data && r.data.openids) || []
  if (!openids.includes(OPENID)) {
    const e = new Error('无管理员权限，你的 openid: ' + OPENID)
    e.code = 'FORBIDDEN'
    throw e
  }
}

/* 生成实体 id */
function genId(prefix) {
  return prefix + '-' + Date.now().toString(36)
}

/* 必填与类型校验 */
function validateVenue(d) {
  if (!d.name || typeof d.name !== 'string' || d.name.length > 30) invalid('场地名称必填(≤30字)')
  if (!d.city || typeof d.city !== 'string') invalid('城市必填')
  if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') invalid('坐标必填(数字)')
  if (!d.category) invalid('场地类型必填')
  if (d.photos && !Array.isArray(d.photos)) invalid('照片格式错误')
}

function validateShop(d) {
  if (!d.name || typeof d.name !== 'string' || d.name.length > 30) invalid('店铺名称必填(≤30字)')
  if (!d.city || typeof d.city !== 'string') invalid('城市必填')
  if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') invalid('坐标必填(数字)')
  if (!Array.isArray(d.services) || d.services.length === 0) invalid('服务项目至少选一项')
  if (d.phone && !/^[0-9\-+ ]{5,20}$/.test(d.phone)) invalid('电话格式错误')
  if (d.photos && !Array.isArray(d.photos)) invalid('照片格式错误')
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action

  try {
    /* 查权限：管理页进入时调用，无权限时把 openid 带回去方便复制加白 */
    if (action === 'check') {
      const r = await db.collection('config').doc('admins').get()
      const openids = (r.data && r.data.openids) || []
      return { ok: openids.includes(OPENID), openid: OPENID }
    }

    await assertAdmin(OPENID)
    const data = event.data || {}

    switch (action) {
      /* ===== 场地 ===== */
      case 'addVenue': {
        validateVenue(data)
        const doc = {
          id: data.id || genId('v'),
          city: data.city,
          name: data.name,
          rating: 0,
          distance: '',
          latitude: data.latitude,
          longitude: data.longitude,
          category: data.category,
          online: 0,
          hot: !!data.hot,
          address: data.address || '',
          shortAddr: data.shortAddr || data.address || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          feed: [],
        }
        await db.collection('venues').add({ data: doc })
        return { ok: true, id: doc.id }
      }
      case 'updateVenue': {
        validateVenue(data)
        if (!data.id) invalid('缺少 id')
        await db.collection('venues').where({ id: data.id }).update({
          data: {
            city: data.city,
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            category: data.category,
            hot: !!data.hot,
            address: data.address || '',
            shortAddr: data.shortAddr || data.address || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            photos: Array.isArray(data.photos) ? data.photos : [],
          },
        })
        return { ok: true }
      }
      case 'deleteVenue': {
        if (!data.id) invalid('缺少 id')
        await db.collection('venues').where({ id: data.id }).remove()
        return { ok: true }
      }

      /* ===== 店铺 ===== */
      case 'addShop': {
        validateShop(data)
        const doc = {
          id: data.id || genId('s'),
          city: data.city,
          name: data.name,
          services: data.services,
          address: data.address || '',
          shortAddr: data.shortAddr || data.address || '',
          latitude: data.latitude,
          longitude: data.longitude,
          phone: data.phone || '',
          hours: data.hours || { open: '09:00', close: '21:00' },
          photos: Array.isArray(data.photos) ? data.photos : [],
          hot: !!data.hot,
        }
        await db.collection('shops').add({ data: doc })
        return { ok: true, id: doc.id }
      }
      case 'updateShop': {
        validateShop(data)
        if (!data.id) invalid('缺少 id')
        await db.collection('shops').where({ id: data.id }).update({
          data: {
            city: data.city,
            name: data.name,
            services: data.services,
            address: data.address || '',
            shortAddr: data.shortAddr || data.address || '',
            latitude: data.latitude,
            longitude: data.longitude,
            phone: data.phone || '',
            hours: data.hours || { open: '09:00', close: '21:00' },
            photos: Array.isArray(data.photos) ? data.photos : [],
            hot: !!data.hot,
          },
        })
        return { ok: true }
      }
      case 'deleteShop': {
        if (!data.id) invalid('缺少 id')
        await db.collection('shops').where({ id: data.id }).remove()
        return { ok: true }
      }

      default:
        invalid('未知操作: ' + action)
    }
  } catch (e) {
    return { ok: false, code: e.code || 'ERROR', msg: (e && e.message) || '操作失败' }
  }
}
