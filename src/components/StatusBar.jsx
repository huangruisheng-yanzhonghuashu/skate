/* 移动端状态栏样式装饰（9:41 + 信号/电池） */
export default function StatusBar() {
  return (
    <div className="flex h-7 shrink-0 select-none items-center justify-between bg-ink px-5 text-xs text-white">
      <span className="font-semibold">9:41</span>
      <div className="flex items-center gap-1.5">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 17h2v4H2zm4-5h2v9H6zm4-4h2v13h-2zm4-3h2v16h-2zm4 6h2v10h-2z" />
        </svg>
        <svg className="h-3 w-5" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="1" width="18" height="10" rx="2" />
          <path d="M21 4v4" />
        </svg>
      </div>
    </div>
  )
}
