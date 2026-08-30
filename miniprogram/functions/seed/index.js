const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/* 场地图片（与小程序端展示一致的生成式图片 URL） */
function genImg(prompt, imageSize) {
  imageSize = imageSize || 'landscape_16_9'
  return 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
    encodeURIComponent(prompt) + '&image_size=' + imageSize
}

const IMG_STATION = genImg('wide angle photo of an urban concrete skatepark near a modern railway station, ramps and flat ground, several skaters riding, golden hour light, photorealistic')
const IMG_PUMP = genImg('photo of an asphalt pump track with rolling bumps and berms in a city park, kids riding skateboards and bikes, sunny day, photorealistic')
const IMG_FLAT = genImg('photo of a flat open concrete plaza in a lakeside park with young skaters practicing ollies, trees and water in background, photorealistic')
const IMG_STREET = genImg('photo of a street style skate spot in a green city park with low granite ledges and rails, one skater grinding, photorealistic')
const IMG_LAKE = genImg('photo of a wide lakeside plaza skate spot with smooth concrete ground, skaters cruising at sunset, photorealistic')

const FEED_IMGS = [
  genImg('action photo of a skateboarder landing a kickflip in a concrete skatepark, motion, photorealistic', 'square'),
  genImg('photo of skateboard gear deck wheels spread on skatepark floor, top view, warm light, photorealistic', 'square'),
  genImg('photo of a skater carving on a pump track berm at sunset, silhouette, photorealistic', 'square'),
  genImg('photo of a brand new skateboard deck held in hands at a skatepark, shallow depth of field, photorealistic', 'square'),
  genImg('photo of skaters cruising on a lakeside plaza, urban park, photorealistic', 'square'),
  genImg('photo of a kid on a skateboard riding a pump track, low angle, blue sky, photorealistic', 'square'),
]

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

/* 杭州场地种子数据（含 city 字段，城市列表由该字段聚合生成）
 * 真实场地：钱塘轮滑中心滑板公园（5660㎡，2025-03 升级开园）、亚运滑板公园（东部湾总部基地）、
 * BAC 社区滑板场（MOREPRK）、奥体"大莲花"、黄龙体育中心 */
