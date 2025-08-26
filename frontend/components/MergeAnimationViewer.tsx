// components/MergeAnimationViewer.tsx
import { useEffect, useState } from 'react'

export default function MergeAnimationViewer() {
  const STORAGE_KEY = 'mergeAnimationPage'
  const [page, setPage] = useState(1)
  const total = 35

  const imgUrl = `https://eth-peach-lab.github.io/intuition-visualisation//slides/merge-two-sorted-lists/1/page_${String(
    page
  ).padStart(2, '0')}.png`

  // 恢复/持久化页码，避免组件被重新挂载后回到第 1 页
  useEffect(() => {
    const saved = Number(sessionStorage.getItem(STORAGE_KEY) || '1')
    if (Number.isFinite(saved) && saved >= 1 && saved <= total) {
      setPage(saved)
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(page))
  }, [page])

  return (
    <div className="flex flex-col items-center mt-4 mb-2 gap-2">
      <img src={imgUrl} alt={`Slide ${page}`} className="w-full rounded shadow" />
      <div className="flex justify-between items-center w-full mt-2">
  <div className="flex gap-2">
    <button
      onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(1, p - 1)) }}
      disabled={page === 1}
      className="px-2 py-1 bg-gray-200 rounded"
    >
      ◀ Prev
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(total, p + 1)) }}
      disabled={page === total}
      className="px-2 py-1 bg-gray-200 rounded"
    >
      Next ▶
    </button>
  </div>

  <span className="text-sm text-right">
    Page {page} / {total}
  </span>
</div>

    </div>
  )
}
