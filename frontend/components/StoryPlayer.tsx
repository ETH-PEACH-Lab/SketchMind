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

interface StoryPlayerProps {
  steps: { stepText: string }[];
  onStepChange: (stepText: string, index: number) => void;
  stepStatuses: string[];
  setStepStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  onCheck: () => Promise<any>;
  onNextDraw: () => Promise<void>;
  notes?: string; // 新增notes属性
  isNotesOpen?: boolean; // 新增isNotesOpen属性
  stepNotes?: Record<number, string>; // 每个步骤的AI提示
  currentStepIndex?: number; // 当前步骤索引
  stepChecks?: Record<number, { isValid: boolean; message?: string }>; // 每个步骤的AI检查结果
  containerRef?: React.RefObject<HTMLElement | null>; // 右侧画布容器，用于边界约束
  titles?: string[]; // 可选：外部自定义标题
  hints?: string[];  // 可选：外部自定义提示
}

export default function StoryPlayer({
  steps,
  onStepChange,
  stepStatuses,
  setStepStatuses,
  onCheck,        
  onNextDraw,
  notes = '', // 新增notes参数
  isNotesOpen = false, // 新增isNotesOpen参数
  stepNotes = {}, // 每个步骤的AI提示
  currentStepIndex = 0, // 当前步骤索引
  stepChecks = {}, // 每步检查结果
  containerRef,
  titles: externalTitles,
  hints: externalHints,
}: StoryPlayerProps) {

  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [cardSize, setCardSize] = useState({ width: 550, height: 320 })
  // const [stepStatuses, setStepStatuses] = useState<string[]>(
  //   Array(steps.length).fill("pending")
  // );
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"check" | "draw" | null>(null);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true); // 新增notes展开状态，默认展开
 
   // 保持父组件的 currentStepIndex 与本地 index 同步
   useEffect(() => {
     if (typeof currentStepIndex === 'number' && currentStepIndex !== index) {
       setIndex(currentStepIndex);
     }
   }, [currentStepIndex]);
  
  // 当步骤切换时，自动更新notes和展开状态
  useEffect(() => {
    const currentStepNote = stepNotes[currentStepIndex];
    if (currentStepNote) {
      // 如果当前步骤有AI提示，显示它
      setIsNotesExpanded(true);
    } else {
      // 如果当前步骤没有AI提示，关闭提示区域
      setIsNotesExpanded(false);
    }
  }, [currentStepIndex, stepNotes]);

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

  // 基于当前步骤的提示优先显示每步保存的提示
  const displayNote = stepNotes[currentStepIndex] ?? notes;
  const checkMsg = stepChecks[currentStepIndex]?.message || '';
  const errorRegex = /AI\s*服务\s*暂时|网络.*不可用|稍后再试|错误|失败|network|timeout|unavailable|service\s*error|try\s*again/i;
  const isErrorNote = (!!displayNote && errorRegex.test(displayNote)) || (!!checkMsg && errorRegex.test(checkMsg));

  

  // 初始化 Story 卡片位置，并测量尺寸
  useEffect(() => {
    const cw = (containerRef?.current as any)?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const ch = (containerRef?.current as any)?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
    const next = { x: cw * 0.65, y: ch * 0.5 } // 水平偏右，垂直居中
    setPosition(clampToContainer(next.x, next.y))
    // 初始测量后，用实际高度做一次精确垂直居中
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

  // 监听窗口尺寸变化，保持卡片在可视区域内
  useEffect(() => {
    const onResize = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        setCardSize({ width: rect.width, height: rect.height })
      }
      setPosition(prev => clampToContainer(prev.x, prev.y))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [cardSize.width, cardSize.height])

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
  const navContainerRef = useRef<HTMLDivElement | null>(null);

  // 切换步骤时，仅在当前点超出可见范围时，轻量滚动导航容器（不影响画布）
  useEffect(() => {
    const el = stepRefs.current[index] as HTMLElement | null
    const container = navContainerRef.current as HTMLElement | null
    if (!el || !container) return
    const er = el.getBoundingClientRect()
    const cr = container.getBoundingClientRect()
    // 将元素相对 container 的左边位置换算到滚动坐标系
    const relLeft = (er.left - cr.left) + container.scrollLeft
    const target = relLeft - (container.clientWidth - el.clientWidth) / 2
    const max = Math.max(0, container.scrollWidth - container.clientWidth)
    const nextScrollLeft = Math.max(0, Math.min(max, target))
    if (Math.abs(container.scrollLeft - nextScrollLeft) > 1) {
      container.scrollLeft = nextScrollLeft
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
    // '比较第一个节点',
    '第一次合并',
    '再次比较',
    '继续合并',
    '挑战：连做两次',
    '快完成了！',
    // '完成合并',
    '🎉 全部完成！'
];

const hints = [
    "我们开始吧！现在有两个链表：\n• list1: 1 → 2 → 4\n• list2: 1 → 3 → 4\n查看 list1 和 list2 的头节点（都是 1）。\n我们应该先添加哪一个？\n用绿色圆圈🟢标记出你选择的头节点。",
    "现在从 list2 中取出 1，开始绘制合并后的链表。\n然后从 list2 中用红色打叉❌标记移除这个节点。",
    "比较新的头节点：list1 是 1，list2 是 3。\n哪一个应该接下来加入合并后的链表？\n用绿色圆圈🟢标记出你选择的节点。",
    "将 list1 中的 1 添加到合并后的链表中。\n更新 list1，用红色打叉❌标记移除这个节点，然后继续。",
    // "哪个节点更小：链表1中的2还是链表2中的3？\n选择更小的那个放在下一个位置。并在原链表中删去它。",
    // "将较小的节点添加到合并后的链表中。\n相应地更新你的链表，并绘制新的状态。",
    // "在链表1的4和链表2的3之间，哪一个应该接下来添加？\n添加后绘制更新后的合并链表。",
    "连续做两次，自己试着完成！现在链表list1: 2->4, list2：3->4\n规则：🟢选择更小节点 → 接入合并链表 → 在原链表中❌删除\n完成合并链表新接两个节点",
    "继续！合并下一个节点。\n在4和4之间选择后，画出更新后的链表。",
    "干得漂亮！\n让我们连接最后一个节点，完成合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。"
  ];
// const titles = [
//     '开始绘制递归树',
//     '分解 \( F(5) \)',
//     '分解 \( F(4) \)',
//     '分解 \( F(3) \)（从 \( F(4) \)）',
//     '分解 \( F(2) \)（从 \( F(4) \)）',
//     '分解 \( F(3) \)（从 \( F(5) \)）',
//     '分解 \( F(2) \)（从 \( F(3) \)）',
//     '标记基本情况',
//     '回溯计算',
//     '完成计算',
//     '🎉 全部完成！'
// ];

// const hints = [
//     "我们开始吧！请绘制一个节点表示 \( F(5) \)。",
//     "现在你已经绘制了 \( F(5) \)，接下来应该考虑什么？\( F(5) \) 依赖于哪两个子问题？",
//     "你已经找到了 \( F(5) \) 的两个子问题，接下来应该怎么做？\( F(4) \) 的子问题是什么？",
//     "你已经分解了 \( F(4) \)，接下来呢？\( F(3) \) 的子问题是什么？",
//     "你已经分解了 \( F(3) \)，接下来呢？\( F(2) \) 的子问题是什么？",
//     "你已经分解了 \( F(2) \)，接下来呢？\( F(3) \) 的子问题是什么？",
//     "你已经分解了 \( F(3) \)，接下来呢？\( F(2) \) 的子问题是什么？",
//     "你已经分解了所有子问题，现在应该考虑什么？哪些节点是基本情况？",
//     "你已经标记了基本情况，接下来应该怎么做？如何从基本情况开始回溯？",
//     "你已经开始回溯了，接下来呢？如何逐步计算每个节点的值？",
//     "你已经完成了递归树的构建和计算，现在应该做什么？检查你的递归树，确保所有节点的值都已正确计算。"
// ];
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
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: 550,
        borderRadius: 3,
        overflow: 'hidden',
        zIndex: 9999,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={startPointerDrag}
      ref={cardRef as any}
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
      flex: '1 1 auto',
      flexWrap: 'wrap',
      overflow: 'visible',
      whiteSpace: 'normal',
      pr: 20, // 给右侧按钮留更充足的空间，避免覆盖
    }}
    ref={navContainerRef}
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
                {(externalTitles || titles)[index] || `Step ${index + 1}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" whiteSpace="pre-line" mb={2}>
                {(externalHints || hints)[index] || steps[index]?.stepText || ""}
              </Typography>

              {/* AI 风险提示 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mb: 1.5,
                  p: 0.75,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,193,7,0.08)'
                }}
              >
                <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="caption" color="text.secondary">
                  AI 生成/检查结果仅供参考，可能不准确，请自行判断。
                </Typography>
              </Box>
      
              {/* Notes区域 - 当当前步骤有提示时显示（默认展开，无需点击） */}
              {displayNote && (
                <Box sx={{ mb: 2 }}>
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    gap={1} 
                    sx={{ 
                      cursor: 'pointer',
                      p: 1,
                      borderRadius: 1,
                      bgcolor: isErrorNote ? '#f5f5f5' : '#f5f5f5',
                      '&:hover': { bgcolor: isErrorNote ? '#eeeeee' : '#e0e0e0' }
                    }}
                    // onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                  >
                    <InfoIcon sx={{ color: isErrorNote ? 'text.secondary' : 'primary.main' }} fontSize="small" />
                    <Typography variant="body2" sx={{ color: isErrorNote ? 'text.secondary' : 'primary.main' }} fontWeight="medium">
                      {isErrorNote ? '说明' : '提示'}
                    </Typography>
                    {stepChecks[currentStepIndex] && (
                      <Chip
                        label={stepChecks[currentStepIndex].isValid ? '检查: ✅' : '检查: ❌'}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                    {/* <ExpandMoreIcon 
                      sx={{ 
                        transform: isNotesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        ml: 'auto'
                      }} 
                    /> */}
                  </Box>
                  {stepChecks[currentStepIndex]?.message && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {stepChecks[currentStepIndex].message}
                    </Typography>
                  )}
                  <Collapse in={isNotesExpanded}>
                    <Box 
                      sx={{ 
                        mt: 1, 
                        p: 2, 
                        bgcolor: isErrorNote ? '#f7f7f7' : '#fff3e0', 
                        borderRadius: 1,
                        border: isErrorNote ? '1px solid #e0e0e0' : '1px solid #ffb74d'
                      }}
                    >
                      <Typography variant="body2" whiteSpace="pre-line" sx={{ color: isErrorNote ? 'text.secondary' : 'text.primary' }}>
                        {displayNote}
                      </Typography>
                    </Box>
                  </Collapse>
                </Box>
              )}
      
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Button
                  variant="outlined"
                  onPointerDown={(e) => { e.stopPropagation(); }}
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
                  onPointerDown={(e) => { e.stopPropagation(); }}
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
