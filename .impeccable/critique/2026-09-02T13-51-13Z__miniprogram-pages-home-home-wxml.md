---
target: homepage UX
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:D:\\myProjects\\skate\\miniprogram\\pages\\home\\home.wxml"
target_fingerprint: "sha256:8f86be8150e0a77e51a4dc0740a94585fdf587e832cf9151432c76b36c613c9e"
target_path: "D:\\myProjects\\skate\\miniprogram\\pages\\home\\home.wxml"
timestamp: 2026-09-02T13-51-13Z
slug: miniprogram-pages-home-home-wxml
---
# 首页 UX 设计评审（impeccable critique）

Target: miniprogram/pages/home/home.wxml (含 home.js/home.wxss/home.json, components/venue-card, components/shop-card)
Method: A = code-explorer 子代理 · B = 内联 CLI 检测器
DEGRADED: single-context (Assessment B 内联执行：无可执行命令的子代理工具)

## 设计健康评分：26/40 (Acceptable)

| # | 启发式 | 分数 | 关键问题 |
|---|--------|------|----------|
| 1 | 系统状态可见 | 3 | 云加载失败无状态，骨架无限转 |
| 2 | 贴近真实世界 | 4 | 滑手母语，全场最佳 |
| 3 | 用户控制与自由 | 2 | 取消清词；城市下拉无遮罩；地图折叠不可达 |
| 4 | 一致性与标准 | 2.5 | 深色实现 vs 浅色稿；两卡片语法不一；导航栏色缝 |
| 5 | 错误预防 | 3 | 授权弹窗好；cities 未加载可开空弹层 |
| 6 | 识别而非回忆 | 2.5 | 占位符超承诺；pin 语义无图例 |
| 7 | 灵活与效率 | 2.5 | 无最近搜索；map collapse 死代码 |
| 8 | 美学与极简 | 3.5 | 三个近值深面竞争 |
| 9 | 错误恢复 | 1 | 无 .catch、刷新失败静默 |
| 10 | 帮助与文档 | 2 | pin 图例、打卡入口零引导 |

## 设计特异性

LLM：状态语言高度产品化（此刻N人在场/今日已签到/滑手术语筛选），搜索与 IA 层模板化；8 份设计稿全浅色 vs 实现全深色，app.wxss 注释宣称"与设计稿一致"不实。
确定性扫描：0 发现（检测器面向 Web HTML/CSS，对 WXML 覆盖有限，0 发现不可作质量背书）。

## 优先问题

- [P0] 一框搜双实体未实现：refresh 按 entity 单边过滤（home.js:303-335），与产品规格冲突；场地 Tab 搜店名得假空态。修法：query 存在时双实体过滤分组展示。
- [P0] 首页无错误态与重试：loadVenues/loadShops 无 .catch（home.js:78-101），刷新失败静默（:211-213），空态无清除 CTA。修法：loaded/error 双状态 + 错误块 + 重试。
- [P1] 主题与设计稿背离：全浅色稿 vs 全深色实现；app.json 导航栏 #1A1A1E vs 页头 #111114 色缝。需显式裁决。
- [P1] 地图折叠死功能：toggleMap（home.js:195-197）与 .map-collapsed 无任何 wxml 绑定；设计稿手柄被丢。40vh 地图压列表出拇指区。
- [P1] 地图 pin 一色双义无图例：橙=热门或已打卡；气泡缺"距你230m"副行（高保真版:546-552）。
- [P2] 触达与一致性：venue-card 用 :active（真机不可靠）vs shop-card 用 hover-class；search-clear 40rpx、filter-chip 48rpx 低于 44pt；城市下拉无遮罩/可空打开；closeSearch 清词无提示；input 无 bindconfirm。
- [P3] Tab transition:font-size 抖动；注释与代码矛盾；店铺/俱乐部词汇混用；map-chip success 色用于计数；onShow/refresh 重复 buildMarkers。

## 角色走查

Jordan：搜店名假空态；pin 无图例；首页不见打卡入口。
Casey：地图死锁拇指区外；触点不达标；取消毁词。
Sam：chip 无选中态语义；对比度 ≈3.4:1 不达 AA；pin 纯靠颜色。

## 优势

1. 地图-列表同口径过滤 + 真实在线人数，双视图认知同步。
2. 令牌与图标纪律（语义色声明 + lucide 单一工厂）。
3. 骨架屏解剖学正确，无布局跳变。

## 挑衅性问题

1. 哪份文件在撒谎——浅色稿还是"与设计稿一致"注释？
2. 地图为何只是背景板？
3. 搜索该匹配名称、标签还是跨实体？规格写的是哪种？
