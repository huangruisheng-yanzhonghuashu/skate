/* 全局配置 */
module.exports = {
  /* 腾讯位置服务 Key（用于逆地理编码：经纬度 → 城市名）
   * 申请地址：https://lbs.qq.com/dev/console/application/mine （免费，选"WebService API"）
   * 申请后还需在小程序后台（mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名）
   * 把 https://apis.map.qq.com 加入 request 合法域名，真机才可请求
   * 留空时的行为：定位成功后用「最近的场地/店铺」所在城市兜底（零配置可用，
   * 精度取决于场地分布），城市仍可手动切换 */
  QQ_MAP_KEY: 'O2LBZ-QKSC3-AGT3S-O7ESO-X5UOF-HWFUJ',

  /* 腾讯位置服务 Key 对应的 SK（Key 开启了「签名校验」授权方式时必填）
   * 签名规则见 utils/qqmap.js；若在控制台改用免签名授权方式可留空 */
  QQ_MAP_SK: 'k01fd53Zm7WF6678v0MVhPlYsUvyFyPP',

  /* ===== 场地实时在线人数（方案 B：位置心跳） ===== */
  /* 心跳有效窗口：距上次心跳超过该时长的用户不计入"此刻在场"。
   * 窗口语义需对用户透明（详情页 0 人时显示"近 30 分钟暂无滑手在场"） */
  ONLINE_WINDOW_MIN: 30,
  /* 心跳上报间隔（详情页前台停留期间，毫秒） */
  HEARTBEAT_INTERVAL_MS: 60000,
  /* 在场距离阈值：定位点距场地超过该距离不上报心跳（米） */
  PRESENCE_RADIUS_M: 500,

  /* ===== 品牌字体 ===== */
  /* 首页字标「滑哪儿」用字体：得意黑 Smiley Sans（开源 OFL 协议，斜体窄字、运动感）
   * woff 文件需自行托管到 https 地址后填到这里（留空则跳过加载，回退系统粗体）。
   * 真机生效还需在小程序后台把字体所在域名加入 downloadFile 合法域名。
   * 获取：https://github.com/atelier-anchor/smiley-sans （releases 内含 woff2/woff） */
  BRAND_FONT_URL: '',
}
