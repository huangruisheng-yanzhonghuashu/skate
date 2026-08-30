/* 生成图片走统一接口（SDXL 风格描述 + URL 编码） */
const genImg = (prompt, imageSize = 'landscape_16_9') =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`

/* ===== 场地图片 ===== */
const IMG_RIVERSIDE = genImg(
  'wide angle photo of an urban riverside concrete skatepark with bowls and quarter pipes, a few skaters riding, city skyline across the river, golden hour light, photorealistic',
)
const IMG_BOWL = genImg(
  'photo of a smooth concrete skateboarding bowl pool with one rider carving a turn, sunny day, clean park, photorealistic',
)
const IMG_FLAT = genImg(
  'photo of a flat concrete riverside plaza with young skaters practicing ollies next to low marble barriers, sunset backlight, photorealistic',
)
const IMG_STREET = genImg(
  'photo of a street style skate plaza with hand rails, stairs and granite ledges, one skater grinding a rail, urban park, photorealistic',
)
const IMG_HALFPIPE = genImg(
  'photo of a large U shaped halfpipe ramp in an outdoor skatepark, skater dropping in, dramatic blue sky, photorealistic',
)

/* ===== 动态图片（square） ===== */
const FEED_IMGS = [
  genImg('action photo of a skateboarder landing a kickflip in a concrete skatepark bowl, motion, photorealistic', 'square'),
  genImg('photo of skateboard gear deck wheels spread on skatepark floor, top view, warm light, photorealistic', 'square'),
  genImg('photo of a skater carving a concrete bowl at sunset, silhouette, photorealistic', 'square'),
  genImg('photo of a brand new skateboard deck held in hands at a skatepark, shallow depth of field, photorealistic', 'square'),
  genImg('photo of skater grinding a ledge in a street skate plaza, urban, photorealistic', 'square'),
  genImg('photo of a skater dropping into a wooden halfpipe, low angle, photorealistic', 'square'),
]

/* ===== 场地数据 ===== */
export const VENUES = [
  {
    id: 'binjiang',
    name: '滨江滑板公园',
    rating: 4.5,
    distance: '230m',
    category: '混合',
    online: 12,
    hot: true,
    address: '浦东新区滨江大道2888号',
    tags: [
      { label: '混合', icon: 'mixed' },
      { label: '免费', icon: 'free' },
      { label: '有灯', icon: 'light' },
      { label: '水泥', icon: 'cement' },
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
    category: '碗池',
    online: 5,
    hot: false,
    address: '虹口区东体育会路66号',
    shortAddr: '虹口区东体育会路',
    tags: [
      { label: '碗池', icon: 'mixed' },
      { label: '收费', icon: 'free' },
      { label: '无灯', icon: 'light' },
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
    category: '平地',
    online: 3,
    hot: false,
    address: '徐汇区龙腾大道滨江步道',
    tags: [
      { label: '平地', icon: 'mixed' },
      { label: '免费', icon: 'free' },
      { label: '夜滑', icon: 'light' },
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
    category: '街式',
    online: 8,
    hot: false,
    address: '静安区苏州河南岸广场',
    tags: [
      { label: '街式', icon: 'mixed' },
      { label: '免费', icon: 'free' },
      { label: '水泥', icon: 'cement' },
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
    category: 'U池',
    online: 15,
    hot: true,
    address: '杨浦区杨树浦路滨江带',
    shortAddr: '杨浦杨树浦路滨江带',
    tags: [
      { label: 'U池', icon: 'mixed' },
      { label: '收费', icon: 'free' },
      { label: '有灯', icon: 'light' },
    ],
    photos: [IMG_HALFPIPE, IMG_BOWL, IMG_STREET, IMG_FLAT],
    feed: [
      { user: '大龙', avatar: 'DL', color: '#4D4D4D', time: '5小时前', text: 'U池刷了一下午，膝盖已废。' },
      { user: '阿凯', avatar: 'AK', color: '#FF5A36', time: '2天前', text: '池壁过渡圆滑，节奏很好。' },
      { user: '阿花', avatar: 'AH', color: '#FF5A36', time: '4天前', text: '收费但维护到位，值得。' },
    ],
  },
]

export const getVenue = (id) => VENUES.find((v) => v.id === id)

/* 地图标记（场地A/B/C 对应前三个场地） */
export const MAP_MARKERS = [
  { venueId: 'binjiang', label: '场地A', left: '24%', top: '34%' },
  { venueId: 'hongkou', label: '场地B', left: '66%', top: '44%' },
  { venueId: 'xuhui', label: '场地C', left: '52%', top: '72%' },
]

/* ===== 发现页动态 ===== */
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString()

export const FEED_LIST = [
  {
    id: 'f1',
    user: '板仔小张',
    avatar: '板仔',
    avatarColor: '#FF5A36',
    venueId: 'binjiang',
    at: hoursAgo(2),
    text: '今天碗池人少，爽滑两小时！',
    photos: [FEED_IMGS[0], FEED_IMGS[1]],
    likes: 15,
    comments: 3,
  },
  {
    id: 'f2',
    user: '小美',
    avatar: '小美',
    avatarColor: '#00D4AA',
    venueId: 'hongkou',
    at: hoursAgo(26),
    text: '第一次下碗池，腿软！',
    photos: [FEED_IMGS[2]],
    likes: 8,
    comments: 1,
  },
  {
    id: 'f3',
    user: '阿强',
    avatar: '阿强',
    avatarColor: '#2A8CFF',
    venueId: 'xuhui',
    at: hoursAgo(31),
    text: '新板子到了，试滑！',
    photos: [FEED_IMGS[3], FEED_IMGS[4], FEED_IMGS[5]],
    likes: 23,
    comments: 5,
  },
  {
    id: 'f4',
    user: '大龙',
    avatar: '大龙',
    avatarColor: '#4D4D4D',
    venueId: 'yangpu',
    at: hoursAgo(24 * 3 + 4),
    text: 'U池刷了一下午，膝盖已废，明天继续。',
    photos: [FEED_IMGS[5], FEED_IMGS[0]],
    likes: 31,
    comments: 7,
  },
  {
    id: 'f5',
    user: 'LeoYoung',
    avatar: 'LY',
    avatarColor: '#FFB800',
    venueId: 'jingan',
    at: hoursAgo(24 * 4 + 6),
    text: '街式杆子刚打过蜡，丝滑，快来。',
    photos: [FEED_IMGS[4]],
    likes: 12,
    comments: 2,
  },
]

/* ===== 签到排行榜（本周） ===== */
export const LEADERBOARD = [
  { rank: 1, user: '阿强', count: 12, self: false },
  { rank: 2, user: '板仔小张', count: 10, self: true },
  { rank: 3, user: '小美', count: 8, self: false },
  { rank: 4, user: '大龙', count: 6, self: false },
  { rank: 5, user: '阿花', count: 5, self: false },
]

export const CITIES = ['上海', '北京', '广州', '深圳', '杭州']
