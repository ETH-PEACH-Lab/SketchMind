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

interface ExploreModeProps {
  onCheck: () => void;
  onNextDraw: () => void;
}

export default function ExploreMode({
  onCheck,
  onNextDraw,
}: ExploreModeProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"check" | "draw" | null>(null);

  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  // 初始化位置
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    setPosition({ x: w * 0.65, y: h * 0.6 })
  }, [])

  // 拖动逻辑
  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', stopDrag)
  }

  const onDrag = (e: MouseEvent) => {
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
        position: 'fixed',
        top: position.y,
        left: position.x,
        width: 400,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
        cursor: 'move',
        userSelect: 'none',
      }}
      onMouseDown={startDrag}
    >
      {/* 顶部标题 */}
      <Box
        sx={{
          p: 2,
          bgcolor: '#e3f2fd',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h6" align="center" color="primary">
          🚀 Explore Mode
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary">
          Free drawing with AI assistance
        </Typography>
      </Box>

      {/* 功能按钮组 */}
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        gap={2}
        p={3}
        bgcolor="#fafafa"
      >
        <Tooltip title="Check your drawing">
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
        <Tooltip title="Get AI hint">
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
              ? "Checking your answer... Please wait."
              : "AI is drawing the next step... Please wait."}
          </Typography>
        </Box>
      )}
    </Card>
  )
}
