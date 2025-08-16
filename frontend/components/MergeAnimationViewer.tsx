// components/MergeAnimationViewer.tsx
import { useState } from 'react'

export default function MergeAnimationViewer() {
  const [page, setPage] = useState(1)
  const total = 35

  const imgUrl = `https://eth-peach-lab.github.io/intuition-visualisation//slides/merge-two-sorted-lists/1/page_${String(
    page
  ).padStart(2, '0')}.png`

  return (
    <div className="flex flex-col items-center mt-4 mb-2 gap-2">
      <img src={imgUrl} alt={`Slide ${page}`} className="w-full rounded shadow" />
      <div className="flex justify-between items-center w-full mt-2">
  <div className="flex gap-2">
    <button
      onClick={() => setPage(p => Math.max(1, p - 1))}
      disabled={page === 1}
      className="px-2 py-1 bg-gray-200 rounded"
    >
      ◀ Prev
    </button>
    <button
      onClick={() => setPage(p => Math.min(total, p + 1))}
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
