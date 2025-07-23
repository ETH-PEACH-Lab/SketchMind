import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

export default function MuiStoryPlayer({ steps }) {
  const [index, setIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [drawingStates, setDrawingStates] = useState(() =>
    Array(steps.length).fill(null)
  )
  const [stepStatuses, setStepStatuses] = useState([
    'correct', 'correct', 'correct',
    'pending', 'pending', 'pending',
    'pending', 'pending', 'pending',
    'pending', 'pending',
  ])

  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const isDrawing = useRef(false)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  // ✅ 初始化位置：右中位置
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    setPosition({ x: w * 0.65, y: h * 0.3 })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#333'
    ctxRef.current = ctx

    // Clear + Load drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const saved = drawingStates[index]
    if (saved) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = saved
    }
  }, [index])

  const saveCurrentCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const data = canvas.toDataURL()
    setDrawingStates(prev => {
      const updated = [...prev]
      updated[index] = data
      return updated
    })
  }

  // ✅ 拖动逻辑
  const startDrag = (e) => {
    dragging.current = true
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', stopDrag)
  }

  const onDrag = (e) => {
    if (!dragging.current) return
    setPosition({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    })
  }

  const stopDrag = () => {
    dragging.current = false
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
  }

  // ✅ 画布逻辑
  const handleMouseDown = (e) => {
    isDrawing.current = true
    const rect = canvasRef.current.getBoundingClientRect()
    ctxRef.current.beginPath()
    ctxRef.current.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    ctxRef.current.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctxRef.current.stroke()
  }

  const handleMouseUp = () => {
    isDrawing.current = false
    ctxRef.current.closePath()
  }

  const changeStep = (newIndex) => {
    saveCurrentCanvas()
    setStepStatuses(prev => {
      const next = [...prev]
      if (prev[index] !== 'correct') {
        next[index] = 'correct'
      }
      return next
    })
    setIndex(newIndex)
  }

  const current = steps[index]

  const renderStatusIcon = (i) => {
    const status = stepStatuses[i]
    const isCurrent = i === index
    if (isCurrent) return <FiberManualRecordIcon sx={{ color: '#1976d2' }} />
    if (status === 'correct') return <CheckCircleIcon sx={{ color: '#2e7d32' }} />
    return <RadioButtonUncheckedIcon sx={{ color: '#c4c4c4' }} />
  }

  return (
    <Card
      elevation={8}
      sx={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width: 500,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
        cursor: 'move',
      }}
      onMouseDown={startDrag}
    >
      {/* 顶部状态导航条 */}
      <Box display="flex" justifyContent="center" gap={1} p={2} bgcolor="#fafafa">
        {steps.map((_, i) => (
          <Tooltip key={i} title={`Step ${i + 1}`}>
            <IconButton onClick={(e) => { e.stopPropagation(); changeStep(i) }} size="small">
              {renderStatusIcon(i)}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      {/* 内容展示 */}
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {current.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" whiteSpace="pre-line" mb={2}>
          {current.hint}
        </Typography>

        {/* 画布区域 */}
        {/* <Box
          sx={{
            border: '1px solid #ddd',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 1,
            mb: 2,
          }}
        >
          <canvas
            ref={canvasRef}
            width={460}
            height={200}
            style={{ width: '100%', display: 'block', backgroundColor: 'white' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </Box> */}

        {/* 底部导航按钮 */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            variant="outlined"
            onClick={() => changeStep(Math.max(0, index - 1))}
            disabled={index === 0}
          >
            ◀ Previous
          </Button>
          <Typography variant="caption" color="text.secondary">
            {index + 1} / {steps.length}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => changeStep(Math.min(steps.length - 1, index + 1))}
            disabled={index === steps.length - 1}
          >
            Next ▶
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
