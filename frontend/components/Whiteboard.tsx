import { Stage, Layer, Line } from 'react-konva'
import { useState } from 'react'

export default function Whiteboard() {
  const [lines, setLines] = useState<any[]>([])

  const handleMouseDown = () => {
    setLines([...lines, { points: [], finished: false }])
  }

  const handleMouseMove = (e: any) => {
    if (lines.length === 0) return
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    const lastLine = lines[lines.length - 1]
    lastLine.points = lastLine.points.concat([point.x, point.y])
    setLines([...lines.slice(0, -1), lastLine])
  }

  const handleMouseUp = () => {
    if (lines.length === 0) return
    const lastLine = lines[lines.length - 1]
    lastLine.finished = true
    setLines([...lines.slice(0, -1), lastLine])
  }

  return (
    <Stage
      width={window.innerWidth / 2}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMousemove={handleMouseMove}
      onMouseup={handleMouseUp}
      style={{ backgroundColor: '#fff' }}
    >
      <Layer>
        {lines.map((line, i) => (
          <Line
            key={i}
            points={line.points}
            stroke="black"
            strokeWidth={2}
            tension={0.5}
            lineCap="round"
            globalCompositeOperation="source-over"
          />
        ))}
      </Layer>
    </Stage>
  )
}
