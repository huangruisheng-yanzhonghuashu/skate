/* 清理本地 杭州.json：删除「50滑板俱乐部（杭州大厦中央商城店）」的 venue 重复条目（云端为 shop） */
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname)
const f = fs.readdirSync(dir).find((x) => {
  if (!x.endsWith('.json') || x.indexOf('import') >= 0) return false
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, x), 'utf8')).city === '杭州'
  } catch (e) {
    return false
  }
})
const jp = path.join(dir, f)
const data = JSON.parse(fs.readFileSync(jp, 'utf8'))
const before = data.venues.length
data.venues = data.venues.filter((v) => v.name !== '50滑板俱乐部（杭州大厦中央商城店）')
data.summary.venues = data.venues.length
fs.writeFileSync(jp, JSON.stringify(data, null, 2), 'utf8')
console.log(f, 'venues:', before, '→', data.venues.length)
