/* 全局配置 */
module.exports = {
  /* 腾讯位置服务 Key（用于逆地理编码：经纬度 → 城市名）
   * 申请地址：https://lbs.qq.com/dev/console/application/mine （免费，选"WebService API"）
   * 留空时的行为：地图仍会定位到当前位置，但不会自动切换城市 */
  QQ_MAP_KEY: '',

  /* ===== 场地实时在线人数（方案 B：位置心跳） ===== */
  /* 心跳有效窗口：距上次心跳超过该时长的用户不计入"此刻在场"。
   * 窗口语义需对用户透明（详情页 0 人时显示"近 30 分钟暂无滑手在场"） */
  ONLINE_WINDOW_MIN: 30,
  /* 心跳上报间隔（详情页前台停留期间，毫秒） */
  HEARTBEAT_INTERVAL_MS: 60000,
  /* 在场距离阈值：定位点距场地超过该距离不上报心跳（米） */
  PRESENCE_RADIUS_M: 500,
}
