import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Stage, Layer, Line } from 'react-konva'
import rehypeRaw from 'rehype-raw'
import MergeAnimationViewer from './MergeAnimationViewer'
import { Box, Button, IconButton, Tooltip } from '@mui/material'
import { Visibility, Edit, Delete } from '@mui/icons-material'

interface Props { markdown: string }

/* ---------- 工具 ---------- */
const injectSlots = (md: string) =>
  md
    .replace('<!-- animation-slot -->', `<div class="merge-animation-slot"/>`)
    .replace('<!-- example-slot -->', `<div class="example-slot"/>`)

const extract = (md: string, start: RegExp, end: RegExp) => {
  const lines = md.split('\n')
  const s = lines.findIndex(l => start.test(l))
  if (s === -1) return ''
  const e = lines.findIndex((l, i) => i > s && end.test(l))
  return lines.slice(s, e === -1 ? undefined : e).join('\n')
}

export default function MarkdownWithDrawing({ markdown }: Props) {
  /* 提取 problem / example */
  const [problem, setProblem] = useState('')
  const [example, setExample] = useState('')
  const [approach, setApproach] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>('')
  useEffect(() => {
    setProblem(extract(markdown, /^#\s/, /^### Example\b/))
    setExample(extract(markdown, /^### Example\b/, /^###? \w/))
  }, [markdown])

  /* 绘图状态 */
  const [mode, setMode] = useState<'view' | 'draw'>('view')
  const [lines, setLines] = useState<any[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  /* 卡片 & 画布公用 ref，用于计算相对坐标 */
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: any) => {
    if (mode !== 'draw') return
    const pos = e.target.getStage().getPointerPosition()
    setLines(prev => [...prev, { points: [pos.x, pos.y], finished: false }])
    setIsDrawing(true)
  }
  const handleMouseMove = (e: any) => {
    if (mode !== 'draw' || !isDrawing) return
    const pos = e.target.getStage().getPointerPosition()
    setLines(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      last.points = last.points.concat([pos.x, pos.y])
      return next
    })
  }
  const handleMouseUp = () => {
    if (!isDrawing) return
    setLines(prev => {
      const next = [...prev]
      next[next.length - 1].finished = true
      return next
    })
    setIsDrawing(false)
  }
  const handleClear = () => setLines([])

  /* Markdown 渲染：给每个 <details> 加按钮 */
  const components = {
    div({ node, ...props }: any) {
      if (props.className === 'example-slot')
        return (
          <Box my={2} textAlign="center">
            <img
              src="https://assets.leetcode.com/uploads/2020/10/03/merge_ex1.jpg"
              alt="Example"
              style={{ maxWidth: 400, width: '100%', borderRadius: 8 }}
            />
          </Box>
        )
      if (props.className === 'merge-animation-slot') return <MergeAnimationViewer />
      return <div {...props} />
    },


    details({ children }: any) {
      const summary = React.Children.toArray(children).find(
        (c: any) => c.type === 'summary'
      )
      const rest = React.Children.toArray(children).filter(
        (c: any) => c.type !== 'summary'
      )

      /* 用 summary 文本作为唯一 key */
      // const key = summary?.props?.children || ''
      const key = React.isValidElement(summary) ? (summary.props as any)?.children || '' : ''
      const isSelected = selectedKey === key

      return (
        <details style={{ marginBottom: 12 }}>
          <summary
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            {summary}
            <Box ml="auto">
             <Button
              size="small"
              variant={isSelected ? 'contained' : 'outlined'}
              color={isSelected ? 'success' : 'primary'}
              onClick={(e) => {
                e.preventDefault()   // 阻止默认
                e.stopPropagation()  // 阻止冒泡到 <details>
                setSelectedKey(isSelected ? '' : key)
                setApproach(isSelected ? '' : key + '\n' + rest.map((r: any) => r?.props?.children || '').join('\n'))
              }}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {isSelected ? 'Selected' : 'Select'}
            </Button>
            </Box>
          </summary>
          {rest}
        </details>
      )
    }
  }
  // console.log('approach', approach)
  // console.log('problem', problem)
  // console.log('example', example)
  return (
    <Box position="relative" width="100%" height="100vh" bgcolor="#fafafa">
      {/* 工具栏悬浮在卡片左上角 */}
      <Box
        position="absolute"
        top={8}
        left={8}
        zIndex={20}
        bgcolor="rgba(255,255,255,0.8)"
        borderRadius={1}
        boxShadow={1}
      >
        <Tooltip title="View">
          <IconButton color={mode === 'view' ? 'primary' : 'default'} onClick={() => setMode('view')}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Draw">
          <IconButton color={mode === 'draw' ? 'success' : 'default'} onClick={() => setMode('draw')}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear">
          <IconButton color="error" onClick={handleClear}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 卡片 + 画布 */}
      <Box
        ref={cardRef}
        position="relative"
        width="100%"
        height="100%"
        overflow="auto"
        p={0}
      >
        <Box p={3} pt={6}>
          <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>
            {injectSlots(markdown)}
          </ReactMarkdown>
        </Box>

        {/* 直接叠加在卡片上画线 */}
        {mode === 'draw' && (
          <Stage
            width={cardRef.current?.clientWidth || window.innerWidth}
            height={cardRef.current?.clientHeight || window.innerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 10,
              pointerEvents: 'auto',
            }}
          >
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke="#ff5252"
                  strokeWidth={3}
                  tension={0.5}
                  lineCap="round"
                />
              ))}
            </Layer>
          </Stage>
        )}
      </Box>
    </Box>
  )
}