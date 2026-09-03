---
name: skate-data-scraper
description: 按城市抓取滑板数据（场地 + 机构「板店/俱乐部/培训机构」+ org↔venue 关联），清洗去重后输出对齐小程序 admin 入库 schema 的 JSON 种子文件。触发词：抓取/采集某城市的滑板场地、滑板店、滑板俱乐部、滑板培训机构数据。
globs:
alwaysApply: false
---

# Skate 数据抓取 Skill

按城市抓取「场地 + 机构 + org↔venue 关联」三类数据，产出待人工核对的 JSON 种子文件。

## 实体模型（已验证，勿改）

- **两类实体**：`venue`（场地）、`org`（机构，入库为 shop 集合）。
- **机构用 category 三分**：板店 / 俱乐部 / 培训机构。不拆第四类实体。
- **机构用 services 表达能力**：一个实体可同时具备多种能力（50 滑板 = 零售+教学+组织活动；VBOY = 教学+零售+场地运营）。
- **org↔venue 关联**：机构会拥有场地（VBOY 自带板场）、驻场（滑板公元开在临空公园里）、合作教学。关联通过后处理规则解析，不是独立抓取阶段。
- **城市能级规律**（抓取时的先验）：低线城市板店/纯培训机构趋近于零（合并进俱乐部），高线城市三者分化清晰；低线城市场地以免费公共场地为主。

## 工作流

### Phase 1 — 检索计划

输入：城市名 `{city}`（如「嘉兴」「杭州」，可含区县限定）。生成以下搜索批次，用 web_search 分批并行执行（每批 3-4 条）：

**批次 A — 场地（POI 类，数据质量最好）：**

```
{city} 滑板场 滑板公园 地址
{city} 滑板场 免费 泵道 碗池
{city} 极限运动公园 滑板场
{city} 街式滑板 spot 地形 板场
```

**批次 B — 机构：**

```
{city} 滑板店 板店 装备
{city} 滑板俱乐部
{city} 滑板培训 少儿滑板班 教练
{city} 滑板俱乐部 比赛联赛 参赛单位
```

**批次 C — 补漏（首轮之后按缺口追加）：**

```
{city} 下辖区县名 + 滑板（大城市的区县级补搜）
{city} 室内滑板场 滑板馆
site:huodong.com {city} 滑板场馆（垂直场馆目录站，效率高）
{city} 滑板贴吧 / 小红书 {city} 滑板（street spots 与社群线索）
```

检索终止条件：连续一批搜索无新增实体（去重后）即停止；单城市预期 10-40 条（低线 ~10，一线 30+），显著超出需警惕广告噪声。

### Phase 2 — 抽取

对每条搜索结果抽取候选实体。数据源优先级：

1. **官媒/政府报道、百科、亚运/赛事页面**（场地名、地址、收费最可靠）
2. **垂直场馆目录站**（huodong.com 等，场地+电话+收费）
3. **点评/地图类站点**（营业时间、电话、机构类目）
4. **工商信息**（爱企查/企查查/天眼查：注册地址、经营者、成立时间、经营异常——机构存活的硬证据）
5. **社媒**（抖音/小红书/公众号：机构活跃度、教学招生、street spots）
6. **论坛/贴吧**（street spots、社群线索，置信度最低）

### Phase 3 — 清洗规则（硬规则，逐条执行）

1. **去重键**：`name 归一化 + city + 经纬度 500m`。工商名/店铺名/社媒名视为同一实体别名，主名取点评/社媒用名，工商名存入 `legalName` 供核验。
2. **反作弊**：同电话出现于多个不同名称条目 + 模板化文案（典型：二手分类广告站）→ 全部丢弃。
3. **字段冲突**：多来源字段值不一致时保留多来源值 + source 溯源，标记 `needVerify: true`，禁止自动择一。
4. **status 判定**：工商异常名录 / 社媒停更超 1 年 / 点评近半年无动态 → `status: '待核实'`。
5. **置信度标注**：每条实体标 `confidence: '高'|'中'|'低'`（来源层级 1-2 为高，3-4 为中，5-6 为低）。

