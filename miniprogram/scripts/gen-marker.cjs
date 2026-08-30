/* 一次性脚本：生成地图 marker（滑板鞋气泡钉，白色描边；marker.png 橙 / marker-gray.png 灰） */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SIZE = 96

/* ---------- PNG 编码 ---------- */
function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(px) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0 // filter none
    px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

/* ---------- 绘制（SDF 抗锯齿） ---------- */
const px = Buffer.alloc(SIZE * SIZE * 4)

function blend(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return
  const i = (y * SIZE + x) * 4
  const da = px[i + 3] / 255
  const sa = Math.min(1, a)
  const oa = sa + da * (1 - sa)
  if (oa <= 0) { px[i + 3] = 0; return }
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa)
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa)
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa)
  px[i + 3] = Math.round(oa * 255)
}

function circle(cx, cy, rad, r, g, b) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const a = Math.min(1, Math.max(0, rad - d + 0.5))
      if (a > 0) blend(x, y, r, g, b, a)
    }
}

/* 圆角矩形 SDF */
function roundRect(x0, y0, x1, y1, rad, r, g, b) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const hx = (x1 - x0) / 2 - rad, hy = (y1 - y0) / 2 - rad
  for (let y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++)
    for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
      const qx = Math.abs(x + 0.5 - cx) - hx
      const qy = Math.abs(y + 0.5 - cy) - hy
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad
      const a = Math.min(1, Math.max(0, 0.5 - d))
      if (a > 0) blend(x, y, r, g, b, a)
    }
}

/* 三角形 SDF（Inigo Quilez） */
function sdTriangle(pxp, pyp, ax, ay, bx, by, cx, cy) {
  const e = [[bx - ax, by - ay], [cx - bx, cy - by], [ax - cx, ay - cy]]
  const v = [[pxp - ax, pyp - ay], [pxp - bx, pyp - by], [pxp - cx, pyp - cy]]
  const pts = [[ax, ay], [bx, by], [cx, cy]]
  let s = Math.sign(e[0][0] * e[2][1] - e[0][1] * e[2][0])
  let d1 = Infinity, d2 = Infinity
  for (let i = 0; i < 3; i++) {
    const [ex, ey] = e[i]
    const [vx, vy] = v[i]
    const t = Math.min(1, Math.max(0, (vx * ex + vy * ey) / (ex * ex + ey * ey)))
    const qx = vx - ex * t, qy = vy - ey * t
    const dist = qx * qx + qy * qy
    const w = [vx, vy]
    const [px0, py0] = pts[i]
    const wend = [px0 + ex, py0 + ey]
    const cr = (pxp - px0) * ey - (pyp - py0) * ex
    if (dist < d1) { d1 = dist; d2 = s * cr }
    else if (dist === d1) { if (s * cr < d2) d2 = s * cr }
  }
  return -Math.sqrt(d1) * Math.sign(d2)
}

function triangle(ax, ay, bx, by, cx, cy, r, g, b) {
  const minX = Math.floor(Math.min(ax, bx, cx)) - 1
  const maxX = Math.ceil(Math.max(ax, bx, cx)) + 1
  const minY = Math.floor(Math.min(ay, by, cy)) - 1
  const maxY = Math.ceil(Math.max(ay, by, cy)) + 1
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const d = sdTriangle(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy)
      const a = Math.min(1, Math.max(0, 0.5 - d))
      if (a > 0) blend(x, y, r, g, b, a)
    }
}

/* 渲染一枚 pin：气泡钉 + 白色滑板鞋 */
function render([cr, cg, cb]) {
  px.fill(0)
  /* 白色外圈 */
  circle(48, 38, 34, 255, 255, 255)
  triangle(48, 93, 33, 54, 63, 54, 255, 255, 255)
  /* 主体色 */
  circle(48, 38, 30.5, cr, cg, cb)
  triangle(48, 89, 35, 55, 61, 55, cr, cg, cb)
  /* 白色滑板鞋：鞋身 + 鞋头 + 鞋底 */
  roundRect(30, 28, 62, 46, 10, 255, 255, 255)
  roundRect(58, 34, 68, 46, 5, 255, 255, 255)
  roundRect(27, 47, 70, 54, 3, 255, 255, 255)
  return Buffer.from(px)
}

const dir = path.join(__dirname, '..', 'images')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'marker.png'), encodePNG(render([255, 90, 54])))      // #FF5A36
fs.writeFileSync(path.join(dir, 'marker-gray.png'), encodePNG(render([140, 140, 140]))) // #8C8C8C
console.log('marker.png:', fs.statSync(path.join(dir, 'marker.png')).size, 'bytes')
console.log('marker-gray.png:', fs.statSync(path.join(dir, 'marker-gray.png')).size, 'bytes')
