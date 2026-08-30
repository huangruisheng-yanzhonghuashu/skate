const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/* 内容安全校验：security.msgSecCheck（v2）
 * 必须服务端调用（客户端 SDK 无此接口），openid 从调用上下文取，杜绝伪造他人身份送检
 * 返回：{ ok, msg?, degraded? }
 *   ok=true              通过
 *   ok=false, msg=原因    拦截（87014 / suggest=risk|review）
 *   ok=true, degraded    接口本身不可用（未认证/权限未开/服务异常）——降级放行，
 *                        不阻塞正常用户；生产环境建议改为拦截 + 修复配置 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const content = (event.content || '').toString().trim()
  if (!content) return { ok: false, msg: '内容为空' }
  if (content.length > 500) return { ok: false, msg: '内容过长' }

  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid: OPENID,
      content: content,
      version: 2,
      scene: 2, /* 2 = 评论场景 */
    })
    /* v2 返回 result.suggest: 'pass' | 'review' | 'risk' */
    const suggest = r.result && r.result.suggest
    if (suggest === 'pass') return { ok: true }
    if (suggest === 'review') return { ok: false, msg: '内容待审核，暂不能发布' }
    return { ok: false, msg: '内容包含违规信息，请修改后发布' }
  } catch (e) {
    /* 87014 = 内容含违法违规信息 */
    if (e.errCode === 87014) {
      return { ok: false, msg: '内容包含违规信息，请修改后发布' }
    }
    /* 其余失败（-1 / 604100 权限未开 / 超时等）：降级放行并留痕，不阻塞正常用户 */
    console.error('[checkMsg] msgSecCheck 不可用，降级放行', e.errCode, e.errMsg)
    return { ok: true, degraded: true, msg: '安全校验暂不可用，已放行' }
  }
}