### Phase 4 — org↔venue 关联解析

全部实体抽取完后跑一轮匹配，产出 `relations`：

| 类型 | 判定规则 | 动作 |
|---|---|---|
| org 拥有场地 | org 描述含“室内板场/场地面积/滑板公园”且可独立成场地（如 VBOY 1800㎡ 板场） | 额外产出一条 venue 记录，`operator` 指回该 org |
| org 驻场 | org 名称/地址包含某 venue 名称，或地理编码距离 <500m（滑板公元 ↔ 临空滑板公园） | org 的 `partnerVenues` 加入该 venue |
| 合作教学点 | org 宣传“上课地点：XX 滑板公园”等名称匹配 | 同上 |

名称部分匹配（非全等）的关联标 `needVerify: true`。

### Phase 5 — 输出

写入 `d:/myProjects/skate/_data/scraped/{city}.json`（目录不存在则创建；文件已存在则合并去重后覆写，不丢旧条目）：

```jsonc
{
  "city": "嘉兴",
  "scrapedAt": "2026-09-03",
  "venues": [
    {
      "kind": "venue",
      "name": "嘉兴火车站南广场滑板公园",
      "city": "嘉兴",
      "category": "混合",            // 混合/碗池/街式/平地/U池/泵道/街式地形
      "tags": [{ "label": "免费", "icon": "tagFree" }],  // label ∈ 免费/收费/有灯/无灯/水泥/木质
      "address": "",
      "shortAddr": "",               // address 前 10 字
      "latitude": null,              // 拿不到就 null，导入时地图选点补
      "longitude": null,
      "indoor": false,
      "lighting": false,
      "fee": "免费",                  // 免费/付费/未知
      "features": ["双循环泵道", "心形碗池"],
      "operator": "",                // 运营方 org 名，无则空
      "photos": [],
      "hot": false,
      "status": "营业中",             // 营业中/待核实/已关闭
      "confidence": "高",
      "needVerify": false,
      "sources": ["https://..."]
    }
  ],
  "orgs": [
    {
      "kind": "shop",
      "name": "爱滑板俱乐部",
      "legalName": "嘉兴市经开城南爱滑运动俱乐部",
      "city": "嘉兴",
      "category": "俱乐部",           // 板店/俱乐部/培训机构
      "services": ["教学", "组织活动", "场地运营"],  // ∈ 零售/教学/维修/组织活动/装备租赁/场地运营
      "address": "",
      "shortAddr": "",
      "latitude": null,
      "longitude": null,
      "phone": "",
      "hours": { "open": "13:00", "close": "21:00" },
      "partnerVenues": ["场地名引用"], // 与 venues[].name 对应
      "courses": [],                  // 仅教学类：年龄段/班型，不抓价格
      "social": { "douyin": "", "wechat": "" },
      "photos": [],
      "hot": false,
      "status": "营业中",
      "confidence": "高",
      "needVerify": false,
      "sources": ["https://..."]
    }
  ],
  "relations": [
    { "org": "org 名", "venue": "venue 名", "type": "驻场|拥有|合作", "needVerify": false }
  ],
  "dropped": [  // 被清洗规则丢弃的候选（防重复抓取时误判为新增）
    { "name": "", "reason": "同电话模板广告" }
  ]
}
```

### Phase 6 — 汇报

抓取完成后向用户输出简报：实体计数（按 category 分）、关联数、置信度分布、被丢弃条目数、待人工核实清单（needVerify 项）、数据缺口（如“本市未发现独立板店”）。

## 导入前置（对用户说明，不在本 skill 内执行）

1. `pages/admin/admin.js` 的 `CATEGORIES`（场地）需扩入 `泵道`、`街式地形`；`SERVICES` 需扩入 `组织活动`、`装备租赁`、`场地运营`；机构 category 三分需按改版方案落地。
2. `latitude/longitude` 为 null 的条目需在管理表单「地图选点」补坐标后才能保存（admin 表单硬校验）。
3. `photos` 抓取阶段不下载图片（版权），导入时人工配图。
