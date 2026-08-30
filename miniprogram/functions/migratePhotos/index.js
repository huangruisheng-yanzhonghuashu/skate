/* 图片固化：把 venues/shops 文档里的远程生成式图片 URL 下载后转入云存储
 * 幂等：已是 cloud:// fileID 的跳过；单张下载失败保留原 URL
 * 执行一次即可：tcb fn deploy migratePhotos --force && tcb fn invoke migratePhotos */
const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/* 下载远程图片为 Buffer（支持 http/https，10s 超时） */
function download(url) {
  return new Promise((resolve, reject) => {
    const mod = url.indexOf('https://') === 0 ? https : http
    const req = mod.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.setTimeout(10000, () => {
      req.destroy(new Error('download timeout'))
    })
    req.on('error', reject)
  })
}

exports.main = async () => {
  const db = cloud.database()
  const detail = []
  let fixed = 0

  for (const coll of ['venues', 'shops']) {
    const r = await db.collection(coll).limit(100).get()
    for (const doc of r.data) {
      const photos = doc.photos || []
      if (!photos.length) continue
      /* 已全部固化则跳过（幂等，重复执行不重复下载） */
      if (photos.every((p) => p.indexOf('cloud://') === 0)) continue

      const fileIDs = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        if (p.indexOf('cloud://') === 0) {
          fileIDs.push(p)
          continue
        }
        try {
          const buf = await download(p)
          const up = await cloud.uploadFile({
            cloudPath: 'seed-photos/' + doc.id + '-' + i + '.jpg',
            fileContent: buf,
          })
          fileIDs.push(up.fileID)
          fixed++
        } catch (e) {
          /* 下载失败保留原 URL，不影响其他图 */
          fileIDs.push(p)
          console.warn('[migratePhotos] 下载失败', doc.id, i, e.message)
        }
      }
      await db.collection(coll).doc(doc._id).update({ data: { photos: fileIDs } })
      detail.push({ id: doc.id, total: fileIDs.length })
    }
  }

  return { ok: true, migratedDocs: detail.length, fixedImages: fixed, detail: detail }
}
