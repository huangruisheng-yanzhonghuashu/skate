/* 腾讯位置服务 WebService 请求封装（含签名校验）
 * 签名规则（https://lbs.qq.com/faq/serverFaq/webServiceKey）：
 * 1. 请求参数按参数名升序排序
 * 2. 拼接 path?k1=v1&k2=v2...（原始值，不做 URL 编码）
 * 3. 末尾追加 SK，md5 结果作为 sign 参数随请求发送
 * SK 留空时不签名（Key 关闭签名校验的场景） */
const { md5 } = require('./md5.js')
const { QQ_MAP_SK } = require('./config.js')

const HOST = 'https://apis.map.qq.com'

/* 生成带签名的请求参数（独立导出便于单测） */
function buildSignedParams(path, params) {
  /* 剔除空值，保证「签名原文」与「实际发送参数」一致 */
  const clean = {}
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v !== '' && v !== undefined && v !== null) clean[k] = v
  })
  if (!QQ_MAP_SK) return clean
  const raw = path + '?' + Object.keys(clean).sort().map((k) => k + '=' + clean[k]).join('&') + QQ_MAP_SK
  clean.sig = md5(raw)
  return clean
}

function request(path, params) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: HOST + path,
      data: buildSignedParams(path, params),
      success: (r) => {
        const res = r.data || {}
        if (res.status === 0) {
          resolve(res.result)
        } else {
          console.warn('[qqmap] 请求失败', res.status, res.message)
          reject(new Error('status ' + res.status + ' ' + (res.message || '请求失败')))
        }
      },
      fail: (e) => {
        console.warn('[qqmap] 网络请求失败', (e && e.errMsg) || e)
        reject(new Error('网络请求失败（检查域名白名单）'))
      },
    })
  })
}

module.exports = { request, buildSignedParams }
