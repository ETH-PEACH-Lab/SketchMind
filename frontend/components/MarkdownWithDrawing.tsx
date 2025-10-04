import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Stage, Layer, Line } from 'react-konva'
import rehypeRaw from 'rehype-raw'
import MergeAnimationViewer from './MergeAnimationViewer'
import { Box, Button, IconButton, Tooltip, Typography, Collapse } from '@mui/material'
import { Visibility, Edit, Delete, InfoOutlined, ChevronLeft, ChevronRight } from '@mui/icons-material'
import { Paper, Divider, RadioGroup, Radio, FormControlLabel, TextField, Switch } from '@mui/material';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

interface Props {
  markdown: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  zh: boolean;                     // 当前语言 true=中文, false=English
  onToggleZh: () => void;          // 点击切换语言
}

/* ---------- 工具 ---------- */
const injectSlots = (md: string) =>
  md
    .replace('<!-- animation-slot -->', `<div class="merge-animation-slot"/>`)
    .replace('<!-- example-slot -->', `<div class="example-slot"/>`)
    .replace('<animation>', `<div class="animation-slot"/>`)

const extract = (md: string, start: RegExp, end: RegExp) => {
  const lines = md.split('\n')
  const s = lines.findIndex(l => start.test(l))
  if (s === -1) return ''
  const e = lines.findIndex((l, i) => i > s && end.test(l))
  return lines.slice(s, e === -1 ? undefined : e).join('\n')
}

