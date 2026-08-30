import { useState } from 'react'
import Modal from './Modal.jsx'
import { useToast } from './Toast.jsx'
import { Flag, ImagePlus, X } from './icons.jsx'

const TYPES = ['地址错误', '已关闭', '设施损坏', '信息变更', '其他']

/* 报错弹窗 — 与设计稿一致：问题类型 + 描述(必填) + 举证照片 + 提交 */
export default function ReportModal({ open, onClose, venue }) {
  const [type, setType] = useState('地址错误')
  const [desc, setDesc] = useState('')
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const close = () => {
    onClose()
    setDesc('')
    setPhotos([])
    setError(false)
    setSubmitting(false)
  }

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - photos.length)
    setPhotos((p) => [...p, ...files.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const submit = async () => {
    if (!desc.trim()) {
      setError(true)
      return
    }
    setError(false)
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    toast(`「${venue.name}」的报错已提交，感谢反馈`, 'success')
    close()
  }

  return (
    <Modal open={open} onClose={close} labelledBy="report-modal-title">
      <div className="mb-5 flex items-center justify-center gap-2">
        <Flag className="h-5 w-5 text-primary" />
        <h2 id="report-modal-title" className="text-lg font-bold text-ink">场地报错</h2>
      </div>

      {/* 问题类型 */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-ink">问题类型：</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === t
                  ? 'bg-primary text-white'
                  : 'border border-fog bg-mist text-graphite active:bg-fog'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 问题描述 */}
      <div className="mb-4">
        <textarea
          value={desc}
          onChange={(e) => { setDesc(e.target.value); if (e.target.value.trim()) setError(false) }}
          placeholder="请详细描述问题... (必填)"
          className={`min-h-24 w-full resize-none rounded-lg border p-3 text-sm text-ink placeholder:text-ash focus:outline-none ${
            error ? 'animate-shake border-error' : 'border-fog focus:border-primary'
          }`}
        />
        {error && <p className="mt-1.5 text-xs text-error">请填写问题描述后再提交</p>}
      </div>

      {/* 举证照片 */}
      <div className="mb-5">
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => document.getElementById('report-file-input')?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-fog py-3 text-sm text-graphite transition-colors hover:bg-mist"
          >
            <ImagePlus className="h-4 w-4 text-ash" />
            添加举证照片
          </button>
        ) : (
          <div className="flex gap-2">
            {photos.map((src, i) => (
              <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg">
                <img src={src} alt={`举证照片${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                  aria-label={`移除照片${i + 1}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input id="report-file-input" type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            提交中...
          </>
        ) : (
          '提交报错'
        )}
      </button>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={close}
          className="text-sm text-ash transition-colors hover:text-ink"
        >
          取消
        </button>
      </div>
    </Modal>
  )
}
