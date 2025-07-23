'use client'

import { useRef, useState, useEffect } from 'react'

type Tool = 'pen' | 'eraser'

export default function WhiteboardWithControls() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [pages, setPages] = useState<ImageData[]>([])
  const [currentPage, setCurrentPage] = useState(0)

  // 初始化第一页
 useEffect(() => {
  const canvas = canvasRef.current
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)

    saveCurrentPage()
  }
}, [])



  const startDrawing = (e: React.MouseEvent) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    ctx.lineWidth = tool === 'pen' ? 2 : 20
    ctx.strokeStyle = tool === 'pen' ? '#000' : '#fff'
    ctx.lineCap = 'round'

    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    ctx.closePath()
    setIsDrawing(false)
    saveCurrentPage()
  }

  const saveCurrentPage = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const snapshot = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    const updated = [...pages]
    updated[currentPage] = snapshot
    setPages(updated)
  }

  const goToPage = (index: number) => {
  if (!canvasRef.current || index < 0) return

  const ctx = canvasRef.current.getContext('2d')
  if (!ctx) return

  // 保存当前页内容
  saveCurrentPage()

  const updatedPages = [...pages]
  const canvas = canvasRef.current

  if (!updatedPages[index]) {
    // 如果是新页面，创建空白 ImageData
    const blank = ctx.createImageData(canvas.width, canvas.height)
    updatedPages[index] = blank
  }

  // 切换并清空 + 渲染该页图像
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(updatedPages[index], 0, 0)

  setPages(updatedPages)
  setCurrentPage(index)
}


  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex justify-between p-2 bg-gray-100 border-b">
        <div className="flex gap-2">
          <button onClick={() => setTool('pen')} className={`px-2 py-1 rounded ${tool === 'pen' ? 'bg-blue-200' : 'bg-white'}`}>✍️ Pen</button>
          <button onClick={() => setTool('eraser')} className={`px-2 py-1 rounded ${tool === 'eraser' ? 'bg-blue-200' : 'bg-white'}`}>🧽 Eraser</button>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} className="px-2 py-1 rounded bg-white border">⬅ Prev</button>
          <span>Page {currentPage + 1}</span>
          <button onClick={() => goToPage(currentPage + 1)} className="px-2 py-1 rounded bg-white border">Next ➡</button>
        </div>
      </div>

      {/* 白板画布 */}
      <canvas
  ref={canvasRef}
  className="flex-1 w-full h-full bg-white touch-none"
  onMouseDown={startDrawing}
  onMouseMove={draw}
  onMouseUp={stopDrawing}
  onMouseLeave={stopDrawing}
/>

    </div>
  )
}
