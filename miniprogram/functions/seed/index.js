const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/* 与 data/mock.js 保持一致的图片生成 URL */
function genImg(prompt, imageSize) {
  imageSize = imageSize || 'landscape_16_9'
  return 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
    encodeURIComponent(prompt) + '&image_size=' + imageSize
}

const IMG_RIVERSIDE = genImg('wide angle photo of an urban riverside concrete skatepark with bowls and quarter pipes, a few skaters riding, city skyline across the river, golden hour light, photorealistic')
const IMG_BOWL = genImg('photo of a smooth concrete skateboarding bowl pool with one rider carving a turn, sunny day, clean park, photorealistic')
const IMG_FLAT = genImg('photo of a flat concrete riverside plaza with young skaters practicing ollies next to low marble barriers, sunset backlight, photorealistic')
const IMG_STREET = genImg('photo of a street style skate plaza with hand rails, stairs and granite ledges, one skater grinding a rail, urban park, photorealistic')
const IMG_HALFPIPE = genImg('photo of a large U shaped halfpipe ramp in an outdoor skatepark, skater dropping in, dramatic blue sky, photorealistic')

const FEED_IMGS = [
  genImg('action photo of a skateboarder landing a kickflip in a concrete skatepark bowl, motion, photorealistic', 'square'),
  genImg('photo of skateboard gear deck wheels spread on skatepark floor, top view, warm light, photorealistic', 'square'),
  genImg('photo of a skater carving a concrete bowl at sunset, silhouette, photorealistic', 'square'),
  genImg('photo of a brand new skateboard deck held in hands at a skatepark, shallow depth of field, photorealistic', 'square'),
  genImg('photo of skater grinding a ledge in a street skate plaza, urban, photorealistic', 'square'),
  genImg('photo of a skater dropping into a wooden halfpipe, low angle, photorealistic', 'square'),
]

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

/* 场地种子数据：结构必须与 data/mock.js 的 VENUES 完全一致 */
const SEED_VENUES = [
  {
    id: 'binjiang',
    name: '滨江滑板公园',
    rating: 4.5,
    distance: '230m',
    latitude: 31.2397,
    longitude: 121.4995,
    category: '混合',
    online: 12,
    hot: true,
    address: '浦东新区滨江大道2888号',
    shortAddr: '浦东滨江大道',
    tags: [
      { label: '混合', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
      { label: '水泥', icon: 'tagCement' },
    ],
    photos: [IMG_RIVERSIDE, IMG_BOWL, IMG_FLAT, IMG_STREET, IMG_HALFPIPE],
    feed: [
      { user: '滑板阿凯', avatar: 'AK', color: '#FF5A36', time: '2小时前', text: '今天碗池人不多，练了几个新动作，地面很顺！' },
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '5小时前', text: '晚上灯光明亮，适合夜滑，新手友好。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '昨天', text: '周末小朋友有点多，建议大家错峰来。' },
    ],
  },
  {
    id: 'hongkou',
    name: '虹口碗池公园',
    rating: 4.2,
    distance: '1.2km',
    latitude: 31.2646,
    longitude: 121.4762,
    category: '碗池',
    online: 5,
    hot: false,
    address: '虹口区东体育会路66号',
    shortAddr: '虹口区东体育会路',
    tags: [
      { label: '碗池', icon: 'tagMixed' },
      { label: '收费', icon: 'tagFree' },
      { label: '无灯', icon: 'tagLight' },
    ],
    photos: [IMG_BOWL, IMG_RIVERSIDE, IMG_FLAT],
    feed: [
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '昨天 18:30', text: '第一次下碗池，腿软，但好好玩！' },
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '3天前', text: '碗池边缘刚修过，很平滑。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '5天前', text: '傍晚人多，建议上午来。' },
    ],
  },
  {
    id: 'xuhui',
    name: '徐汇滨江平地',
    rating: 3.8,
    distance: '2.5km',
    latitude: 31.1964,
    longitude: 121.456,
    category: '平地',
    online: 3,
    hot: false,
    address: '徐汇区龙腾大道滨江步道',
    shortAddr: '徐汇滨江龙腾大道',
    tags: [
      { label: '平地', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_FLAT, IMG_STREET, IMG_RIVERSIDE],
    feed: [
      { user: '阿强', avatar: 'AQ', color: '#2A8CFF', time: '昨天 14:00', text: '新板子到了，试滑！地面很平。' },
      { user: '板仔小张', avatar: '张', color: '#FF5A36', time: '4天前', text: '风大的时候注意江边侧风。' },
      { user: 'MarsChen', avatar: 'MC', color: '#FFB800', time: '1周前', text: '适合练平地动作，人少。' },
    ],
  },
  {
    id: 'jingan',
    name: '静安街式广场',
    rating: 4.0,
    distance: '980m',
    latitude: 31.2489,
    longitude: 121.4543,
    category: '街式',
    online: 8,
    hot: false,
    address: '静安区苏州河南岸广场',
    shortAddr: '静安苏州河南岸广场',
    tags: [
      { label: '街式', icon: 'tagMixed' },
      { label: '免费', icon: 'tagFree' },
      { label: '水泥', icon: 'tagCement' },
    ],
    photos: [IMG_STREET, IMG_FLAT, IMG_RIVERSIDE],
    feed: [
      { user: 'LeoYoung', avatar: 'LY', color: '#2A8CFF', time: '3天前', text: '杆子刚打过蜡，丝滑。' },
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '6天前', text: '台阶组合很全，练街式首选。' },
      { user: '小美', avatar: 'XM', color: '#00D4AA', time: '1周前', text: '周末人多，注意排队秩序。' },
    ],
  },
  {
    id: 'yangpu',
    name: '杨浦U池公园',
    rating: 4.7,
    distance: '3.1km',
    latitude: 31.259,
    longitude: 121.518,
    category: 'U池',
    online: 15,
    hot: true,
    address: '杨浦区杨树浦路滨江带',
    shortAddr: '杨浦杨树浦路滨江带',
    tags: [
      { label: 'U池', icon: 'tagMixed' },
      { label: '收费', icon: 'tagFree' },
      { label: '有灯', icon: 'tagLight' },
    ],
    photos: [IMG_HALFPIPE, IMG_BOWL, IMG_STREET, IMG_FLAT],
    feed: [
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '5小时前', text: 'U池刷了一下午，膝盖已废。' },
      { user: '阿凯', avatar: 'AK', color: '#FF5A36', time: '2天前', text: '池壁过渡圆滑，节奏很好。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '4天前', text: '收费但维护到位，值得。' },
    ],
  },
]

