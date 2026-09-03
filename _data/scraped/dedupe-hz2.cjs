/* 清理：删除杭州.json 中「50滑板」品牌级 org（云端以4家分店为实体），relations 指向中央商城店 */
const fs = require('fs')
const path = require('path')
const f = fs.readdirSync(__dirname).find((x) => {
  if (!x.endsWith('.json') || x.indexOf('import') >= 0) return false
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, x), 'utf8')).city === '杭州' } catch (e) { return false }
})
const jp = path.join(__dirname, f)
const data = JSON.parse(fs.readFileSync(jp, 'utf8'))
const before = data.orgs.length
data.orgs = data.orgs.filter((s) => s.name !== '50滑板')
;(data.relations || []).forEach((r) => { if (r.org === '50滑板') r.org = '50滑板俱乐部（杭州大厦中央商城店）' })
data.summary.orgs = data.orgs.length
fs.writeFileSync(jp, JSON.stringify(data, null, 2), 'utf8')
console.log(f, 'orgs:', before, '→', data.orgs.length)
