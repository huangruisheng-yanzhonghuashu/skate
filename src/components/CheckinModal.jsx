import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../store/AppStore.jsx'
import { useToast } from './Toast.jsx'
import { Check, CheckCircle, Edit, Plus, X } from './icons.jsx'

const MAX_PHOTOS = 9

/* 签到弹窗 — 与设计稿一致：说点什么(选填) + 照片(最多9张) + 确认签到 */
export default function CheckinModal({ open, onClose, venue }) {
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const { addCheckin } = useApp()
  const toast = useToast()
  const fileRef = useRef(null)

  const reset = () => {
    setNote('')
    setPhotos([])
    setSubmitting(false)
  }

  const close = () => {
    onClose()
    reset()
  }

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || [])
    const remain = MAX_PHOTOS - photos.length
    const added = files.slice(0, remain).map((f) => URL.createObjectURL(f))
    setPhotos((p) => [...p, ...added])
    e.target.value = ''
  }

  const confirm = async () => {
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    addCheckin(venue.id, venue.name, note.trim())
    toast(`已在「${venue.name}」签到成功`, 'success')
    close()
  }

  return (
    <Modal open={open} onClose={close} labelledBy="checkin-modal-title">
      <div className="mb-4 flex items-center justify-center gap-2">
        <CheckCircle className="h-6 w-6 text-success" />
        <h2 id="checkin-modal-title" className="text-lg font-bold text-ink">签到打卡</h2>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm text-ink">
          <Edit className="h-4 w-4 text-ash" />
          <span>说点什么</span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="说点什么... (选填)"
          className="min-h-24 w-full resize-none rounded-lg border border-fog p-3 text-sm text-ink placeholder:text-ash focus:border-primary focus:outline-none"
        />
      </div>

      <div className="mb-5">
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg">
              <img src={src} alt={`照片${i + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                aria-label={`移除照片${i + 1}`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-fog text-ash transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-6 w-6" />
              <span className="px-1 text-center text-xs leading-tight">添加照片</span>
              <span className="text-[10px] leading-tight">(最多9张)</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-70"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            签到中...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            确认签到
          </>
        )}
      </button>
      <button
        type="button"
        onClick={close}
        className="mt-3 block w-full text-center text-sm text-ash transition-colors hover:text-ink"
      >
        取消
      </button>
    </Modal>
  )
}
