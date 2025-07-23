import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Stage, Layer, Line, Rect } from 'react-konva'
import rehypeRaw from 'rehype-raw'
import MergeAnimationViewer from './MergeAnimationViewer'

interface Props {
  markdown: string
}

function injectSlotPlaceholders(markdown: string) {
  return markdown
    .replace('<!-- animation-slot -->', `<div class="merge-animation-slot">&nbsp;</div>`)
    .replace('<!-- example-slot -->', `<div class="example-slot">&nbsp;</div>`)

}

export default function MarkdownWithDrawing({ markdown }: Props) {
  const rendered = injectSlotPlaceholders(markdown)
  const [mode, setMode] = useState<'view' | 'draw' | 'select'>('view')
  const [lines, setLines] = useState<any[]>([])
  const [selections, setSelections] = useState<any[]>([])
  const [selection, setSelection] = useState<any | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()

    if (mode === 'draw') {
      setLines([...lines, { points: [], finished: false }])
      setIsDrawing(true)
    } else if (mode === 'select') {
      setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 })
    }
  }

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    if (mode === 'draw' && isDrawing && lines.length > 0) {
      const lastLine = lines[lines.length - 1]
      lastLine.points = lastLine.points.concat([point.x, point.y])
      setLines([...lines.slice(0, -1), lastLine])
    } else if (mode === 'select' && selection) {
      const newWidth = point.x - selection.x
      const newHeight = point.y - selection.y
      setSelection({ ...selection, width: newWidth, height: newHeight })
    }
  }

  const handleMouseUp = () => {
    if (mode === 'draw' && isDrawing) {
      const lastLine = lines[lines.length - 1]
      lastLine.finished = true
      setLines([...lines.slice(0, -1), lastLine])
      setIsDrawing(false)
    } else if (mode === 'select' && selection) {
      setSelections([...selections, selection])
      console.log('✅ New selected area:', selection)
      setSelection(null)
    }
  }

  const handleClear = () => {
    setLines([])
    setSelections([])
    setSelection(null)
    console.log('🧹 Cleared all drawings and selections')
  }

  const handleExport = () => {
    console.log('📤 Exported selections:', selections)
    alert(`Exported ${selections.length} area(s). Check console.`)
  }

  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-20 flex gap-2 flex-wrap">
        <button
          className={`px-3 py-1 rounded ${mode === 'view' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('view')}
        >
          👁️ View
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === 'draw' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('draw')}
        >
          ✍️ Draw
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === 'select' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('select')}
        >
          🔲 Select
        </button>
        <button
          className="px-3 py-1 rounded bg-red-500 text-white"
          onClick={handleClear}
        >
          🗑️ Clear
        </button>
        <button
          className="px-3 py-1 rounded bg-indigo-500 text-white"
          onClick={handleExport}
        >
          📤 Export
        </button>
      </div>

      {/* Markdown content */}
      <div className="relative h-full overflow-y-scroll p-6 prose prose-sm max-w-none">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          div({ node, ...props }) {
            if (props.className === 'example-slot') {
              return (
                <div className="my-4">
                  <img
                    src="https://assets.leetcode.com/uploads/2020/10/03/merge_ex1.jpg"
                    alt="Example merge diagram"
                    className="mx-auto border shadow rounded max-w-[400px] w-full h-auto"
                  />
                </div>
              )
            }

            if (props.className === 'merge-animation-slot') {
              return <MergeAnimationViewer />
            }
           
            return <div {...props} />
          },
        }}
      >
        {rendered}
      </ReactMarkdown>
    </div>

      {/* Drawing canvas */}
      {mode !== 'view' && (
        <Stage
          width={window.innerWidth / 2}
          height={window.innerHeight}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 10,
            pointerEvents: mode !== 'view' ? 'auto' : 'none',
          }}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={`line-${i}`}
                points={line.points}
                stroke="red"
                strokeWidth={2}
                tension={0.5}
                lineCap="round"
              />
            ))}
            {selections.map((rect, i) => (
              <Rect
                key={`rect-${i}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                stroke="blue"
                dash={[6, 4]}
              />
            ))}
            {selection && (
              <Rect
                x={selection.x}
                y={selection.y}
                width={selection.width}
                height={selection.height}
                stroke="blue"
                dash={[6, 4]}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
