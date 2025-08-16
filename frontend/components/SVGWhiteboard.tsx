'use client'

import { useRef, useState } from 'react'
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas'

export default function SVGWhiteboard({ onExportSvg }: { onExportSvg: (svg: string) => void }) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null)
  const [color, setColor] = useState('black')
  const [width, setWidth] = useState(2)
  const [eraser, setEraser] = useState(false)

  const handleExport = async () => {
  try {
    const svgString = await canvasRef.current?.exportSvg()
    if (!svgString) return

    // 解析 SVG 字符串，提取用户画的 path/line/circle/text
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const userElements = doc.querySelectorAll('path, line, circle, text')

    // 重新组装成简洁版 SVG
    const cleanSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1055 640">\n` +
      Array.from(userElements).map(el => el.outerHTML).join('\n') +
      `\n</svg>`

    onExportSvg(cleanSvg)
    console.log('🎯 Simplified SVG:', cleanSvg)
  } catch (err) {
    console.error('Export SVG failed:', err)
  }
}


  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="p-2 flex justify-between items-center bg-gray-100 border-b text-sm">
        <div className="space-x-2 flex items-center">
          <label>🎨 Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value)
              setEraser(false)
            }}
          />

          <label>📏 Width</label>
          <input
            type="range"
            min={1}
            max={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />

          <button
            onClick={() => setEraser(false)}
            className={`px-2 py-1 rounded ${!eraser ? 'bg-blue-200' : 'bg-white'}`}
          >
            ✍️ Pen
          </button>

          <button
            onClick={() => setEraser(true)}
            className={`px-2 py-1 rounded ${eraser ? 'bg-blue-200' : 'bg-white'}`}
          >
            🧽 Eraser
          </button>

          <button onClick={() => canvasRef.current?.clearCanvas()} className="px-2 py-1 bg-white border rounded">
            🗑️ Clear
          </button>
        </div>

        <div>
          <button onClick={handleExport} className="px-2 py-1 bg-purple-200 border rounded">
            📤 Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <ReactSketchCanvas
        ref={canvasRef}
        width="100%"
        height="100%"
        strokeWidth={width}
        strokeColor={eraser ? '#ffffff' : color}
        // eraseMode={eraser}
        canvasColor="white"
        style={{ flexGrow: 1 }}
      />
    </div>
  )
}
