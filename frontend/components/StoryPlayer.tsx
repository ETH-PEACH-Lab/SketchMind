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
  Collapse,
  Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BuildIcon from '@mui/icons-material/Build'; // 替换 TaskAltIcon
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/Send'; // 新增
import CloseIcon from '@mui/icons-material/Close'; // 新增
import InfoIcon from '@mui/icons-material/Info'; // 新增
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // 新增
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

type ScaffoldingMode = 'Low' | 'Medium' | 'High' | 'Adaptive';

interface StoryPlayerProps {
  scaffoldingMode?: ScaffoldingMode;
  onScaffoldingModeChange?: (mode: ScaffoldingMode) => void;
  containerRef?: React.RefObject<HTMLElement | null>; // 右侧画布容器，用于边界约束
  inline?: boolean; // 新增：内嵌面板模式（非悬浮）
  zh?: boolean; // 新增：语言
}

export default function StoryPlayer({
  scaffoldingMode,
  onScaffoldingModeChange,
  containerRef,
  inline = false,
  zh = true,
}: StoryPlayerProps) {
  // Internal fallback state when parent doesn't control the mode
  const [internalMode, setInternalMode] = useState<ScaffoldingMode>(scaffoldingMode ?? 'Low');
  // Keep internal in sync if prop changes later
  useEffect(() => {
    if (scaffoldingMode && scaffoldingMode !== internalMode) {
      setInternalMode(scaffoldingMode);
    }
  }, [scaffoldingMode]);
  const effectiveMode = scaffoldingMode ?? internalMode;

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [cardSize, setCardSize] = useState({ width: 300, height: 150 })
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const clampToContainer = (x: number, y: number) => {
    const margin = 8
    const cw = (containerRef?.current as any)?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const ch = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
    const w = cardSize.width
    const h = cardSize.height
    const maxX = Math.max(margin, cw - w - margin)
    const maxY = Math.max(margin, ch - h - margin)
    const clampedX = Math.min(Math.max(margin, x), maxX)
    const clampedY = Math.min(Math.max(margin, y), maxY)
    return { x: clampedX, y: clampedY }
  }


  

  // 初始化 Story 卡片位置（仅悬浮模式）
  useEffect(() => {
    if (inline) return;
    const cw = (containerRef?.current as any)?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const ch = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
    const horizontalMultiplier = 0.4
    const next = { x: cw * horizontalMultiplier, y: ch * 0.7 }
    setPosition(clampToContainer(next.x, next.y))
    setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        setCardSize({ width: rect.width, height: rect.height })
        const margin = 8
        const ch2 = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
        const bottomY = Math.max(margin, ch2 - rect.height - margin - 20)
        setPosition(prev => clampToContainer(prev.x, bottomY))
      }
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline]);

  // 监听窗口尺寸变化，保持卡片在可视区域内（仅悬浮模式）
  useEffect(() => {
    if (inline) return;
    const onResize = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        setCardSize({ width: rect.width, height: rect.height })
      }
      setPosition(prev => clampToContainer(prev.x, prev.y))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [cardSize.width, cardSize.height, inline])

  // 拖动逻辑（Pointer Events，支持 iPad 触控）
  const startPointerDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
    window.addEventListener('pointermove', onPointerDrag, { passive: false })
    window.addEventListener('pointerup', stopPointerDrag, { passive: true })
  }

  const onPointerDrag = (e: PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const rawX = e.clientX - offset.current.x
    const rawY = e.clientY - offset.current.y
    const { x, y } = clampToContainer(rawX, rawY)
    setPosition({ x, y })
  }

  const stopPointerDrag = () => {
    dragging.current = false
    window.removeEventListener('pointermove', onPointerDrag as any)
    window.removeEventListener('pointerup', stopPointerDrag as any)
    // 最终再夹一遍，避免越界
    setPosition(prev => clampToContainer(prev.x, prev.y))
  }


  return (
    <Card
      elevation={inline ? 0 : 8}
      sx={{
        position: inline ? 'relative' : 'absolute',
        top: inline ? 'auto' : position.y,
        left: inline ? 'auto' : position.x,
        width: inline ? '100%' : 300,
        borderRadius: inline ? 0 : 3,
        overflow: inline ? 'visible' : 'hidden',
        boxShadow: inline ? 'none' : undefined,
        bgcolor: inline ? 'transparent' : 'background.paper',
        zIndex: inline ? 'auto' : 9999,
        cursor: inline ? 'default' : 'move',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={inline ? undefined : startPointerDrag}
      ref={cardRef as any}
    >
      {/** Sync scaffolding mode to a global for cross-component access (e.g., canvas page) */}
      {(() => {
        try {
          (window as any).sketchMindScaffoldingMode = effectiveMode;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sketchMindScaffoldingMode', effectiveMode);
          }
        } catch {}
        return null;
      })()}
      <CardContent sx={{ cursor: "default", p: inline ? 1.5 : 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="text.secondary">
            Scaffolding Mode:
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            {(['Low', 'Medium', 'High', 'Adaptive'] as ScaffoldingMode[]).map((mode) => (
              <Button
                key={mode}
                size="small"
                variant={effectiveMode === mode ? 'contained' : 'outlined'}
                onClick={(e) => {
                  e.stopPropagation();
                  setInternalMode(mode);
                  onScaffoldingModeChange?.(mode);
                  // Immediately sync to window and localStorage
                  try {
                    (window as any).sketchMindScaffoldingMode = mode;
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem('sketchMindScaffoldingMode', mode);
                    }
                  } catch {}
                  // Dispatch a global event so other pages can react
                  try {
                    window.dispatchEvent(new CustomEvent('scaffoldingModeChanged', { detail: { mode } }));
                  } catch {}
                }}
                onPointerDown={(e) => e.stopPropagation()} // 防止点击按钮时触发拖动
                sx={{ flexGrow: 1, fontSize: '0.75rem' }}
              >
                {mode}
              </Button>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