export default function MarkdownWithDrawing({ 
  zh, 
  onToggleZh,
  markdown, 
  isCollapsed = false, 
  onToggleCollapse 
}: Props) {
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
  const [currentLine, setCurrentLine] = useState<any>(null)

  /* 卡片 & 画布公用 ref，用于计算相对坐标 */
  const cardRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)

  // 检测是否为触摸设备
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [isApplePencil, setIsApplePencil] = useState(false)

  useEffect(() => {
    // 检测触摸设备
    const checkTouchDevice = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      setIsTouchDevice(hasTouch)
      
      // 检测Apple Pencil (通过触摸事件的压力值)
      if (hasTouch) {
        const testTouch = (e: TouchEvent) => {
          try {
            if (e.touches[0] && 'force' in e.touches[0] && e.touches[0].force !== undefined) {
              setIsApplePencil(true)
              document.removeEventListener('touchstart', testTouch)
            }
          } catch (error) {
            console.log('Touch detection error:', error)
          }
        }
        
        // 添加触摸事件监听器
        document.addEventListener('touchstart', testTouch, { passive: true })
        
        // 清理函数
        return () => {
          document.removeEventListener('touchstart', testTouch)
        }
      }
    }
    
    checkTouchDevice()
  }, [])

  // 获取触摸或鼠标位置
  const getPointerPosition = (e: any) => {
    try {
      if (e.touches && e.touches[0]) {
        // 触摸事件
        const touch = e.touches[0]
        const stage = stageRef.current
        if (stage && stage.container) {
          const rect = stage.container().getBoundingClientRect()
          if (rect) {
            return {
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
              pressure: touch.force !== undefined ? touch.force : 0.5,
              isPencil: touch.force !== undefined
            }
          }
        }
      } else if (e.target && e.target.getStage) {
        // 鼠标事件
        const stage = e.target.getStage()
        if (stage) {
          const pos = stage.getPointerPosition()
          if (pos) {
            return {
              x: pos.x,
              y: pos.y,
              pressure: 0.5,
              isPencil: false
            }
          }
        }
      }
    } catch (error) {
      console.log('Pointer position error:', error)
    }
    return null
  }

  const handleStart = (e: any) => {
    if (mode !== 'draw') return
    
    const pos = getPointerPosition(e)
    if (!pos) return
    
    const newLine = {
      points: [pos.x, pos.y],
      finished: false,
      pressure: pos.pressure,
      isPencil: pos.isPencil
    }
    
    setCurrentLine(newLine)
    setIsDrawing(true)
  }

  const handleMove = (e: any) => {
    if (mode !== 'draw' || !isDrawing || !currentLine) return
    
    const pos = getPointerPosition(e)
    if (!pos) return
    
    setCurrentLine((prev: any) => ({
      ...prev,
      points: [...prev.points, pos.x, pos.y],
      pressure: pos.pressure
    }))
  }

  const handleEnd = () => {
    if (!isDrawing || !currentLine) return
    
    setLines(prev => [...prev, { ...currentLine, finished: true }])
    setCurrentLine(null)
    setIsDrawing(false)
  }

  // 鼠标事件处理
  const handleMouseDown = (e: any) => {
    if (isTouchDevice) return // 触摸设备上忽略鼠标事件
    handleStart(e)
  }

  const handleMouseMove = (e: any) => {
    if (isTouchDevice) return
    handleMove(e)
  }

  const handleMouseUp = () => {
    if (isTouchDevice) return
    handleEnd()
  }

  // 触摸事件处理
  const handleTouchStart = (e: any) => {
    // 对于触摸事件，我们不需要调用 preventDefault
    // Konva 会自动处理触摸事件
    handleStart(e)
  }

  const handleTouchMove = (e: any) => {
    // 对于触摸事件，我们不需要调用 preventDefault
    // Konva 会自动处理触摸事件
    handleMove(e)
  }

  const handleTouchEnd = (e: any) => {
    // 对于触摸事件，我们不需要调用 preventDefault
    // Konva 会自动处理触摸事件
    handleEnd()
  }

  const handleClear = () => setLines([])

  /* Markdown 渲染：给每个 <details> 加按钮 */
  const components = {
    div({ node, ...props }: any) {
      if (props.className === 'example-slot')
        return (
           <Box my={isTouchDevice ? 1 : 2} textAlign="center">
            <img
              src="https://assets.leetcode.com/uploads/2020/10/03/merge_ex1.jpg"
              alt="Example"
               style={{ 
                 maxWidth: isTouchDevice ? 350 : 400, 
                 width: '100%', 
                 borderRadius: 8 
               }}
            />
          </Box>
        )
      if (props.className === 'merge-animation-slot')
        return (
          <Box sx={{ position: 'relative', zIndex: 20 }}>
            <MergeAnimationViewer />
          </Box>
        )
      if (props.className === 'animation-slot')
        return (
                        <Box sx={{ 
               p: isTouchDevice ? 1 : 2, 
               mt: isTouchDevice ? 1 : 2 
             }}>
               <Typography variant="h6" sx={{ 
                 mb: isTouchDevice ? 1 : 2, 
                 color: '#1976d2', 
                 fontWeight: 600,
                 fontSize: isTouchDevice ? '1rem' : '1.25rem'
               }}>
              🎥 贪心算法动画演示
            </Typography>
            <Box sx={{ 
              borderRadius: 1, 
              overflow: 'hidden', 
              border: '1px solid #e0e0e0',
              bgcolor: 'white'
            }}>
              <video
                controls
                preload="metadata"
                playsInline
                muted
                style={{ width: '100%', height: 'auto', display: 'block' }}
                poster="/video-poster.jpg"
                onError={(e) => console.error('Video error:', e)}
              >
                <source src="/videos/greed.mp4" type="video/mp4" />
                 <source src="/videos/greed.webm" type="video/mp4" />
                您的浏览器不支持视频播放。
              </video>
            </Box>
             <Typography variant="body2" sx={{ 
               mt: isTouchDevice ? 0.5 : 1, 
               color: '#666', 
               fontSize: isTouchDevice ? '0.75rem' : '0.875rem' 
             }}>
              观看贪心算法在跳跃游戏中的实际应用过程
            </Typography>
          </Box>
        )
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
      const key = React.isValidElement(summary) ? (summary.props as any)?.children || '' : ''
      const isSelected = selectedKey === key

      return (
                 <details open style={{ 
           marginBottom: isTouchDevice ? 6 : 12, 
           userSelect: 'text',
           fontSize: isTouchDevice ? '0.8rem' : '1rem'
         }}>
          <summary
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'text', // 允许文本选择
              listStyle: 'none', // 移除默认的箭头
               fontSize: isTouchDevice ? '0.8rem' : '1rem'
            }}
          >
            {summary}
            <Box ml="auto">
             <Button
                 size={isTouchDevice ? "small" : "small"}
              variant={isSelected ? 'contained' : 'outlined'}
              color={isSelected ? 'success' : 'primary'}
              onClick={(e) => {
                e.preventDefault()   // 阻止默认
                e.stopPropagation()  // 阻止冒泡到 <details>
                setSelectedKey(isSelected ? '' : key)
                setApproach(isSelected ? '' : key + '\n' + rest.map((r: any) => r?.props?.children || '').join('\n'))
                // 算法选择功能已移除，固定使用递归方法
              }}
                 sx={{ 
                   textTransform: 'none', 
                   fontSize: isTouchDevice ? 9 : 12,
                   py: isTouchDevice ? 0.2 : 0.5,
                   px: isTouchDevice ? 0.8 : 1.5,
                   minHeight: isTouchDevice ? 24 : 32
                 }}
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

  // 渲染所有线条（包括当前正在绘制的）
  const allLines = [...lines]
  if (currentLine) {
    allLines.push(currentLine)
  }

  return (
    <Box position="relative" width="100%" height="100%" bgcolor="#fafafa" sx={{ userSelect: 'text' }}>
      {/* 工具栏悬浮在卡片左上角 */}
      <Box
        position="absolute"
         top={isTouchDevice ? 12 : 20}
         left={isTouchDevice ? 12 : 20}
        zIndex={20}
        bgcolor="rgba(255,255,255,0.8)"
        borderRadius={1}
        boxShadow={1}
        display="flex"
        alignItems="center"
         gap={isTouchDevice ? 0.2 : 0.5}
         px={isTouchDevice ? 0.2 : 0.5}
      >
                 <Tooltip title="查看模式">
          <IconButton color={mode === 'view' ? 'primary' : 'default'} onClick={() => setMode('view')}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
         <Tooltip title="标注模式">
          <IconButton color={mode === 'draw' ? 'success' : 'default'} onClick={() => setMode('draw')}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
         <Tooltip title="清空标注">
          <IconButton color="error" onClick={handleClear}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>

                          {/* 折叠按钮 - 只在面板展开时显示 */}
          {onToggleCollapse && !isCollapsed && (
            <Tooltip title="收起面板">
              <IconButton 
                onClick={onToggleCollapse}
                sx={{ 
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.light', color: 'white' },
                  // iPad触摸优化
                  minWidth: isTouchDevice ? 44 : 40,
                  minHeight: isTouchDevice ? 44 : 40,
                  fontSize: isTouchDevice ? '1.2rem' : '1rem',
                }}
              >
                <ChevronLeft />
              </IconButton>
            </Tooltip>
          )}

                          {/* 简洁的工具栏说明 */}
          <Box 
            sx={{ 
              color: 'text.secondary',
              fontSize: isTouchDevice ? '0.7rem' : '0.75rem',
              opacity: 0.7,
              ml: isTouchDevice ? 0.5 : 1,
              whiteSpace: 'nowrap'
            }}
          >
            左侧标注
          </Box>

      </Box>
      {/* <ToggleButtonGroup
        value={zh ? 'zh' : 'en'}
        exclusive size="small"
        onChange={(_, val) => { if (val) onToggleZh(); }}
      >
        <ToggleButton value="zh">中</ToggleButton>
        <ToggleButton value="en">EN</ToggleButton>
      </ToggleButtonGroup> */}
      {/* 翻译开关 */}

      {/* 卡片 + 画布 */}
      <Box
        ref={cardRef}
        position="relative"
        width="100%"
        height="100%"
        overflow="hidden"
        p={0}
      >
                 <Box p={isTouchDevice ? 1.5 : 3} pt={isTouchDevice ? 3 : 6} sx={{ 
           userSelect: 'text',
           width: '90%', // 使用100%宽度，不设置固定宽度
           fontSize: isTouchDevice ? '0.8rem' : '1rem', // iPad上字体更小
           lineHeight: isTouchDevice ? 1.3 : 1.6, // iPad上行高更紧凑
         }}>
          <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>
            {injectSlots(markdown)}
          </ReactMarkdown>
        </Box>

        {/* 直接叠加在卡片上画线 */}
        {mode === 'draw' && (
          <Stage
            ref={stageRef}
            width={cardRef.current?.clientWidth || window.innerWidth}
            height={cardRef.current?.clientHeight || window.innerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 10,
              pointerEvents: 'auto',
              touchAction: 'none', // 禁用默认触摸行为
              WebkitUserSelect: 'none', // iOS Safari 优化
              userSelect: 'none',
            }}
            // 触摸优化配置
            listening={true}
            preventDefault={false}
          >
            <Layer>
              {allLines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.isPencil ? "#ff5252" : "#ff5252"}
                  strokeWidth={Math.max(2, line.pressure * 6)} // 根据压力调整线宽
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  opacity={line.finished ? 1 : 0.8}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </Box>
    </Box>
  )
}