/* 动态种子数据：结构必须与 data/mock.js 的 FEED_LIST 完全一致 */
const SEED_FEEDS = [
  { id: 'f1', user: '板仔小张', avatar: '板仔', avatarColor: '#FF5A36', venueId: 'binjiang', at: hoursAgo(2), text: '今天碗池人少，爽滑两小时！', photos: [FEED_IMGS[0], FEED_IMGS[1]], likes: 15, comments: 3 },
  { id: 'f2', user: '小美', avatar: '小美', avatarColor: '#00D4AA', venueId: 'hongkou', at: hoursAgo(26), text: '第一次下碗池，腿软！', photos: [FEED_IMGS[2]], likes: 8, comments: 1 },
  { id: 'f3', user: '阿强', avatar: '阿强', avatarColor: '#2A8CFF', venueId: 'xuhui', at: hoursAgo(31), text: '新板子到了，试滑！', photos: [FEED_IMGS[3], FEED_IMGS[4], FEED_IMGS[5]], likes: 23, comments: 5 },
  { id: 'f4', user: '大龙', avatar: '大龙', avatarColor: '#4D4D4D', venueId: 'yangpu', at: hoursAgo(76), text: 'U池刷了一下午，膝盖已废，明天继续。', photos: [FEED_IMGS[5], FEED_IMGS[0]], likes: 31, comments: 7 },
  { id: 'f5', user: 'LeoYoung', avatar: 'LY', avatarColor: '#FFB800', venueId: 'jingan', at: hoursAgo(102), text: '街式杆子刚打过蜡，丝滑，快来。', photos: [FEED_IMGS[4]], likes: 12, comments: 2 },
]

const COLLECTIONS = ['venues', 'feeds', 'checkins', 'feed_likes', 'user_profiles', 'venue_reports']

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
  const venues = await seedIfEmpty('venues', SEED_VENUES)
  const feeds = await seedIfEmpty('feeds', SEED_FEEDS)
  return {
    ok: true,
    created,
    venues,
    feeds,
  }
}
