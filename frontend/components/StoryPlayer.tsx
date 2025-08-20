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
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BuildIcon from '@mui/icons-material/Build'; // 替换 TaskAltIcon
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/Send'; // 新增
import CloseIcon from '@mui/icons-material/Close'; // 新增

interface StoryPlayerProps {
  steps: { stepText: string }[];
  onStepChange: (stepText: string, index: number) => void;
  stepStatuses: string[];
  setStepStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  onCheck: () => Promise<any>;
  onNextDraw: () => Promise<void>;
}

export default function StoryPlayer({
  steps,
  onStepChange,
  stepStatuses,
  setStepStatuses,
  onCheck,        
  onNextDraw,
}: StoryPlayerProps) {

  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // const [stepStatuses, setStepStatuses] = useState<string[]>(
  //   Array(steps.length).fill("pending")
  // );
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"check" | "draw" | null>(null);


  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  

  // 初始化 Story 卡片位置
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    setPosition({ x: w * 0.65, y: h * 0.6 })
  }, [])

  // // 初始化加载第一步的 Excalidraw 场景（仅首次加载）
  // useEffect(() => {
  //   if (excalidrawAPI && steps.length > 0) {
  //     excalidrawAPI.updateScene({
  //       elements: steps[0].elements || [],
  //       appState: steps[0].appState || {},
  //     })
  //   }
  //   // 只在 excalidrawAPI 初始化时执行一次
  // }, [excalidrawAPI])
  // steps 变化时，保证状态长度一致
  useEffect(() => {
    setStepStatuses((prev) => {
      const next = Array(steps.length).fill("pending");
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  }, [steps.length, setStepStatuses]);


  // 初次通知父组件加载第0步
  useEffect(() => {
    if (steps.length > 0) {
      onStepChange(steps[0].stepText, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

    // 步骤点 refs
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 切换步骤时自动滚动到当前点
  useEffect(() => {
    if (stepRefs.current[index]) {
      stepRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [index]);

  // const changeStep = (newIndex: number) => {
  //   if (newIndex < 0 || newIndex >= steps.length) return

  //   // 更新步骤状态
  //   setStepStatuses(prev => {
  //     const next = [...prev]
  //     if (prev[index] !== 'correct') next[index] = 'correct'
  //     return next
  //   })

  //   setIndex(newIndex)
  //   onStepChange(steps[newIndex].stepText, newIndex);
  // }
  const changeStep = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= steps.length) return;

    setIndex(newIndex);
    onStepChange(steps[newIndex].stepText, newIndex);
  };

  // const renderStatusIcon = (i: number) => {
  //   const status = stepStatuses[i];
  //   const isCurrent = i === index;
  //    if (isCurrent) return <FiberManualRecordIcon sx={{ color: '#7e7e75ff' }} />;
  // if (status === 'correct') return <CheckCircleIcon sx={{ color: '#2e7d32' }} />;
  // if (status === 'wrong') return <CloseIcon sx={{ color: '#d32f2f' }} />; // 错误用打叉
  //   return <RadioButtonUncheckedIcon sx={{ color: '#c4c4c4' }} />;
  // };
const renderStatusIcon = (i: number) => {
  const status = stepStatuses[i];
  // 如果已经有结果，优先显示结果
  if (status === 'correct') return <CheckCircleIcon sx={{ color: '#2e7d32' }} />;
  if (status === 'wrong') return <CloseIcon sx={{ color: '#d32f2f' }} />;
  // 只有 pending 时显示当前点高亮
  if (i === index) return <FiberManualRecordIcon sx={{ color: '#7e7e75ff' }} />;
  return <RadioButtonUncheckedIcon sx={{ color: '#c4c4c4' }} />;
};
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

  // const renderStatusIcon = (i: number) => {
  //   const status = stepStatuses[i]
  //   const isCurrent = i === index
  //   if (isCurrent) return <FiberManualRecordIcon sx={{ color: '#7e7e75ff' }} />
  //   if (status === 'correct') return <CheckCircleIcon sx={{ color: '#2e7d32' }} />
  //   return <RadioButtonUncheckedIcon sx={{ color: '#c4c4c4' }} />
  // }

  //  const titles = [
  //   'Start Drawing',
  //     'Compare First Nodes',
  //     'First Merge',
  //     'Compare Again',
  //     'Continue the Merge',
  //     'Next Comparison',
  //     'Keep Merging',
  //     'Compare & Merge Again',
  //     'Almost Done!',
  //     'Finish the Merge',
  //     '🎉 All Done!'
  // ];

  // const hints = [
  //   "Let's begin! Please draw two linked lists:\n• list1: 1 → 2 → 4\n• list2: 1 → 3 → 4\nUse boxes and arrows to represent the nodes and connections.",
  //     "Look at the heads of list1 and list2 (both are 1). \nWhich one should we add first? \nCircle the chosen head in red.",
  //     "Now draw the merged list starting with 1 (from list2).\nThen remove this node from list2.",
  //     "Compare the new heads: list1 is 1, list2 is 3.\nWhich one goes next in the merged list?",
  //     "Add the 1 from list1 to the merged list.\nUpdate list1 to remove this node, and keep going.",
  //     "Which node is smaller: 2 (list1) or 3 (list2)?\nChoose the smaller one to add next.",
  //     "Add the smaller node to the merged list.\nUpdate your lists accordingly and draw the new state.",
  //     "Between 4 (list1) and 3 (list2), which one should go next?\nDraw the updated merged list after adding it.",
  //     "Keep going! Merge the next node.\nDraw the updated list after choosing between 4 and 4.",
  //     "Only one node left.\nLet’s connect the last node to finish the merged list.",
  //     "Great job! You've built the merged list step by step.\nCheck your drawing to make sure all nodes are included and correctly ordered."
  // ];
const titles = [
    '开始绘制',
    '比较第一个节点',
    '第一次合并',
    '再次比较',
    '继续合并',
    '下一次比较',
    '继续合并',
    '比较并再次合并',
    '快完成了！',
    '完成合并',
    '🎉 全部完成！'
];

const hints = [
    "我们开始吧！请绘制两个链表：\n• list1: 1 → 2 → 4\n• list2: 1 → 3 → 4\n使用方框和箭头表示节点和连接。",
    "查看 list1 和 list2 的头节点（都是 1）。\n我们应该先添加哪一个？\n用红色圈出你选择的头节点。",
    "现在从 list2 中取出 1，开始绘制合并后的链表。\n然后从 list2 中移除这个节点。",
    "比较新的头节点：list1 是 1，list2 是 3。\n哪一个应该接下来加入合并后的链表？",
    "将 list1 中的 1 添加到合并后的链表中。\n更新 list1，移除这个节点，然后继续。",
    "比较 2（list1）和 3（list2），哪一个更小？\n选择更小的那个节点，接下来添加。",
    "将较小的节点添加到合并后的链表中。\n相应地更新你的链表，并绘制新的状态。",
    "在 4（list1）和 3（list2）之间，哪一个应该接下来添加？\n添加后绘制更新后的合并链表。",
    "继续！合并下一个节点。\n在选择 4 和 4 之后，绘制更新后的链表。",
    "只剩下一个节点了。\n让我们连接最后一个节点，完成合并后的链表。",
    "干得漂亮！你已经逐步构建了合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。"
];
  const NAV_WINDOW = 2; // 当前点前后各显示2个

  function getNavIndices(current: number, total: number) {
    let start = Math.max(0, current - NAV_WINDOW);
    let end = Math.min(total - 1, current + NAV_WINDOW);
    let indices = [];
    for (let i = start; i <= end; i++) indices.push(i);
    return { start, end, indices };
  }

  const { start, end, indices } = getNavIndices(index, steps.length);

  // Wrap handlers to show loading
  const handleCheck = async () => {
  setLoading(true);
  setLoadingType("check");
  try {
    const result = await onCheck();
    console.log("Check result:", result);
    if (result && typeof result === 'object' && 'isValid' in result && typeof result.isValid === "boolean") {
      setStepStatuses((prev) => {
        const next = [...prev];
        next[index] = result.isValid ? "correct" : "wrong";
        return next;
      });
    } else {
      console.error("Invalid result from onCheck:", result);
    }
  } catch (error) {
    console.error("Error in handleCheck:", error);
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
        width: 550,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
        cursor: 'move',
        userSelect: 'none',
      }}
      onMouseDown={startDrag}
    >
      {/* 顶部功能按钮组 */}
  {/* <Box display="flex" justifyContent="center" alignItems="center" gap={2} p={2} bgcolor="#fafafa">
  <Tooltip title="Check">
    <IconButton
      // size="large"
      sx={{ bgcolor: "#fb8c00", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#ef6c00" } }}
      onClick={(e) => { e.stopPropagation(); onCheck(); }}
    >
      <BuildIcon sx={{ fontSize: 32 }} />
    </IconButton>
  </Tooltip>
  <Tooltip title="Next Draw">
    <IconButton
      // size="large"
      sx={{ bgcolor: "#8e24aa", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#6d1b7b" } }}
      onClick={(e) => { e.stopPropagation(); onNextDraw(); }}
    >
      <LightbulbIcon sx={{ fontSize: 32 }} />
    </IconButton>
  </Tooltip>
</Box> */}
      {/* 顶部步骤导航 */}
      <Box
  sx={{
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    p: 2,
    bgcolor: '#fafafa',
  }}
>
  {/* 步骤点区域：可横向滚动 */}
  <Box
    display="flex"
    alignItems="center"
    gap={1}
    sx={{
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      maxWidth: 280, // 可根据实际宽度调整
      flex: '1 1 auto',
      pr: 10, // 给右侧按钮留空间
      '&::-webkit-scrollbar': { height: 8 },
    }}
  >
    {steps.map((_, i) => (
      <Tooltip key={i} title={`Step ${i + 1}`}>
        <IconButton
          ref={(el) => { stepRefs.current[i] = el; }}
          onClick={(e) => {
            e.stopPropagation();
            changeStep(i);
          }}
          size="small"
          sx={{
            mx: 0.5,
            border: i === index ? '2px solid #7e7e75ff' : undefined,
            transition: 'border 0.2s'
          }}
        >
          {renderStatusIcon(i)}
        </IconButton>
      </Tooltip>
    ))}
  </Box>
  {/* 功能按钮区域：固定在右侧，不随步骤点滚动 */}
  <Box
  display="flex"
  alignItems="center"
  gap={2}
  sx={{
    position: 'absolute',
    right: 40,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    bgcolor: '#fafafa',
  }}
>
    <Tooltip title="检查" placement="top">
    <span>
      <IconButton
        sx={{ bgcolor: "#9fe2f3ff", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#00d3efff" } }}
        onClick={handleCheck}
        disabled={loadingType === "check"}
      >
        {loadingType === "check"
          ? <CircularProgress size={28} color="inherit" />
          : <SendIcon sx={{ fontSize: 32 }} />}
      </IconButton>
    </span>
  </Tooltip>
  <Tooltip title="提示" placement="top">
    <span>
      <IconButton
        sx={{ bgcolor: "#a92cccff", color: "#fff", boxShadow: 2, '&:hover': { bgcolor: "#6d1b7b" } }}
        onClick={handleNextDraw}
        disabled={loadingType === "draw"}
      >
        {loadingType === "draw"
          ? <CircularProgress size={28} color="inherit" />
          : <LightbulbIcon sx={{ fontSize: 32 }} />}
      </IconButton>
      
    </span>
  </Tooltip>
</Box>
        {/* Loading overlay（可选，如果只想按钮转圈可去掉） */}
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
        
</Box>

      {/* 内容展示区域 */}
      <CardContent sx={{ cursor: "default" }}>
              <Typography variant="h6" gutterBottom>
                {titles[index] || `Step ${index + 1}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" whiteSpace="pre-line" mb={2}>
                {hints[index] || steps[index]?.stepText || ""}
              </Typography>
      
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Button
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeStep(index - 1);
                  }}
                  disabled={index === 0}
                >
                  ◀ 上一步
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {index + 1} / {steps.length}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 只有点击下一步按钮才会初始化画布
                    changeStep(index + 1);
                  }}
                  disabled={index === steps.length - 1}
                >
                  下一步 ▶
                </Button>
              </Stack>
            </CardContent>
    </Card>
  )
}
