import { useState, useRef, useEffect } from 'react'
import {
  Box,
  Card,
  Typography,
  Tooltip,
  IconButton,
  CircularProgress,
} from '@mui/material'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import SendIcon from '@mui/icons-material/Send'
import InfoIcon from '@mui/icons-material/Info'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

interface ExploreModeProps {
  onCheck: () => void;
  onNextDraw: () => void;
  notes?: string;
  containerRef?: React.RefObject<HTMLElement | null>;

}

export default function ExploreMode({
  onCheck,
  onNextDraw,
  notes = '',
  containerRef,
}: ExploreModeProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [cardSize, setCardSize] = useState({ width: 420, height: 260 });
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"check" | "draw" | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null)

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

  // 初始化位置（相对右侧画布居中偏右）
  useEffect(() => {
    const cw = (containerRef?.current as any)?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const ch = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
    // 根据左侧面板状态调整水平位置
    const horizontalMultiplier = 0.5 // 卡片居中显示
    const next = { x: cw * horizontalMultiplier, y: ch * 0.5 }
    setPosition(clampToContainer(next.x, next.y))
    setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        setCardSize({ width: rect.width, height: rect.height })
        const margin = 8
        const ch2 = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
        const centerY = Math.max(margin, Math.min(ch2 - rect.height - margin, (ch2 - rect.height) / 2))
        setPosition(prev => clampToContainer(prev.x, centerY))
      }
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 拖动逻辑（Pointer，支持触控）
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
    window.addEventListener('pointermove', onDrag as any, { passive: false })
    window.addEventListener('pointerup', stopDrag as any, { passive: true })
  }

  const onDrag = (e: PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const rawX = e.clientX - offset.current.x
    const rawY = e.clientY - offset.current.y
    const next = clampToContainer(rawX, rawY)
    setPosition(next)
  }

  const stopDrag = () => {
    dragging.current = false
    window.removeEventListener('pointermove', onDrag as any)
    window.removeEventListener('pointerup', stopDrag as any)
    setPosition(prev => clampToContainer(prev.x, prev.y))
  }

  // 包装处理函数以显示loading
  const handleCheck = async () => {
    setLoading(true);
    setLoadingType("check");
    try {
      await onCheck();
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleNextDraw = async () => {
    setLoading(true);
    setLoadingType("draw");
    try {
      await onNextDraw();
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <Card
      elevation={8}
      sx={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: 480,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={startDrag}
      ref={cardRef as any}
    >
      {/* 顶部标题（更美观） */}
      <Box sx={{ p: 2, bgcolor: 'linear-gradient(90deg, #E3F2FD 0%, #F3E5F5 100%)', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="h6" align="center" sx={{ fontWeight: 600 }}>
          探索模式
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary">
          自由绘画 · AI 助手相伴
        </Typography>
      </Box>

      {/* 功能按钮组 */}
      <Box display="flex" justifyContent="center" alignItems="center" gap={2} p={2} bgcolor="#fafafa">
        <Tooltip title="检查你的绘画">
          <IconButton
            sx={{ bgcolor: "#9fe2f3ff", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#00d3efff" } }}
            onClick={handleCheck}
            disabled={loadingType === "check"}
          >
            {loadingType === "check"
              ? <CircularProgress size={28} color="inherit" />
              : <SendIcon sx={{ fontSize: 32 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="获取AI提示">
          <IconButton
            sx={{ bgcolor: "#a92cccff", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#6d1b7b" } }}
            onClick={handleNextDraw}
            disabled={loadingType === "draw"}
          >
            {loadingType === "draw"
              ? <CircularProgress size={28} color="inherit" />
              : <LightbulbIcon sx={{ fontSize: 32 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 提示/说明区域（仿 Story 卡片风格） */}
      {notes && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Box 
            display="flex" 
            alignItems="center" 
            gap={1} 
            sx={{ p: 1, borderRadius: 1, bgcolor: '#f5f5f5' }}
          >
            <InfoIcon sx={{ color: 'text.secondary' }} fontSize="small" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }} fontWeight="medium">
              说明
            </Typography>
          </Box>
          <Box 
            sx={{ mt: 1, p: 2, bgcolor: '#f7f7f7', borderRadius: 1, border: '1px solid #e0e0e0' }}
          >
            <Typography variant="body2" whiteSpace="pre-line" sx={{ color: 'text.secondary' }}>
              {notes}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            left: 0, top: 0, right: 0, bottom: 0,
            bgcolor: 'rgba(255,255,255,0.7)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress color="secondary" />
          <Typography mt={2} color="text.secondary">
            {loadingType === "check"
              ? "正在检查你的答案... 请稍等。"
              : "AI正在绘制下一步... 请稍等。"}
          </Typography>
        </Box>
      )}
    </Card>
  )
}
