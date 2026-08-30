import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const show = useCallback((message, type = 'dark') => {
    clearTimeout(timer.current)
    setToast({ message, type, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="animate-toast-in fixed left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          style={{
            bottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
            background: toast.type === 'success' ? '#00D4AA' : 'rgba(26,26,30,0.92)',
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