const SEED_HZ_VENUES = [
  {
    id: 'hz-qiantang-wheel',
    city: '杭州',
    name: '钱塘轮滑中心滑板公园',
    rating: 4.8,
    distance: '0.6km',
    latitude: 30.3140,
    longitude: 120.3655,
    category: '混合',
    online: 20,
    hot: true,
    address: '钱塘区拾里路100号钱塘轮滑中心北侧',
    shortAddr: '钱塘轮滑中心（拾里路）',
    tags: [
      { label: '混合', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
      { label: '水泥', icon: 'tagCement' },
    ],
    photos: [IMG_STATION, IMG_STREET, IMG_FLAT, IMG_PUMP],
    feed: [
      { user: '滑板阿凯', avatar: 'AK', color: '#FF5A36', time: '1小时前', text: '升级后的公园太顶了，街式区台阶扶手全套！' },
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '5小时前', text: '碗池过渡顺滑，专业训练级别，杭州最佳。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '昨天', text: '5600平随便造，就是周末人多，早点来。' },
    ],
  },
  {
    id: 'hz-asiad-park',
    city: '杭州',
    name: '亚运滑板公园',
    rating: 4.5,
    distance: '1.8km',
    latitude: 30.3095,
    longitude: 120.3925,
    category: '混合',
    online: 9,
    hot: false,
    address: '钱塘区东部湾总部基地，22号大街与之江东路交叉口',
    shortAddr: '东部湾（之江东路）',
    tags: [
      { label: '混合', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '无灯', icon: 'tagLight' },
    ],
    photos: [IMG_PUMP, IMG_STREET, IMG_STATION],
    feed: [
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '4小时前', text: '沿江风景好，滑完板看江景，舒服！' },
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '2天前', text: '场地维护得不错，抛台和弧面都很稳。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '4天前', text: '傍晚人多，白天来基本包场。' },
    ],
  },
  {
    id: 'hz-bac-moreprk',
    city: '杭州',
    name: 'BAC 社区滑板场（MOREPRK）',
    rating: 4.6,
    distance: '4.2km',
    latitude: 30.2075,
    longitude: 120.2050,
    category: '街式',
    online: 10,
    hot: false,
    address: '滨江区 MOREPRK 滑板公园',
    shortAddr: '滨江区（MOREPRK）',
    tags: [
      { label: '街式', icon: 'tagMixed' },
      { label: '收费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_STREET, IMG_FLAT, IMG_LAKE],
    feed: [
      { user: '阿强', avatar: 'AQ', color: '#2A8CFF', time: '3小时前', text: 'BAC 日常化路线，新手也能玩得开心。' },
      { user: '板仔小张', avatar: '张', color: '#FF5A36', time: '3天前', text: '商业场维护到位，道具天天有人收拾。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '1周前', text: '夜滑氛围好，认识了不少本地滑手。' },
    ],
  },
  {
    id: 'hz-olotus-plaza',
    city: '杭州',
    name: '奥体"大莲花"极限广场',
    rating: 4.3,
    distance: '5.5km',
    latitude: 30.2280,
    longitude: 120.2260,
    category: '平地',
    online: 12,
    hot: true,
    address: '滨江区飞虹路3号奥体博览城',
    shortAddr: '奥体博览城（飞虹路）',
    tags: [
      { label: '平地', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_FLAT, IMG_LAKE, IMG_STREET],
    feed: [
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '2小时前', text: '大莲花下面刷板，夜景无敌，游客都来拍。' },
      { user: '阿凯', avatar: 'AK', color: '#FF5A36', time: '昨天', text: '广场超大面积平地，平花练习圣地。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '5天前', text: '晚上灯全开，滑到十点都没问题。' },
    ],
  },
  {
    id: 'hz-huanglong',
    city: '杭州',
    name: '黄龙体育中心室外广场',
    rating: 4.0,
    distance: '7.6km',
    latitude: 30.2665,
    longitude: 120.1335,
    category: '平地',
    online: 6,
    hot: false,
    address: '西湖区黄龙路1号黄龙体育中心',
    shortAddr: '黄龙体育中心',
    tags: [
      { label: '平地', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_LAKE, IMG_FLAT, IMG_PUMP],
    feed: [
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '昨天 19:00', text: '市区最方便的平地块，地铁直达。' },
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '4天前', text: '新手练滑行的好地方，地面平整。' },
      { user: '阿强', avatar: 'AQ', color: '#2A8CFF', time: '1周前', text: '广场舞阿姨和滑板共用，注意错峰。' },
    ],
  },
]

/* 嘉兴场地种子数据（含 city 字段，城市列表由该字段聚合生成）
 * 场地取自真实地点：嘉兴火车站滑板公园（南湖晚报报道）、中央公园泵道（中环南路×纺工路）、
 * 凌公塘公园、秀湖公园、湘家荡 */
const SEED_VENUES = [
  {
    id: 'jx-railway',
    city: '嘉兴',
    name: '嘉兴火车站滑板公园',
    rating: 4.6,
    distance: '0.8km',
    latitude: 30.7475,
    longitude: 120.7665,
    category: '混合',
    online: 14,
    hot: true,
    address: '南湖区城东路嘉兴火车站北广场',
    shortAddr: '火车站北广场',
    tags: [
      { label: '混合', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_STATION, IMG_PUMP, IMG_FLAT, IMG_STREET],
    feed: [
      { user: '滑板阿凯', avatar: 'AK', color: '#FF5A36', time: '2小时前', text: '火车站新场子坡道很顺，傍晚人超多！' },
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '6小时前', text: '灯光很亮，夜滑没问题，新手也能练。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '昨天', text: '周末小朋友多，建议上午来包场。' },
    ],
  },
  {
    id: 'jx-central-pump',
    city: '嘉兴',
    name: '中央公园泵道滑板公园',
    rating: 4.7,
    distance: '2.1km',
    latitude: 30.7385,
    longitude: 120.7745,
    category: '混合',
    online: 18,
    hot: true,
    address: '南湖区中环南路与纺工路交汇处中央公园',
    shortAddr: '中央公园（纺工路）',
    tags: [
      { label: '混合', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '无灯', icon: 'tagLight' },
    ],
    photos: [IMG_PUMP, IMG_STATION, IMG_FLAT],
    feed: [
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '3小时前', text: '泵道太好玩了，第一次刷嘉兴最大的泵道！' },
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '昨天', text: '弯壁压实得很滑，陆地冲浪板绝配。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '3天前', text: '周末人多，滑板和泵道车分开各玩各的。' },
    ],
  },
  {
    id: 'jx-linggongtang',
    city: '嘉兴',
    name: '凌公塘公园街式区',
    rating: 4.2,
    distance: '3.5km',
    latitude: 30.7505,
    longitude: 120.7915,
    category: '街式',
    online: 6,
    hot: false,
    address: '南湖区双溪路凌公塘公园内',
    shortAddr: '凌公塘公园（双溪路）',
    tags: [
      { label: '街式', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '水泥', icon: 'tagCement' },
    ],
    photos: [IMG_STREET, IMG_FLAT, IMG_STATION],
    feed: [
      { user: '阿强', avatar: 'AQ', color: '#2A8CFF', time: '昨天 15:00', text: '矮台刚清理过，滑行很干净。' },
      { user: '板仔小张', avatar: '张', color: '#FF5A36', time: '4天前', text: '适合练 50-50 和 boardslide，杆子不高。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '1周前', text: '树荫多，夏天下午也不晒。' },
    ],
  },
  {
    id: 'jx-xiuhu',
    city: '嘉兴',
    name: '秀湖公园平地广场',
    rating: 4.3,
    distance: '6.8km',
    latitude: 30.7655,
    longitude: 120.7085,
    category: '平地',
    online: 5,
    hot: false,
    address: '秀洲区秀湖公园东广场',
    shortAddr: '秀湖公园东广场',
    tags: [
      { label: '平地', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_FLAT, IMG_LAKE, IMG_STREET],
    feed: [
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '5小时前', text: '东广场地面很平，练 ollie 完美。' },
      { user: '阿凯', avatar: 'AK', color: '#FF5A36', time: '2天前', text: '晚上灯光够亮，遛弯的行人注意避让。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '5天前', text: '秀洲这边最舒服的平地块，推荐！' },
    ],
  },
  {
    id: 'jx-xiangjiadang',
    city: '嘉兴',
    name: '湘家荡环湖广场',
    rating: 4.0,
    distance: '9.5km',
    latitude: 30.7835,
    longitude: 120.8020,
    category: '平地',
    online: 3,
    hot: false,
    address: '南湖区七星街道湘家荡环湖景区',
    shortAddr: '湘家荡环湖景区',
    tags: [
      { label: '平地', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '无灯', icon: 'tagLight' },
    ],
    photos: [IMG_LAKE, IMG_FLAT, IMG_PUMP],
    feed: [
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '昨天 18:00', text: '环湖广场看日落刷街，氛围无敌。' },
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '4天前', text: '地面大平坡，适合长板巡航新手。' },
      { user: '阿强', avatar: 'AQ', color: '#2A8CFF', time: '1周前', text: '离市区远，但周末值回车程。' },
    ],
  },
]

/* 动态种子数据（嘉兴 + 杭州） */
const SEED_FEEDS = [
  { id: 'f1', user: '板仔小张', avatar: '板仔', avatarColor: '#FF5A36', venueId: 'jx-railway', at: hoursAgo(2), text: '火车站滑板公园傍晚人超多，爽滑两小时！', photos: [FEED_IMGS[0], FEED_IMGS[1]], likes: 15, comments: 3 },
  { id: 'f2', user: '小美', avatar: '小美', avatarColor: '#00D4AA', venueId: 'jx-central-pump', at: hoursAgo(26), text: '第一次刷中央公园泵道，全程不推地，太上头了！', photos: [FEED_IMGS[2]], likes: 8, comments: 1 },
  { id: 'f3', user: '阿强', avatar: '阿强', avatarColor: '#2A8CFF', venueId: 'jx-linggongtang', at: hoursAgo(31), text: '凌公塘新板到了，矮台练新招！', photos: [FEED_IMGS[3], FEED_IMGS[4], FEED_IMGS[5]], likes: 23, comments: 5 },
  { id: 'f4', user: '大龙', avatar: '大龙', avatarColor: '#4D4D4D', venueId: 'jx-xiuhu', at: hoursAgo(76), text: '秀湖东广场地面是真平，ollie 姿势终于稳了。', photos: [FEED_IMGS[5], FEED_IMGS[0]], likes: 31, comments: 7 },
  { id: 'f5', user: 'LeoYoung', avatar: 'LY', avatarColor: '#FFB800', venueId: 'jx-xiangjiadang', at: hoursAgo(102), text: '湘家荡环湖刷街看日落，嘉兴最舒服的巡航路线。', photos: [FEED_IMGS[4]], likes: 12, comments: 2 },
  { id: 'f6', user: '阿凯', avatar: 'AK', avatarColor: '#FF5A36', venueId: 'hz-qiantang-wheel', at: hoursAgo(1), text: '钱塘轮滑中心升级后首刷，碗池太顺了，杭州最强场地！', photos: [FEED_IMGS[0], FEED_IMGS[3]], likes: 42, comments: 9 },
  { id: 'f7', user: 'LeoYoung', avatar: 'LY', avatarColor: '#2A8CFF', venueId: 'hz-olotus-plaza', at: hoursAgo(5), text: '大莲花夜景刷板，平花练习 + 拍照两不误。', photos: [FEED_IMGS[4], FEED_IMGS[1]], likes: 28, comments: 4 },
  { id: 'f8', user: '小美', avatar: '小美', avatarColor: '#00D4AA', venueId: 'hz-asiad-park', at: hoursAgo(9), text: '亚运滑板公园沿江太舒服了，滑完看日落。', photos: [FEED_IMGS[2]], likes: 17, comments: 2 },
  { id: 'f9', user: 'MarsChen', avatar: 'MC', avatarColor: '#FFB800', venueId: 'hz-bac-moreprk', at: hoursAgo(28), text: 'BAC 夜滑局，道具维护得真干净，收费值。', photos: [FEED_IMGS[5], FEED_IMGS[0]], likes: 19, comments: 3 },
  { id: 'f10', user: '大龙', avatar: '大龙', avatarColor: '#4D4D4D', venueId: 'hz-huanglong', at: hoursAgo(50), text: '黄龙广场练滑行，地铁直达就是方便。', photos: [FEED_IMGS[1]], likes: 9, comments: 1 },
]

const COLLECTIONS = ['venues', 'feeds', 'checkins', 'feed_likes', 'user_profiles', 'venue_reports', 'presence']

/* 建集合（已存在则忽略） */
async function ensureCollections() {
  const created = []
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (e) {
      /* 集合已存在或其他非致命错误，跳过 */
    }
  }
  return created
}

/* 导入种子数据（幂等：集合为空才插入） */
async function seedIfEmpty(coll, docs) {
  const r = await db.collection(coll).count()
  if (r.total > 0) return { skipped: true, total: r.total }
  for (const doc of docs) {
    await db.collection(coll).add({ data: doc })
  }
  return { inserted: docs.length }
}

exports.main = async () => {
  const created = await ensureCollections()
  const venues = await seedIfEmpty('venues', [...SEED_VENUES, ...SEED_HZ_VENUES])
  const feeds = await seedIfEmpty('feeds', SEED_FEEDS)
  return {
    ok: true,
    created,
    venues,
    feeds,
  }
}
