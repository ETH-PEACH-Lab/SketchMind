import dynamic from 'next/dynamic';
import { useState, useRef, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
// import StoryPlayer from '../components/StoryPlayer';
// 顶部先引入 MUI 组件
import { IconButton, Tooltip, Box, Modal, Typography, Button, ToggleButton, ToggleButtonGroup, Stack, SvgIcon, Switch, Collapse, Tabs, Tab, CircularProgress } from '@mui/material'
import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon, Explore, Book, ChevronRight, ChevronLeft, BugReport as BugReportIcon, PlayArrow, CloudUpload } from '@mui/icons-material'
import TuneIcon from '@mui/icons-material/Tune';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import PanToolIcon from '@mui/icons-material/PanTool';
import NavigationIcon from '@mui/icons-material/Navigation';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import CreateIcon from '@mui/icons-material/Create';
import TextFieldsIcon from '@mui/icons-material/TextFields';
// import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import SchemaIcon from '@mui/icons-material/Schema';
// import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
// import { loadLibraryFromSVGImages } from "../utils/loadLibraryFromSVGImages";
import { injectSvgImagesAsLibraryItems } from "../utils/loadLibraryFromSVGImages";
// import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
// import { validateGeminiOverlayResponse } from '../utils/geminiTypes';
// import { applyGeminiOverlayToExcalidraw } from '../utils/geminiOverlay';
import { applyGeminiElementsToExcalidraw, type GeminiPayload } from "../utils/geminiOverlay";
// import { useSession } from 'next-auth/react';

// const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
// const BACKEND_URL = 'http://localhost:4000';
// export const BACKEND_URL =
//   process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5095';
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '/api';

const StoryPlayer = dynamic(() => import('../components/StoryPlayer'), {
  ssr: false
})

const ExploreMode = dynamic(() => import('../components/ExploreMode'), {
  ssr: false
})

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// const MarkdownWithDrawing = dynamic(() => import('../components/MarkdownWithDrawing'), { ssr: false });
// const SVGWhiteboard = dynamic(() => import('../components/SVGWhiteboard'), { ssr: false });

type StepScene = {
  elements: readonly any[];
  files: any;
  appState?: any;
};

// 自定义橡皮擦图标（简洁线框款）
const EraserIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <rect x="7" y="11" width="10" height="6" rx="1.5" transform="rotate(-45 12 14)" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </SvgIcon>
);

export default function Home() {
  // 检测是否为移动设备
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  const [api, setApi] = useState(null);
  // 开发环境开关：允许通过查询参数 ?device=tablet|desktop|mobile 强制设备模式
  const devDeviceOverrideRef = useRef<null | 'mobile' | 'tablet' | 'desktop'>(null);

  // 设备识别：使用输入能力 + 屏幕宽度，并支持开发参数覆盖，给 <html> 打标（device-mobile/tablet/desktop）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 读取一次 URL 覆盖参数
    try {
      const params = new URLSearchParams(window.location.search);
      const dev = (params.get('device') || '').toLowerCase();
      if (dev === 'mobile' || dev === 'tablet' || dev === 'desktop') {
        devDeviceOverrideRef.current = dev as 'mobile' | 'tablet' | 'desktop';
      } else {
        devDeviceOverrideRef.current = null;
      }
    } catch {}

    const applyDeviceClasses = () => {
      let mobile = false;
      let tablet = false;

      if (devDeviceOverrideRef.current) {
        mobile = devDeviceOverrideRef.current === 'mobile';
        tablet = devDeviceOverrideRef.current === 'tablet';
      } else {
        const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        const w = window.innerWidth;
        mobile = isTouch && w < 768;
        tablet = isTouch && w >= 768 && w <= 1024;
      }

      setIsMobile(mobile);
      setIsTablet(tablet);

      const root = document.documentElement;
      root.classList.toggle('device-mobile', mobile);
      root.classList.toggle('device-tablet', tablet);
      root.classList.toggle('device-desktop', !mobile && !tablet);
    };

    applyDeviceClasses();
    const onResize = () => applyDeviceClasses();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // 当识别为平板时，应用更贴合触控的默认布局（减少分栏、聚焦画布）
  useEffect(() => {
    if (isTablet) {
      try {
        setIsLeftPanelCollapsed(true);
        setLeftPct(70);
        // 不再自动打开素材库，避免布局抖动与页面高度变化
        setShowLibraryBottom(false);
      } catch {}
    } else {
      // 非平板（桌面优先体验）
      try {
        setIsLeftPanelCollapsed(false);
        setLeftPct(60);
      } catch {}
    }
  }, [isTablet]);
  // const [steps, setSteps] = useState<any[]>([])
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [currentStepText, setCurrentStepText] = useState<string>(''); 
  const [notes, setNotes] = useState<string>('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [stepNotes, setStepNotes] = useState<Record<number, string>>({}); // 为每个步骤存储AI提示
  const [stepChecks, setStepChecks] = useState<Record<number, { isValid: boolean; message?: string }>>({}); // 为每个步骤存储AI检查结果
  const [isSaved, setIsSaved] = useState(false); // 添加保存状态
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // 当前 step 的 index
  const [savedSteps, setSavedSteps] = useState<any[]>([]); // 保存的步骤内容
  const [mode, setMode] = useState<'story' | 'explore'>('story'); // 添加mode状态
  // Scaffolding mode from StoryPlayer (global), default Low
    const [scaffoldingMode, setScaffoldingMode] = useState<'Low'|'Medium'|'High'|'Adaptive'>('Low');
  const [isClient, setIsClient] = useState(false);
  const [currentScaffoldingMode, setCurrentScaffoldingMode] = useState<string | null>(null);
  const [hasSelectionError, setHasSelectionError] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    // Initial read of scaffolding mode
    try {
      const mode = (window as any)?.sketchMindScaffoldingMode || localStorage.getItem('sketchMindScaffoldingMode');
      setCurrentScaffoldingMode(mode);
    } catch {}
    
    // Listen for mode changes
    const handleModeChange = (e: any) => {
      try {
        const mode = e?.detail?.mode || (window as any)?.sketchMindScaffoldingMode || localStorage.getItem('sketchMindScaffoldingMode');
        setCurrentScaffoldingMode(mode);
      } catch {}
    };
    
    // Listen for selection errors
    const handleSelectionError = (e: any) => {
      try {
        const error = e?.detail?.error || (window as any)?.sketchMindSelectionError || false;
        setHasSelectionError(error);
      } catch {}
    };
    
    window.addEventListener('scaffoldingModeChanged', handleModeChange);
    window.addEventListener('selectionErrorChanged', handleSelectionError);
    return () => {
      window.removeEventListener('scaffoldingModeChanged', handleModeChange);
      window.removeEventListener('selectionErrorChanged', handleSelectionError);
    };
  }, []);
  // 自定义插入模式（点击画布插入）
  const [pendingInsertTool, setPendingInsertTool] = useState<'rectangle' | 'ellipse' | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  // 底部素材库（关闭）
  const [showLibraryBottom, setShowLibraryBottom] = useState(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [pendingLibraryItem, setPendingLibraryItem] = useState<any | null>(null);
  const [libraryThumbCache, setLibraryThumbCache] = useState<Record<string, string>>({});
  const [libraryGhost, setLibraryGhost] = useState<{
    width: number; height: number; minX: number; minY: number; elements: any[];
  } | null>(null);
  const [aiFlash, setAiFlash] = useState<{
    elements: any[];
    canvas: { width: number; height: number };
    offset: { x: number; y: number };
  } | null>(null);
  // AI Ghost 叠加层（只显示不落盘）
  const [aiGhost, setAiGhost] = useState<{
    elements: any[];
    canvas: { width: number; height: number };
    offset: { x: number; y: number };
  } | null>(null);
  const aiGhostActiveRef = useRef(false);
  const lastElementsCountRef = useRef(0);
  const [ghostViewport, setGhostViewport] = useState<{ scrollX: number; scrollY: number; zoom: number }>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false);
  // Guides overlay state: boxes and glow pointers rendered above canvas
  const [guides, setGuides] = useState<Array<{
    id: string;
    type: 'shake' | 'glow' | 'both';
    screenX: number; screenY: number; screenW: number; screenH: number;
    dotX: number; dotY: number;
  }>>([]);
// --- LeetCode风格布局：左右可拖拽分栏 ---
const [leftPct, setLeftPct] = useState(60);    // 左侧初始占比（百分比）→ 右侧初始约40%
const [isResizing, setIsResizing] = useState(false);
// 鼠标接近垂直分隔线（容差阈值）的检测，用于扩大拖拽判定范围但不改变可见样式
const [nearVResizer, setNearVResizer] = useState(false);
// 鼠标接近右侧上下分隔线
const [nearTopResizer, setNearTopResizer] = useState(false);
// 鼠标接近左侧底部分隔线
const [nearLeftAiResizer, setNearLeftAiResizer] = useState(false);
// 当前命中的最近分隔线类型：'v' | 'top' | 'leftAi' | null
const [activeNear, setActiveNear] = useState<null | 'v' | 'top' | 'leftAi'>(null);

const containerRef = useRef<HTMLDivElement | null>(null);
const leftBottomResizerRef = useRef<HTMLDivElement | null>(null);
const topResizerRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const handleMove = (e: any) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = (e && typeof e.clientX === 'number') ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const x = clientX - rect.left;
    const next = Math.max(20, Math.min(80, (x / rect.width) * 100)); // 左侧限制在 20%~80%
    setLeftPct(next);
  };
  const stop = () => setIsResizing(false);

  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', stop);
  // 支持触控/Apple Pencil 的 Pointer 事件
  window.addEventListener('pointermove', handleMove as any, { passive: false } as any);
  window.addEventListener('pointerup', stop as any, { passive: true } as any);
  // 触摸事件支持（旧设备/浏览器）
  window.addEventListener('touchmove', handleMove as any, { passive: false } as any);
  window.addEventListener('touchend', stop as any, { passive: true } as any);
  window.addEventListener('touchcancel', stop as any, { passive: true } as any);
  return () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', stop);
    window.removeEventListener('pointermove', handleMove as any);
    window.removeEventListener('pointerup', stop as any);
    window.removeEventListener('touchmove', handleMove as any);
    window.removeEventListener('touchend', stop as any);
    window.removeEventListener('touchcancel', stop as any);
  };
}, [isResizing]);

  

  useEffect(() => {
    if (!aiGhost || !excalidrawAPI) return;
    let raf = 0;
    const tick = () => {
      try {
        const app = excalidrawAPI.getAppState?.() as any;
        const scrollX = (app && app.scrollX) || 0;
        const scrollY = (app && app.scrollY) || 0;
        const zoom = (app && (app.zoom?.value ?? app.zoom)) || 1;
        setGhostViewport((prev) => {
          if (prev.scrollX !== scrollX || prev.scrollY !== scrollY || prev.zoom !== zoom) {
            return { scrollX, scrollY, zoom };
          }
          return prev;
        });
      } catch {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [aiGhost, excalidrawAPI]);
  // 画布插入预览（ghost）
  const [insertGhost, setInsertGhost] = useState<{ x: number; y: number; zoom: number } | null>(null);
  // 素材库固定标题
  const libraryCaptions = ['代码','打字','手写','公式','任意图形','箭头连线','矩阵','图','树','栈','数组','链表'];

  // 当前选中的组
  const [currentGroup, setCurrentGroup] = useState(1);
  
  // 导航栏收起/展开状态
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  
  // Mode切换窗口的位置状态
  const [modeWindowPosition, setModeWindowPosition] = useState({ x: 96, y: 16 });
  const modeWindowDragging = useRef(false);
  const modeWindowOffset = useRef({ x: 0, y: 0 });
  const modeWindowRef = useRef<HTMLDivElement | null>(null);
  const [modeWindowSize, setModeWindowSize] = useState({ width: 220, height: 120 });
  const [isModeCardCollapsed, setIsModeCardCollapsed] = useState(true);
  const [zh, setZh] = useState(true);

  // 左侧描述面板折叠状态
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  // 侧边栏展开状态
  const [isProblemExpanded, setIsProblemExpanded] = useState(true);
  const [isAlgorithmExpanded, setIsAlgorithmExpanded] = useState(true);
  // 右侧上栏：问题 / 直觉 / 算法 切换
  const [rightTopTab, setRightTopTab] = useState<'problem' | 'intuition' | 'algorithm'>('problem');
  // 右侧上下分栏比例与拖拽
  const [topPct, setTopPct] = useState(60);      // 右侧上栏60%，下栏40%
  const [isTopResizing, setIsTopResizing] = useState(false);
  const rightSplitRef = useRef<HTMLDivElement | null>(null);
  // 顶部操作按钮 loading 状态
  const [topLoadingCheck, setTopLoadingCheck] = useState(false);
  const [topLoadingHint, setTopLoadingHint] = useState(false);

  // 为每个模式维护独立的画布状态
  const [exploreModeCanvas, setExploreModeCanvas] = useState<StepScene>({
    elements: [],
    files: {},
    appState: { viewBackgroundColor: "#fff" }
  });
  
  // 记录上一个模式，用于切换时保存状态
  const previousModeRef = useRef<'story' | 'explore'>('story');
  
  // 添加调试状态，帮助排查问题
  const [debugInfo, setDebugInfo] = useState({
    lastSavedMode: 'story',
    lastSavedStoryStep: 0,
    lastSavedExploreElements: 0,
  });
  
  // 添加模式切换状态，防止在切换过程中保存
  const isModeSwitching = useRef(false);
  // 故事模式算法选择：固定使用递归方法（algo1）
  const [storyAlgorithm, setStoryAlgorithm] = useState<'algo1' | 'iter'>('algo1');
  // AI 结果（左侧底栏显示）
  const displayNote = stepNotes[currentStepIndex] ?? notes;
  const checkMsg = stepChecks[currentStepIndex]?.message || '';
  const errorRegex = /AI\s*服务\s*暂时|网络.*不可用|稍后再试|错误|失败|network|timeout|unavailable|service\s*error|try\s*again/i;
  const isErrorNote = (!!displayNote && errorRegex.test(displayNote)) || (!!checkMsg && errorRegex.test(checkMsg));
  // 左栏底部 AI 面板高度与拖拽
  const [leftAiHeight, setLeftAiHeight] = useState(140);
  const [isLeftAiResizing, setIsLeftAiResizing] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);

  // 顶部提交（Submit）与调试/提示（Debug/Hint）按钮事件
  const handleTopCheck = async () => {
    try {
      setTopLoadingCheck(true);
      await onCheck();
    } finally {
      setTopLoadingCheck(false);
    }
  };
  const handleTopHint = async () => {
    try {
      setTopLoadingHint(true);
      await onNextDraw();
    } finally {
      setTopLoadingHint(false);
    }
  };

  // 右侧上下分栏拖拽监听（在相关 state 声明之后注册，避免引用提升错误）
  useEffect(() => {
    const onMove = (e: any) => {
      if (!isTopResizing || !rightSplitRef.current) return;
      const rect = rightSplitRef.current.getBoundingClientRect();
      const clientY = (e && typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const y = clientY - rect.top;
      const next = Math.max(20, Math.min(80, (y / rect.height) * 100)); // 顶部限制在 20%~80%
      setTopPct(next);
    };
    const onUp = () => setIsTopResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // Pointer 事件支持
    window.addEventListener('pointermove', onMove as any, { passive: false } as any);
    window.addEventListener('pointerup', onUp as any, { passive: true } as any);
    // Touch 事件支持
    window.addEventListener('touchmove', onMove as any, { passive: false } as any);
    window.addEventListener('touchend', onUp as any, { passive: true } as any);
    window.addEventListener('touchcancel', onUp as any, { passive: true } as any);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove as any);
      window.removeEventListener('pointerup', onUp as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp as any);
      window.removeEventListener('touchcancel', onUp as any);
    };
  }, [isTopResizing]);

  // 左栏底部 AI 面板拖拽监听
  useEffect(() => {
    const onMove = (e: any) => {
      if (!isLeftAiResizing || !leftColumnRef.current) return;
      const rect = leftColumnRef.current.getBoundingClientRect();
      // 以鼠标到左列底部的距离作为高度
      const clientY = (e && typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const newHeight = Math.round(rect.bottom - clientY);
      const clamped = Math.max(80, Math.min(400, newHeight));
      setLeftAiHeight(clamped);
    };
    const onUp = () => setIsLeftAiResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // Pointer 事件支持（触控/手写笔）
    window.addEventListener('pointermove', onMove as any, { passive: false } as any);
    window.addEventListener('pointerup', onUp as any, { passive: true } as any);
    // Touch 事件支持
    window.addEventListener('touchmove', onMove as any, { passive: false } as any);
    window.addEventListener('touchend', onUp as any, { passive: true } as any);
    window.addEventListener('touchcancel', onUp as any, { passive: true } as any);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove as any);
      window.removeEventListener('pointerup', onUp as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp as any);
      window.removeEventListener('touchcancel', onUp as any);
    };
  }, [isLeftAiResizing]);

  // 在左侧 AI 面板拖拽期间，临时禁用左列的 pointer-events，避免画布/子层拦截事件
  useEffect(() => {
    const el = leftColumnRef.current as HTMLElement | null;
    if (!el) return;
    const prev = el.style.pointerEvents;
    if (isLeftAiResizing) {
      el.style.pointerEvents = 'none';
    } else {
      el.style.pointerEvents = prev || '';
    }
    return () => {
      if (el) el.style.pointerEvents = prev;
    };
  }, [isLeftAiResizing]);

  // 在左右分栏拖拽期间，同时禁用左右两侧内容的 pointer-events，避免画布/子层截获
  useEffect(() => {
    const left = leftColumnRef.current as HTMLElement | null;
    const right = rightSplitRef.current as HTMLElement | null;
    const prevLeft = left ? left.style.pointerEvents : '';
    const prevRight = right ? right.style.pointerEvents : '';
    if (isResizing) {
      if (left) left.style.pointerEvents = 'none';
      if (right) right.style.pointerEvents = 'none';
    } else {
      if (left) left.style.pointerEvents = prevLeft || '';
      if (right) right.style.pointerEvents = prevRight || '';
    }
    return () => {
      if (left) left.style.pointerEvents = prevLeft;
      if (right) right.style.pointerEvents = prevRight;
    };
  }, [isResizing]);
  
  // const titles_iter = [
  //   // '初始化指针',
  //   '第一次比较并接入',
  //   '移动 prev，更新指针，再次比较，继续接入',
  //   '循环推进：直到有一条用完',
  //   '连接剩余部分，🎉 全部完成！',
  // ];
  // const hints_iter = [
  //   "创建一个虚拟头结点 prehead（值可写 -1，仅作占位），让 prev 指向它；\n设置 l1 指向 list1 头、l2 指向 list2 头。\n现在：l1=1，l2=1。\n比较 l1 与 l2（节点相等时选择list1的节点）, 应该接入哪个到prehead节点之后?\n 用橘色箭头从prehead节点指向你选择的节点。",
  //   "把 prev 向前移动到刚接入的1，并将 l1 指向下一个（此时 l1=2）。再次比较：l1=2，l2=1。\n这次应像prev节点接入哪个节点，用橘色箭头标出",
  //   "继续循环接入节点，在每次接入后，prev 与对应指针同步前移。\n一直到l1=null或者l2=null停下",
  //   "当某一条链表指针变为 null，\n将另一条未用完的链表整体接到 prev 所指向节点的后面。完成！返回 prehead.next。\n点击检查是否得到有序链，且所有原节点都被包含。",
  // ];
  
  // const steps = useMemo(() => {
  //   if (storyAlgorithm === 'iter') {
  //     return hints_iter.map((h) => ({ stepText: h }));
  //   }
  //   return [
  //     { stepText: "让我们开始吧！现在有两个链表：\n• 链表1: 1 → 2 → 4\n• 链表2: 1 → 3 → 4\n查看 list1 和 list2 的头节点（都是 1）。\n我们应该先添加哪一个？\n用绿色圆圈🟢标记出你选择的头节点。" },
  //     { stepText: "将合并链表 merged 的第一个节点画为刚刚选择的节点，随后从 list2 中移除（用 ❌ 表示已移除）。" },
  //     // { stepText: "比较新的头节点：list1 是 1，list2 是 3。\n哪一个应该接下来加入合并后的链表？\n用绿色圆圈🟢标记出你选择的节点。" },
  //     // { stepText: "将 list1 中的 1 添加到合并后的链表中。\n更新 list1，用红色打叉❌标记移除这个节点，然后继续。" },
  //     { stepText: "连续做3次，自己试着完成！现在链表list1: 1->2->4, list2：3->4\n规则：🟢选择更小节点 → 接入合并链表 → 在原链表中❌删除\n完成合并链表新接3个节点"},
  //         { stepText: "继续！合并下一个节点。\n在4和4之间选择后，画出更新后的链表。" },
  //     { stepText: "干得漂亮！\n让我们连接最后一个节点，完成合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。" },
  //   ] as { stepText: string }[];
  // }, [storyAlgorithm]);
// ✅ 新增：迭代版中英文标题/提示
const titles_iter_ZH = [
    '第一次比较并接入',
    '移动 prev，更新指针，再次比较，继续接入',
    '循环推进：直到有一条用完',
    '连接剩余部分，🎉 全部完成！',
  ];
const titles_iter_EN = [
  'First compare & attach',
  'Move prev, update pointers, compare again',
  'Keep looping until one list ends',
  'Attach the remainder — done! 🎉',
];

const hints_iter_ZH = [
  "创建一个虚拟头结点 prehead（值可写 -1，仅作占位），让 prev 指向它；\n设置 l1 指向 list1 头、l2 指向 list2 头。\n现在：l1=1，l2=1。\n比较 l1 与 l2（节点相等时选择 list1 的节点），应该接入哪个到 prehead 节点之后？\n用橘色箭头从 prehead 节点指向你选择的节点。",
  "把 prev 向前移动到刚接入的 1，并将 l1 指向下一个（此时 l1=2）。再次比较：l1=2，l2=1。\n这次应向 prev 节点接入哪个节点，用橘色箭头标出。",
  "继续循环接入节点，在每次接入后，prev 与对应指针同步前移。\n一直到 l1=null 或者 l2=null 停下。",
    "当某一条链表指针变为 null，\n将另一条未用完的链表整体接到 prev 所指向节点的后面。完成！返回 prehead.next。\n点击检查是否得到有序链，且所有原节点都被包含。",
  ];
const hints_iter_EN = [
  "Create a dummy head `prehead` (e.g., value -1 as a placeholder) and set `prev` to it.\nLet `l1` point to list1 head and `l2` to list2 head.\nNow: l1=1, l2=1.\nCompare l1 and l2 (when equal, choose the node from list1). Which one should be attached after `prehead`?\nUse an orange arrow from `prehead` to the chosen node.",
  "Move `prev` to the just-attached 1, and advance `l1` (now l1=2). Compare again: l1=2, l2=1.\nWhich node should be attached to `prev` this time? Mark with an orange arrow.",
  "Keep attaching the smaller node each time; after attaching, move `prev` and the corresponding pointer forward.\nStop when either `l1` or `l2` becomes null.",
  "When one list becomes null,\nattach the remaining list to `prev.next`. Done! Return `prehead.next`.\nClick Check to verify the result is sorted and includes all original nodes.",
];
const titles_iter = zh ? titles_iter_ZH : titles_iter_EN;
const hints_iter = zh ? hints_iter_ZH : hints_iter_EN;
// ✅ 如果你还有贪心/其它算法，也可同样做一份 EN 版，然后像下面这样切换
// 例如：const hints_greed_ZH = [...]; const hints_greed_EN = [...];

// 递归方法步骤（固定使用递归，不需要选择）
  const steps = useMemo(() => {
  // 递归方法（algo1）——做双语
  if (zh) {
    return [
      // { stepText: "让我们开始吧！现在有两个链表：\n• 链表1: 1 → 2 → 4\n• 链表2: 1 → 3 → 4"},
      { stepText: "查看 list1 和 list2 的头节点（都是 1）。\n我们应该先添加哪一个？\n用绿色圆圈🟢标记出你选择的头节点。" },
      { stepText: "将合并链表 merged 的第一个节点画为刚刚选择的节点，随后从 list2 中移除（用 ❌ 表示已移除）。" },
      { stepText: "连续做3次，自己试着完成！现在链表 list1: 1->2->4, list2：3->4\n规则：🟢选择更小节点 → 接入合并链表 → 在原链表中❌删除\n完成合并链表新接 3 个节点" },
      { stepText: "继续！合并下一个节点。\n在 4 和 4 之间选择后，画出更新后的链表。" },
      { stepText: "干得漂亮！\n让我们连接最后一个节点，完成合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。" },
    ];
  } else {
    return [
      // { stepText: "Let's start! We have two lists:\n• list1: 1 → 2 → 4\n• list2: 1 → 3 → 4"},
      { stepText: "Look at the heads (both are 1).\nWhich one should we add first?\nMark your choice with a green circle 🟢." },
      { stepText: "Draw the first node of the merged list as the one you just chose, then remove it from the original list (mark with ❌)." },
      { stepText: "Do it three more times by yourself! Now lists are: list1: 1->2->4, list2: 3->4\nRule: 🟢 pick the smaller node → attach to merged list → ❌ delete from the original list\nFinish attaching 3 new nodes." },
      { stepText: "Keep going! Merge the next node.\nBetween 4 and 4, choose one and draw the updated lists." },
      { stepText: "Great! Connect the final node to finish the merged list.\nDouble-check that all nodes are included and the order is correct." },
    ];
  }
}, [zh]);
// 1. 文案字典
const ZH = {
  toolbar_mode: "模式",
  toolbar_move: "移动",
  toolbar_select: "选择",
  toolbar_rect: "矩形",
  toolbar_ellipse: "椭圆",
  toolbar_arrow: "箭头",
  toolbar_line: "连线",
  toolbar_draw: "自由绘制",
  toolbar_text: "文字",
  toolbar_eraser: "橡皮擦",
  toolbar_library: "素材库",

  greedy_title: "贪心算法",
  btn_animation: "动画",
  // 你用到的其它 key 也都放进来…
};

const EN = {
  toolbar_mode: "Mode",
  toolbar_move: "Pan",
  toolbar_select: "Select",
  toolbar_rect: "Rectangle",
  toolbar_ellipse: "Ellipse",
  toolbar_arrow: "Arrow",
  toolbar_line: "Line",
  toolbar_draw: "Free draw",
  toolbar_text: "Text",
  toolbar_eraser: "Eraser",
  toolbar_library: "Library",

  greedy_title: "Greedy Algorithm",
  btn_animation: "Animation",
  // 同步英文字段…
};

// 2. 根据 zh 选择一份
const t = useMemo(() => (zh ? ZH : EN), [zh]);
// Only show special hint when Scaffolding Mode is High; re-compute on global event


  // 根据算法重置故事模式的所有步骤与画布；第0步采用不同初始文件
  // const resetStoryForAlgorithm = async (alg: 'algo1' | 'iter') => {
  //   if (!excalidrawAPI) return;
  //   try {
  //     const initFile = alg === 'iter'
  //     ? (zh ? '/initial2.excalidraw' : '/initial2e.excalidraw')
  //     : (zh ? '/initial1.excalidraw' : '/initial1e.excalidraw');
  //     let initialStep0: StepScene = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
  //     try {
  //       const resp = await fetch(initFile);
  //       if (resp.ok) {
  //         const data = await resp.json();
  //         initialStep0 = {
  //           elements: Array.isArray(data?.elements) ? data.elements : [],
  //           files: data?.files || {},
  //           appState: { viewBackgroundColor: '#fff', ...(data?.appState || {}) },
  //         };
  //       }
  //     } catch {}

  //     const initialScenes: Record<number, StepScene> = {};
  //     initialScenes[0] = initialStep0;
  //     for (let i = 1; i < (alg === 'iter' ? hints_iter.length : steps.length); i++) {
  //       initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
  //     }
  //     setScenes(initialScenes);

  //     // 重置步骤索引/状态/提示
  //     currentStepIndexRef.current = 0;
  //     setCurrentStepIndex(0);
  //     // 同步当前步骤文本为所选算法的第0步
  //     if (alg === 'iter') {
  //       setCurrentStepText(hints_iter[0] || '');
  //     } else {
  //       setCurrentStepText(
  //         "让我们开始吧！现在有两个链表：\n• 链表1: 1 → 2 → 4\n• 链表2: 1 → 3 → 4\n查看 list1 和 list2 的头节点（都是 1）。我们应该先添加哪一个？\n取出它绘制到合并后的链表merged中。\n然后从 list2 中将这个节点用橡皮擦擦除。"
  //       );
  //     }
  //     setStepStatuses(Array(Object.keys(initialScenes).length).fill('pending'));
  //     setStepNotes({});
  //     setStepChecks({});
  //     setNotes('');
  //     setIsNotesOpen(false);

  //     // 显示第0步
  //     const scene0 = initialScenes[0];
  //     excalidrawAPI.updateScene({
  //       elements: Array.from(scene0.elements) as any[],
  //       appState: scene0.appState,
  //       captureUpdate: 2 as any,
  //     });
  //   } catch (e) {
  //     console.warn('重置故事模式失败', e);
  //   }
  // };
  // 把 zh 作为参数（或直接用外层 state 也行）
const resetStoryForAlgorithm = async (alg: 'algo1' | 'iter', zh: boolean) => {
    if (!excalidrawAPI) return;
    try {
    // 固定使用递归方法的初始文件
    const initFile = zh ? '/initial1.excalidraw' : '/initial1e.excalidraw';

    // 切换期间先暂停自动保存，避免被旧场景覆盖
    isModeSwitching.current = true;

    let initialStep0: StepScene = {
      elements: [],
      files: {},
      appState: { viewBackgroundColor: '#fff' },
    };

      try {
        const resp = await fetch(initFile);
        if (resp.ok) {
          const data = await resp.json();
          initialStep0 = {
            elements: Array.isArray(data?.elements) ? data.elements : [],
            files: data?.files || {},
            appState: { viewBackgroundColor: '#fff', ...(data?.appState || {}) },
          };
      } else {
        console.warn('fetch init file failed:', initFile, resp.status);
        }
    } catch (e) {
      console.warn(`Failed to fetch init file: ${initFile}`, e);
    }

    // 重置步骤场景（第0步用初始文件，其它步清空）
    const stepsCount = steps.length; // 你已有的 steps
      const initialScenes: Record<number, StepScene> = {};
      initialScenes[0] = initialStep0;
    for (let i = 1; i < stepsCount; i++) {
        initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
      }
      setScenes(initialScenes);

    // 回到第0步并显示
      currentStepIndexRef.current = 0;
      setCurrentStepIndex(0);
    setCurrentStepText(steps[0]?.stepText || '');
    setStepStatuses(Array(stepsCount).fill('pending'));
      setStepNotes({});
      setStepChecks({});
      setNotes('');
      setIsNotesOpen(false);

    // 立即刷新到画布
      excalidrawAPI.updateScene({
      elements: Array.from(initialStep0.elements) as any[],
      appState: initialStep0.appState,
        captureUpdate: 2 as any,
      collaborators: new Map(),
    });
  } finally {
    // 切换完再恢复自动保存
    isModeSwitching.current = false;
  }
};
// 当语言 zh 变化时，若当前在 story 模式，就重置当前算法的初始画布
useEffect(() => {
  if (!excalidrawAPI) return;
  if (mode !== 'story') return;          // 只在故事模式刷新初始画布
  resetStoryForAlgorithm('algo1', zh);   // 固定使用递归方法
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [zh]);

  // const steps = useMemo(
  // () => [
  //   { stepText: "让我们开始吧！请绘制一个节点表示 \( F(5) \)。" },
  //   { stepText: "现在你已经绘制了 \( F(5) \)，接下来应该考虑什么？\( F(5) \) 依赖于哪两个子问题？" },
  //   { stepText: "你已经找到了 \( F(5) \) 的两个子问题，接下来应该怎么做？\( F(4) \) 的子问题是什么？" },
  //   { stepText: "你已经分解了 \( F(4) \)，接下来呢？\( F(3) \) 的子问题是什么？" },
  //   { stepText: "你已经分解了 \( F(3) \)，接下来呢？\( F(2) \) 的子问题是什么？" },
  //   { stepText: "你已经分解了 \( F(2) \)，接下来呢？\( F(3) \) 的子问题是什么？" },
  //   { stepText: "你已经分解了 \( F(3) \)，接下来呢？\( F(2) \) 的子问题是什么？" },
  //   { stepText: "你已经分解了所有子问题，现在应该考虑什么？哪些节点是基本情况？" },
  //   { stepText: "你已经标记了基本情况，接下来应该怎么做？如何从基本情况开始回溯？" },
  //   { stepText: "你已经开始回溯了，接下来呢？如何逐步计算每个节点的值？" },
  //   { stepText: "你已经完成了递归树的构建和计算，现在应该做什么？检查你的递归树，确保所有节点的值都已正确计算。" }
  //       ] as { stepText: string }[],
  //     []
  // );
  const [stepStatuses, setStepStatuses] = useState<string[]>(Array(steps.length).fill("pending"));

  // 用 index->scene 的 map 存每步画布
  const [scenes, setScenes] = useState<Record<number, StepScene>>({});
  const currentStepIndexRef = useRef(0);
  
  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 加载本地库文件
    fetch("/files/library.excalidrawlib")
      .then(res => res.json())
      .then(data => {
        // data.libraryItems 应为库元素数组
        if (excalidrawAPI && data.libraryItems) {
          excalidrawAPI.updateLibrary({
            libraryItems: data.libraryItems,
            // openLibraryMenu: true,
          });
        }
        if (data.libraryItems) {
          setLibraryItems(data.libraryItems);
        }
      });
  }, [excalidrawAPI]);

  // 初始 step：仅第1步从 public/initial1.excalidraw 初始化，其余空白
  useEffect(() => {
    if (!excalidrawAPI) return;
    console.log('🚀 初始化画布和场景（第1步载入 initial1.excalidraw，其余空白）');
    (async () => {
      let initialStep0: StepScene | null = null;
      try {
        const resp = await fetch('/initial1.excalidraw');
        if (resp.ok) {
          const data = await resp.json();
          const elements = Array.isArray(data?.elements) ? data.elements : [];
          const files = data?.files || {};
          const appState = { viewBackgroundColor: '#fff', ...(data?.appState || {}) };
          initialStep0 = { elements, files, appState };
          console.log('✅ 载入 initial1.excalidraw 成功，元素数:', elements.length);
        } else {
          console.warn('⚠️ 载入 initial1.excalidraw 失败:', resp.status);
        }
      } catch (e) {
        console.warn('⚠️ 载入 initial1.excalidraw 异常:', e);
      }

    const initialScenes: Record<number, StepScene> = {};
      // 第一步：若有文件则载入，否则空白
      if (initialStep0) {
        initialScenes[0] = initialStep0;
        console.log('✅ 步骤 0 使用 initial1.excalidraw 初始化');
      } else {
        initialScenes[0] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
        console.log('✅ 步骤 0 初始化为空白画布（未找到 initial1.excalidraw）');
      }
      // 其余步骤空白
    for (let i = 1; i < steps.length; i++) {
        initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
        console.log(`✅ 步骤 ${i} 初始化为空白画布`);
      }

    setScenes(initialScenes);
      console.log(`✅ 初始化了 ${steps.length} 个步骤，步骤0载入${initialStep0 ? '文件' : '空白'}，其余空白`);
    
      // 显示第0步
      const scene0 = initialScenes[0];
      excalidrawAPI.updateScene({
        elements: Array.from(scene0.elements) as any[],
        appState: scene0.appState,
      captureUpdate: 2 as any,
    });
      console.log('✅ 显示第0步画布');
    
    // 确保探索模式有独立的初始状态
    if (exploreModeCanvas.elements.length === 0) {
        setExploreModeCanvas({ elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } });
      console.log('✅ 初始化探索模式画布完成');
    }
    
    currentStepIndexRef.current = 0;
    console.log('📍 设置当前步骤索引为 0');
    if (steps.length > 0) {
      setCurrentStepText(steps[0].stepText);
      console.log('📝 设置初始步骤文本:', steps[0].stepText.substring(0, 50) + '...');
    }
    })();
  }, [excalidrawAPI]); // eslint-disable-line

  // 自动保存场景的定时器
  useEffect(() => {
    if (!excalidrawAPI) return;
    
    // console.log('⏰ 启动自动保存定时器');
    
    // 每2秒自动保存一次场景，提高保存频率
    const autoSaveInterval = setInterval(() => {
      if (excalidrawAPI) {
        // console.log('⏰ 定时自动保存场景');
        saveCurrentScene();
      }
    }, 2000);

    return () => clearInterval(autoSaveInterval);
  }, [excalidrawAPI]);

  // 清理mode窗口拖动事件监听器
  useEffect(() => {
    return () => {
      if (modeWindowDragging.current) {
        window.removeEventListener('mousemove', handleModeWindowMouseMove);
        window.removeEventListener('mouseup', handleModeWindowMouseUp);
      }
    };
  }, []);
  
  // 检测设备类型
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/.test(userAgent);
      const isTabletDevice = /ipad|android(?!.*mobile)|tablet/.test(userAgent);
      
      setIsMobile(isMobileDevice);
      setIsTablet(isTabletDevice);
      
      console.log('🔍 设备检测:', {
        userAgent: navigator.userAgent,
        isMobile: isMobileDevice,
        isTablet: isTabletDevice,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });
    };
    
    checkDevice();
    
    // 监听窗口大小变化
    const handleResize = () => {
      checkDevice();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 清理自动保存定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  // 监听画布变化，自动保存
  useEffect(() => {
    if (!excalidrawAPI) return;
    
    // 创建一个防抖函数来避免频繁保存
    let saveTimeout: NodeJS.Timeout;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (excalidrawAPI) {
          // console.log('🎨 画布变化，自动保存场景');
          saveCurrentScene();
        }
      }, 500); // 减少到0.5秒后保存，提高响应速度
    };

    // 监听画布变化事件
    const handleCanvasChange = () => {
      debouncedSave();
    };

    // 尝试监听 Excalidraw 的内部事件
    try {
      // 监听元素变化
      const unsubscribe = excalidrawAPI.onPointerDown(() => {
        debouncedSave();
      });
      
      // 监听场景更新
      const unsubscribeScene = excalidrawAPI.onPointerUp(() => {
        debouncedSave();
      });
    
    return () => {
      clearTimeout(saveTimeout);
        if (unsubscribe) unsubscribe();
        if (unsubscribeScene) unsubscribeScene();
      };
    } catch (error) {
      console.log('⚠️ 无法监听 Excalidraw 事件，使用定时器作为备选方案');
      return () => {
        clearTimeout(saveTimeout);
      };
    }
  }, [excalidrawAPI]);

  async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // 去掉前缀，只保留纯 base64
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

  // 保存当前场景 - 根据当前模式保存到对应的状态中
  const saveCurrentScene = () => {
    if (!excalidrawAPI) return;
    
    // 如果正在切换模式，跳过保存
    if (isModeSwitching.current) {
      console.log('⚠️ 正在切换模式，跳过保存');
      return { elements: [], files: {}, appState: {} };
    }
    
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const appState = excalidrawAPI.getAppState();
    
    // console.log(`💾 保存画布 - 当前模式: ${mode}, 元素数量: ${elements.length}`);
    
    if (mode === 'story') {
      // 故事模式：保存到当前步骤
      const idx = currentStepIndexRef.current;
      if (idx === undefined) {
        console.warn('⚠️ 故事模式下 currentStepIndexRef.current 未定义，跳过保存');
        return { elements, files, appState };
      }
      
      // console.log(`🔄 保存故事模式场景 ${idx}:`, { 
      // elementsCount: elements.length, 
      // hasFiles: Object.keys(files).length > 0 
    // });
    
    // 立即更新场景状态 - 只更新当前步骤，不影响其他步骤
    setScenes((prev) => {
      const newScenes = {
        ...prev,
        [idx]: { elements: [...elements], files, appState },
      };
        // console.log(`💾 故事模式场景 ${idx} 已保存，当前场景数量:`, Object.keys(newScenes).length);
      return newScenes;
    });
      
      // 更新调试信息
      setDebugInfo(prev => ({
        ...prev,
        lastSavedMode: 'story',
        lastSavedStoryStep: idx,
      }));
      
    } else if (mode === 'explore') {
      // 探索模式：保存到探索模式画布状态
      // console.log(`🔄 保存探索模式画布:`, { 
      //   elementsCount: elements.length, 
      //   hasFiles: Object.keys(files).length > 0 
      // });
      
      setExploreModeCanvas({
        elements: [...elements],
        files,
        appState,
      });
      // console.log('💾 探索模式画布已保存');
      
      // 更新调试信息
      setDebugInfo(prev => ({
        ...prev,
        lastSavedMode: 'explore',
        lastSavedExploreElements: elements.length,
      }));
    }
    
    // 返回保存的场景数据，以便立即使用
    return { elements, files, appState };
  };
  
  // 获取当前步骤的保存状态
  const getCurrentStepSaveStatus = () => {
    const currentIdx = currentStepIndexRef.current;
    if (scenes[currentIdx] && scenes[currentIdx].elements) {
      return `已保存 (${scenes[currentIdx].elements.length} 个元素)`;
    }
    return '未保存';
  };

  // 清除临时元素，保留基础图形
  const clearTemporaryElements = () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    
    // 过滤掉临时元素，保留基础图形
    const permanentElements = elements.filter((el: any) => {
      // 保留基础图形类型
      if (['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw'].includes(el.type)) {
        return true;
      }
      
      // 对于文本，保留不包含临时标记的
      if (el.type === 'text') {
        return !el.text?.toLowerCase().includes('temp') && 
               !el.text?.toLowerCase().includes('标注') &&
               !el.text?.toLowerCase().includes('note');
      }
      
      // 默认保留其他类型
      return true;
    });
    
    // 更新画布
    excalidrawAPI.updateScene({
      elements: Array.from(permanentElements as any[]),
      appState: excalidrawAPI.getAppState(),
      collaborators: new Map(),
      captureUpdate: 2 as any,
    });
    
    // 保存清理后的场景
    saveCurrentScene();
  };

  // Mode切换窗口拖动处理函数
  const handleModeWindowMouseDown = (e: React.MouseEvent) => {
    modeWindowDragging.current = true;
    modeWindowOffset.current = {
      x: e.clientX - modeWindowPosition.x,
      y: e.clientY - modeWindowPosition.y,
    };
    window.addEventListener('mousemove', handleModeWindowMouseMove);
    window.addEventListener('mouseup', handleModeWindowMouseUp);
  };

  const handleModeWindowMouseMove = (e: MouseEvent) => {
    if (!modeWindowDragging.current) return;
    setModeWindowPosition({
      x: e.clientX - modeWindowOffset.current.x,
      y: e.clientY - modeWindowOffset.current.y,
    });
  };

  const handleModeWindowMouseUp = () => {
    modeWindowDragging.current = false;
    window.removeEventListener('mousemove', handleModeWindowMouseMove);
    window.removeEventListener('mouseup', handleModeWindowMouseUp);
  };

  // Pointer 版本（支持触控）与边界夹紧
  const clampModeWindow = (x: number, y: number) => {
    const margin = 6;
    const cw = rightPaneRef.current?.clientWidth ?? window.innerWidth;
    const ch = rightPaneRef.current?.clientHeight ?? window.innerHeight;
    const maxX = Math.max(margin, cw - modeWindowSize.width - margin);
    const maxY = Math.max(margin, ch - modeWindowSize.height - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  };

  const handleModeWindowPointerDown = (e: React.PointerEvent) => {
    modeWindowDragging.current = true;
    modeWindowOffset.current = {
      x: e.clientX - modeWindowPosition.x,
      y: e.clientY - modeWindowPosition.y,
    };
    window.addEventListener('pointermove', handleModeWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleModeWindowPointerUp, { passive: true });
  };

  const handleModeWindowPointerMove = (e: PointerEvent) => {
    if (!modeWindowDragging.current) return;
    e.preventDefault();
    const next = clampModeWindow(
      e.clientX - modeWindowOffset.current.x,
      e.clientY - modeWindowOffset.current.y
    );
    setModeWindowPosition(next);
  };

  const handleModeWindowPointerUp = () => {
    modeWindowDragging.current = false;
    window.removeEventListener('pointermove', handleModeWindowPointerMove as any);
    window.removeEventListener('pointerup', handleModeWindowPointerUp as any);
    setModeWindowPosition((prev) => clampModeWindow(prev.x, prev.y));
  };

  // 统一的模式切换逻辑（供弹窗选择使用）
  const changeMode = (newMode: 'story' | 'explore') => {
    if (!excalidrawAPI) return;
    if (newMode === null || newMode === mode) return;
    // 设置模式切换标志，防止自动保存
    isModeSwitching.current = true;
    console.log('🔄 开始模式切换，禁用自动保存');

    // 保存当前模式的画布状态
    const currentElements = excalidrawAPI.getSceneElements();
    const currentFiles = excalidrawAPI.getFiles();
    const currentAppState = excalidrawAPI.getAppState();
    
    console.log(`🔄 模式切换 - 从 ${mode} 切换到 ${newMode}, 当前画布元素数: ${currentElements.length}`);

    // 创建临时变量来存储要保存的状态
    let tempStoryScene: any = null;
    let tempExploreCanvas: any = null;

    if (mode === 'story') {
      // 从故事模式切换到探索模式，保存故事模式的当前状态
      if (currentStepIndexRef.current !== undefined) {
        tempStoryScene = {
      elements: [...currentElements],
      files: currentFiles,
      appState: currentAppState,
    };
        console.log(`💾 准备保存故事模式场景 ${currentStepIndexRef.current}, 元素数: ${currentElements.length}`);
      } else {
        console.warn('⚠️ 故事模式下 currentStepIndexRef.current 未定义');
      }
    } else if (mode === 'explore') {
      // 从探索模式切换到故事模式，保存探索模式的画布
      tempExploreCanvas = {
        elements: [...currentElements],
        files: currentFiles,
        appState: currentAppState,
      };
      console.log('💾 准备保存探索模式画布, 元素数:', currentElements.length);

      // 重要：确保探索模式的内容不会影响故事模式
      console.log('🔒 探索模式内容已保存，不会影响故事模式状态');

      // 关键修复：从探索模式切换到故事模式时，也要保存故事模式当前的状态
      if (currentStepIndexRef.current !== undefined) {
        const currentStoryScene = (scenes as any)[currentStepIndexRef.current];
        if (currentStoryScene && currentStoryScene.elements && currentStoryScene.elements.length > 0) {
          // 故事模式有内容，保存到临时变量
          tempStoryScene = {
            elements: [...currentStoryScene.elements],
            files: currentStoryScene.files,
            appState: currentStoryScene.appState,
          };
          console.log(`💾 从探索模式切换时，保存故事模式步骤 ${currentStepIndexRef.current} 的当前状态，元素数: ${currentStoryScene.elements.length}`);
        } else {
          console.log(`💾 从探索模式切换时，故事模式步骤 ${currentStepIndexRef.current} 没有内容，保持空白`);
        }
      }
    }

    // 重要：先更新状态，再加载画布
    if (tempStoryScene) {
      setScenes(prev => ({
        ...prev,
        [currentStepIndexRef.current!]: tempStoryScene,
      }));
      console.log(`💾 故事模式场景 ${currentStepIndexRef.current} 已保存`);
    }

    if (tempExploreCanvas) {
      setExploreModeCanvas(tempExploreCanvas);
      console.log('💾 探索模式画布已保存');
    }

    // 关键：验证状态保存结果
    console.log('🔍 状态保存验证:');
    console.log(`  - 故事模式临时场景:`, tempStoryScene ? `步骤 ${currentStepIndexRef.current}, 元素数: ${tempStoryScene.elements.length}` : '无');
    console.log(`  - 探索模式临时画布:`, tempExploreCanvas ? `元素数: ${tempExploreCanvas.elements.length}` : '无');

    // 重要：验证状态分离，确保探索模式内容不会污染故事模式
    console.log('🔍 状态分离验证:');
    console.log('  - 故事模式临时场景元素数:', tempStoryScene?.elements?.length || 0);
    console.log('  - 探索模式临时画布元素数:', tempExploreCanvas?.elements?.length || 0);
    console.log('  - 当前步骤索引:', currentStepIndexRef.current);

    // 切换到新模式
    setMode(newMode);
    previousModeRef.current = newMode;

    // 关键：使用临时变量直接加载画布，不依赖异步状态更新
    if (excalidrawAPI) {
      if (newMode === 'explore') {
        // 加载探索模式的画布 - 直接使用临时变量
        let targetExploreCanvas;
        if (tempExploreCanvas) {
          targetExploreCanvas = tempExploreCanvas;
          console.log('🎨 使用刚保存的探索模式画布，元素数:', targetExploreCanvas.elements.length);
        } else {
          targetExploreCanvas = exploreModeCanvas;
          console.log('🎨 使用已保存的探索模式画布，元素数:', targetExploreCanvas.elements.length);
        }

        excalidrawAPI.updateScene({
          elements: Array.from(targetExploreCanvas.elements) as any[],
          appState: targetExploreCanvas.appState,
          collaborators: new Map(),
          captureUpdate: 2 as any,
        });
        console.log('🎨 探索模式画布加载完成');
      } else if (newMode === 'story') {
        // 关键：从探索模式切换到故事模式时，使用临时变量直接加载故事模式内容
        const stepIndex = currentStepIndexRef.current;
        if (stepIndex !== undefined) {
          // 重要：直接使用临时变量，不依赖异步的 scenes 状态
          let targetStoryScene;

          if (tempStoryScene) {
            // 如果刚保存了故事模式内容，直接使用
            targetStoryScene = tempStoryScene;
            console.log(`🎨 使用刚保存的故事模式场景 ${stepIndex}，元素数: ${targetStoryScene.elements.length}`);
          } else {
            // 否则从当前 scenes 状态加载
            targetStoryScene = (scenes as any)[stepIndex];
            console.log(`🎨 从当前状态加载故事模式场景 ${stepIndex}，元素数: ${targetStoryScene?.elements?.length || 0}`);
          }

          if (targetStoryScene && targetStoryScene.elements && targetStoryScene.elements.length > 0) {
            // 有保存的故事模式内容，强制显示
            excalidrawAPI.updateScene({
              elements: Array.from(targetStoryScene.elements) as any[],
              appState: targetStoryScene.appState,
              collaborators: new Map(),
              captureUpdate: 2 as any,
            });
            console.log(`🎨 强制显示故事模式步骤 ${stepIndex} 的保存内容，元素数: ${targetStoryScene.elements.length}`);
      } else {
            // 没有保存的故事模式内容，显示空白画布
            excalidrawAPI.updateScene({
              elements: [],
              appState: { viewBackgroundColor: "#fff" },
              collaborators: new Map(),
              captureUpdate: 2 as any,
            });
            console.log(`🎨 故事模式步骤 ${stepIndex} 没有保存内容，显示空白画布`);
          }
        } else {
          excalidrawAPI.updateScene({
            elements: [],
            appState: { viewBackgroundColor: "#fff" },
            collaborators: new Map(),
            captureUpdate: 2 as any,
          });
          console.log('🎨 故事模式步骤索引未定义，显示空白画布');
        }
        console.log('🎨 故事模式画布加载完成');
      }
    }

    // 切换mode时重置一些状态
    if (newMode === 'explore') {
      setCurrentStepText('');
      setCurrentStepIndex(0);
    }

    // 模式切换完成，重新启用自动保存
    isModeSwitching.current = false;
    console.log('✅ 模式切换完成，重新启用自动保存');

    // 如果切换到故事模式，强制验证并恢复正确的状态
    if (newMode === 'story') {
      setTimeout(() => {
        if (excalidrawAPI) {
          const stepIndex = currentStepIndexRef.current;
          if (stepIndex !== undefined) {
            // 重要：使用临时变量，确保状态完全分离
            let targetScene;

            if (tempStoryScene) {
              // 优先使用刚保存的故事模式内容
              targetScene = tempStoryScene;
              console.log(`🔄 强制验证：使用刚保存的故事模式场景 ${stepIndex}，元素数: ${targetScene.elements.length}`);
            } else {
              // 否则从 scenes 状态加载
              targetScene = (scenes as any)[stepIndex];
              console.log(`🔄 强制验证：从状态加载故事模式场景 ${stepIndex}，元素数: ${targetScene?.elements?.length || 0}`);
            }

            const currentElementsNow = excalidrawAPI.getSceneElements();
            console.log(`🔍 强制验证故事模式步骤 ${stepIndex}:`);
            console.log(`  - 目标场景元素数:`, targetScene?.elements?.length || 0);
            console.log(`  - 当前画布元素数:`, currentElementsNow.length);

            // 强制确保画布显示正确的故事模式内容
            if (targetScene && targetScene.elements && targetScene.elements.length > 0) {
              // 有保存内容，强制显示保存内容
              excalidrawAPI.updateScene({
                elements: Array.from(targetScene.elements) as any[],
                appState: targetScene.appState,
                collaborators: new Map(),
                captureUpdate: 2 as any,
              });
              console.log(`🔄 强制恢复故事模式步骤 ${stepIndex} 的保存内容，元素数: ${targetScene.elements.length}`);
            } else {
              // 没有保存内容，强制显示空白画布
              excalidrawAPI.updateScene({
          elements: [],
          appState: { viewBackgroundColor: "#fff" },
                collaborators: new Map(),
                captureUpdate: 2 as any,
              });
              console.log(`🔄 强制清空故事模式步骤 ${stepIndex} 的画布`);
            }
          }
        }
      }, 5);
    }

    setIsModeDialogOpen(false);
  };

  // 初始与尺寸变化：测量并把模式卡片放到右侧画布的左上角（顶格）
  useEffect(() => {
    const measureAndCenter = () => {
      if (modeWindowRef.current) {
        const rect = modeWindowRef.current.getBoundingClientRect();
        setModeWindowSize({ width: rect.width, height: rect.height });
        const margin = 6;
        // 顶部对齐到容器起始位置
        setModeWindowPosition(clampModeWindow(margin, margin));
      }
    };
    // 延迟一帧测量，避免初始布局抖动
    const t = setTimeout(measureAndCenter, 0);
    const onResize = () => measureAndCenter();
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
  }, []);

  // 切换步骤：仅保存当前，再加载目标（不再自动继承上一步）
  const handleStepChange = (stepText: string, nextIndex: number) => {
    if (!excalidrawAPI) return;
    
    console.log(`🔄 切换步骤: ${currentStepIndexRef.current} -> ${nextIndex}`);
    console.log(`📊 当前场景状态:`, scenes);
    
    // 强制保存当前场景
    const currentElements = excalidrawAPI.getSceneElements();
    const currentFiles = excalidrawAPI.getFiles();
    const currentAppState = excalidrawAPI.getAppState();
    
    console.log(`🔍 当前画布元素数量: ${currentElements.length}`);
    
    // 直接更新场景状态，确保当前场景被保存
    const updatedScenes = { ...scenes };
    updatedScenes[currentStepIndexRef.current] = {
      elements: [...currentElements],
      files: currentFiles,
      appState: currentAppState,
    };
    
    // console.log(`💾 强制保存当前场景 ${currentStepIndexRef.current}，元素数量: ${currentElements.length}`);
    
        // 2) 载入目标场景：若为空 → 继承上一页
    let targetScene: StepScene = updatedScenes[nextIndex] || {
          elements: [],
          files: {},
          appState: { viewBackgroundColor: "#fff" },
        };

    const isEmpty = !targetScene.elements || targetScene.elements.length === 0;

    if (isEmpty && nextIndex > 0) {
      const prevScene = updatedScenes[nextIndex - 1];
      if (prevScene && prevScene.elements && prevScene.elements.length > 0) {
        // 深拷贝上一页作为本页的初始内容
        targetScene = {
          elements: [...prevScene.elements],
          files: prevScene.files,
          appState: prevScene.appState,
        };
        // 把继承结果持久化到 scenes
        updatedScenes[nextIndex] = targetScene;
        console.log(`🧩 步骤 ${nextIndex} 为空，已继承步骤 ${nextIndex - 1} 的内容（元素数: ${targetScene.elements.length}）`);
      } else {
        console.log(`ℹ️ 步骤 ${nextIndex} 为空，且上一步也为空/不存在，保持空白`);
      }
    }

    // 如果切到第0步但当前为空，做一次懒加载 initial1.excalidraw 作为兜底
    if (nextIndex === 0 && (!targetScene.elements || targetScene.elements.length === 0)) {
      (async () => {
        try {
          const resp = await fetch('/initial1.excalidraw');
          if (resp.ok) {
            const data = await resp.json();
            const elements = Array.isArray(data?.elements) ? data.elements : [];
            const files = data?.files || {};
            const appState = { viewBackgroundColor: '#fff', ...(data?.appState || {}) };
            const fallback: StepScene = { elements, files, appState };
            setScenes(prev => ({ ...prev, 0: fallback }));
            // 立即显示
            excalidrawAPI.updateScene({
              elements: Array.from(elements) as any[],
              appState,
              collaborators: new Map(),
              captureUpdate: 2 as any,
            });
            console.log('🔁 兜底载入 initial1.excalidraw 并显示到第0步');
          }
        } catch {}
      })();
    }

    // ⚠️ 一定要把 updatedScenes 回写，否则继承只会"显示"，不会"保存"
    setScenes(updatedScenes);

    console.log(`🎨 最终目标场景:`, targetScene);
    console.log(`🎨 更新画布，元素数量: ${targetScene.elements.length}`);
    
    // 3) 更新画布
    excalidrawAPI.updateScene({
      elements: Array.from(targetScene.elements) as any[],
      appState: targetScene.appState,
      collaborators: new Map(),
      captureUpdate: 2 as any, // NEVER；不进 undo
    });
    
    // 更新当前步骤索引
    currentStepIndexRef.current = nextIndex;
    
    // 更新当前步骤文本
    setCurrentStepText(stepText);
    setCurrentStepIndex(nextIndex);
    
    // 加载当前步骤的AI提示（如果有的话）
    const currentStepNote = stepNotes[nextIndex];
    if (currentStepNote) {
      setNotes(currentStepNote);
      setIsNotesOpen(true);
    } else {
      // 如果当前步骤没有AI提示，清空提示并关闭
      setNotes('');
      setIsNotesOpen(false);
    }
    // 加载当前步骤的AI检查结果（如果有的话），并恢复 stepStatuses
    const currentStepCheck = stepChecks[nextIndex];
    if (currentStepCheck) {
      setStepStatuses(prev => {
        const next = [...prev];
        next[nextIndex] = currentStepCheck.isValid ? 'correct' : 'wrong';
        return next;
      });
    }

    // 保持 stepStatuses 长度一致
    setStepStatuses((prev) => {
      const next = Array(steps.length).fill("pending");
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
      return next;
    });
  };

  // 示例按钮：Check = 验证当前 step
  const onCheck = async (stepIndex?: number) => {
    console.log('🚀 onCheck 函数被调用:', { stepIndex, currentStepIndex, mode });
    
    // 使用传入的步骤索引，如果没有传入则使用当前的
    const targetStepIndex = stepIndex !== undefined ? stepIndex : currentStepIndex;
    // 场景已经自动保存，这里只需要验证
    if (!excalidrawAPI) {
      console.log('❌ Excalidraw API 未初始化');
      return { isValid: false, message: 'Excalidraw API 未初始化' };
    }
    
    // 检查是否在故事模式或探索模式下
    if (mode !== 'story' && mode !== 'explore') {
      console.log('❌ 当前不在故事模式或探索模式下，无法验证');
      return { isValid: false, message: '当前不在故事模式或探索模式下，无法验证' };
    }
    
    try {
    
    const elements = excalidrawAPI.getSceneElements();
    if (!elements?.length) {
      console.log('❌ 画布为空');
      setNotes('画布为空，请先在右侧画布绘制后再点击"检查"。');
      setIsNotesOpen(true);
      return { isValid: false, message: '画布为空' };
    }
    // 1) 计算场景外接框（导出前做一遍，随 PNG 一起保存 meta）
    function getSceneAABB(elements: ReadonlyArray<any>) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        // 简化版：未考虑旋转；要更准可引入官方 bbox 工具
        if (el.x !== undefined && el.y !== undefined) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
          if (el.width !== undefined && el.height !== undefined) {
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
          } else {
            // 对于没有宽高的元素（如点、线），使用当前位置
            maxX = Math.max(maxX, el.x);
            maxY = Math.max(maxY, el.y);
          }
        }
      }
      
      // 如果没有有效元素或所有值都是 Infinity，使用默认值
      if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
        console.log('⚠️ 无法计算有效的外接框，使用默认值');
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }
      
      return { minX, minY, maxX, maxY };
    }

    // 2) 导出 PNG 时计算元信息（务必与实际导出参数一致）
    const W = 1200, H = 800, PADDING = 0;
    // ...导出前：
    // const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const { minX, minY, maxX, maxY } = getSceneAABB(Array.from(elements));
    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
    // 扩大提取区域：在当前外接框基础上向四周扩展
    const BASE_MARGIN = 120;              // 固定最小外扩像素
    const MARGIN_RATIO = 0.15;            // 相对外扩比例（基于较大边）
    const dynamicMargin = MARGIN_RATIO * Math.max(bboxW, bboxH);
    const EXPAND = Math.max(BASE_MARGIN, dynamicMargin);

    const frameW = bboxW + 2 * EXPAND;
    const frameH = bboxH + 2 * EXPAND;
    const scale  = Math.min(W / frameW, H / frameH);
    const marginX = (W - scale * frameW) / 2;
    const marginY = (H - scale * frameH) / 2;
    const frameX0 = minX - EXPAND;
    const frameY0 = minY - EXPAND;

    const exportMeta = { W, H, frameX0, frameY0, frameW, frameH, scale, marginX, marginY, exportPadding: EXPAND };
    console.groupCollapsed('[DEBUG] validate export');
    try {
      const app = excalidrawAPI.getAppState?.() as any;
      const elementsSample = Array.from(elements).slice(0, 10).map((el: any) => ({ id: el.id, type: el.type, x: el.x, y: el.y, w: el.width, h: el.height, angle: el.angle }));
      console.log('elements.count', elements.length);
      console.log('elements.sample<=10', elementsSample);
      console.log('exportMeta', exportMeta);
      console.log('appState.scroll', { scrollX: app?.scrollX, scrollY: app?.scrollY });
      console.log('appState.zoom', app?.zoom?.value ?? app?.zoom);
    } catch {}
    console.groupEnd();
    // 用与上面完全一致的参数导出 PNG
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const blob = await exportToBlob({
      elements,
      files,
      appState: { exportWithDarkMode: false, exportEmbedScene: false, viewBackgroundColor: '#fff' },
      getDimensions: () => ({ width: frameW, height: frameH, scale: 1 }),
      exportPadding: EXPAND,
    });
    // 把 PNG + exportMeta 一起发后端（或留在前端，等返回再用）

    // 先尝试保存 PNG（前缀 check_）
    try {
      const fd2 = new FormData();
      fd2.append('image', blob, `check_${Date.now()}.png`);
      const saveResp2 = await fetch(`${BACKEND_URL}/save-png`, { method: 'POST', body: fd2 });
      if (!saveResp2.ok) {
        const t = await saveResp2.text();
        // console.warn('[save-png check] failed', saveResp2.status, t);
      } else {
        const saved2 = await saveResp2.json();
        // console.groupCollapsed('[save-png check] result');
        // console.log(saved2);
        // console.groupEnd();
      }
    } catch (e) {
      // console.warn('[save-png check] error', e);
    }

    const base64 = await blobToBase64(blob);
    
    // 检查 base64 数据是否有效
    if (!base64 || base64.length < 100) {
      console.error('❌ base64 数据无效:', {
        base64Length: base64?.length || 0,
        base64Preview: base64?.substring(0, 50) || 'undefined'
      });
      throw new Error('生成的 base64 数据无效');
    }
    
    console.log('✅ base64 数据生成成功，长度:', base64.length);
    
    // 检查步骤文本
    console.log('🔍 当前步骤信息:', {
      currentStepIndex,
      currentStepText: currentStepText || 'undefined',
      currentStepTextLength: currentStepText?.length || 0,
      mode
    });
    
    // 根据模式检查步骤文本
    if (mode === 'explore') {
      if (!currentStepText || currentStepText.trim() === '') {
        console.log('⚠️ 探索模式下步骤文本为空，将使用默认值');
        // 探索模式下可以使用默认的推理步骤描述
      }
    } else if (mode === 'story') {
      if (!currentStepText || currentStepText.trim() === '') {
        console.error('❌ 故事模式下步骤文本为空，无法发送验证请求');
        throw new Error('步骤文本不能为空，请确保当前步骤有描述文本');
      }
    }

    // 计算前一步信息
    const idx = targetStepIndex;
    const hasPreviousStep = idx > 0;
    const previousStepText = hasPreviousStep
      ? (storyAlgorithm === 'iter'
          ? (hints_iter[idx - 1] || '')
          : (steps[idx - 1]?.stepText || ''))
      : '';

    // 调试信息
    console.log('🔍 步骤索引调试:', {
      currentStepIndex,
      targetStepIndex: idx,
      storyAlgorithm,
      hasPreviousStep,
      hints_iter_length: hints_iter.length,
      steps_length: steps.length,
      previousStepIndex: idx - 1,
      hints_iter_previous: hints_iter[idx - 1],
      steps_previous: steps[idx - 1]?.stepText,
      previousStepText,
      // 添加更多调试信息
      currentStepText_preview: currentStepText?.substring(0, 50),
      steps_array: steps.map((s, i) => ({ index: i, text: s.stepText?.substring(0, 30) })),
      hints_iter_array: hints_iter.map((h, i) => ({ index: i, text: h?.substring(0, 30) }))
    });

    // console.log('Image base64:', base64); // 打印保存的图片路径
    // console.log('Step text:', currentStepText); // 打印步骤文本

    console.log('🔍 发送验证请求:', {
      base64Length: base64?.length || 0,
      currentStepText: currentStepText || 'undefined',
      currentStepTextLength: currentStepText?.length || 0,
      previousStepText: previousStepText || 'undefined',
      previousStepTextLength: previousStepText?.length || 0,
      url: `${BACKEND_URL}/validate`
    });
    
    // 检查必需字段 - 根据模式进行不同处理
    if (mode === 'story' && (!currentStepText || currentStepText.trim() === '')) {
      console.error('❌ 故事模式下步骤文本为空');
      throw new Error('故事模式下步骤文本不能为空');
    } else if (mode === 'explore' && (!currentStepText || currentStepText.trim() === '')) {
      console.log('⚠️ 探索模式下步骤文本为空，将使用默认值');
      // 探索模式下继续执行，使用默认值
    }

    // 根据模式构建不同的验证请求参数
    const validationRequestBody = mode === 'story' 
      ? {
          base64: base64,     // 后端期望的字段名
          mode,                // 'story' | 'explore'
          step: idx,
          currentStepText,     // 当前步骤文本
          previousStepText: hasPreviousStep ? `${previousStepText}...` : 'undefined...',
          hasPreviousStep,
          algorithm: storyAlgorithm, // 添加算法名称
          // 还可以把"是否继承成功"的线索传一下（可选）
          prevSceneElementCount: hasPreviousStep ? (scenes[idx - 1]?.elements?.length || 0) : 0,
          currSceneElementCount: excalidrawAPI.getSceneElements()?.length || 0,
        }
      : {
          base64: base64,     // 后端期望的字段名
          mode,                // 'story' | 'explore'
          currentStepText: currentStepText || 'explore_mode_validation', // 探索模式：使用步骤文本或默认值
          previousStepText: hasPreviousStep ? `${previousStepText}...` : 'undefined...',
          hasPreviousStep,
          algorithm: storyAlgorithm, // 添加算法名称
          // 探索模式下的场景信息
          currSceneElementCount: excalidrawAPI.getSceneElements()?.length || 0,
        };

    const analyze = await fetch(`${BACKEND_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validationRequestBody),
    });

    if (!analyze.ok) {
      const errorText = await analyze.text();
      console.error('❌ 验证请求失败:', {
        status: analyze.status,
        statusText: analyze.statusText,
        errorText: errorText
      });
      throw new Error(`Validation failed: ${analyze.status} ${analyze.statusText} - ${errorText}`);
    }

    const validationData = await analyze.json();
    console.log('Validation result:', validationData);
    
    // 前端兜底：如果后端解析失败但 message 是 JSON 字符串，尝试前端再解析一次
    let vd = validationData as any;
    if (vd && typeof vd.message === 'string') {
      const m = vd.message.trim();
      if (m.startsWith('{') && m.endsWith('}')) {
        try {
          const repaired = m
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'");
          const parsed = JSON.parse(repaired);
          if (parsed && (typeof parsed.isValid === 'boolean')) {
            vd = { ok: true, ...parsed };
            console.warn('[validate] frontend parsed JSON from message fallback');
          }
        } catch (e) {
          console.warn('[validate] frontend parse message failed');
        }
      }
    }

    // 根据模式显示不同的验证结果，并保存检查结果到 stepChecks
    if (mode === 'story') {
      const transient = typeof vd?.message === 'string' && /网络错误|代理不可用|暂时不可用|稍后再试|再次点击/.test(vd.message);
      if (transient) {
        // 临时错误：仅提示，不改变状态与检查结果
        setNotes('网络或 AI 服务暂时不可用，请稍后再试，或再次点击"检查"。');
        setIsNotesOpen(true);
      } else {
        const checkNote = (vd.isValid ? "✅ Correct!\n" : "❌ Incorrect.\n") + (vd.message || "");
        setNotes(checkNote);
        // 保存检查结果到当前步骤
        setStepChecks(prev => ({
          ...prev,
          [targetStepIndex]: { isValid: !!vd.isValid, message: vd.message }
        }));
      // 故事模式下更新步骤状态
      setStepStatuses(prev => {
        const next = [...prev];
          next[targetStepIndex] = vd.isValid ? 'correct' : 'wrong';
        return next;
      });

        // 如果本步验证通过：将当前画布快照向后初始化到所有"尚未通过"的步骤
        if (vd.isValid) {
          const snapshot: StepScene = {
            elements: Array.from(excalidrawAPI.getSceneElements()) as any[],
            files: excalidrawAPI.getFiles(),
            appState: excalidrawAPI.getAppState(),
          };
          setScenes(prev => {
            const next = { ...prev } as Record<number, StepScene>;
            // 也保存当前步骤
            next[targetStepIndex] = snapshot;
            for (let i = targetStepIndex + 1; i < steps.length; i++) {
              if (stepStatuses[i] !== 'correct') {
                next[i] = {
                  elements: Array.from(snapshot.elements) as any[],
                  files: snapshot.files,
                  appState: snapshot.appState,
                };
              }
            }
            return next;
          });
        }
      }
    } else {
      const checkNote = (vd.isValid ? "✅ 探索模式验证通过!\n" : "❌ 探索模式验证失败!\n") + (vd.message || "");
      setNotes(checkNote);
      setStepChecks(prev => ({
        ...prev,
        [targetStepIndex]: { isValid: !!vd.isValid, message: vd.message }
      }));
    }
    
    setIsNotesOpen(true);
// 返回验证结果数组
    return validationData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(errorMessage);
      setNotes('网络或 AI 服务暂时不可用，请稍后再试，或再次点击"检查"。');
      setIsNotesOpen(true);
    return { isValid: false, message: `验证失败: ${errorMessage}` };
  }
  
};
// const selectedText = `
//   # 斐波那契数列

//   ## 问题描述

//   斐波那契数列是一个经典的数列，其中每个数字是前两个数字的和。给定一个整数 \( n \)，计算斐波那契数列的第 \( n \) 项 \( F(n) \)。

//   斐波那契数列的定义如下：
//   \[ F(0) = 0, F(1) = 1 \]
//   \[ F(n) = F(n - 1) + F(n - 2), \text{对于 } n > 1 \]

//   例如：
//   \`\`\`
//   输入：n = 5
//   输出：5
//   \`\`\`

//   ---

//   <details>
//   <summary>✅ 方法 1：递归</summary>

//   ### 直觉

//   使用递归方法可以直观地实现斐波那契数列的计算。递归的核心思想是将问题分解为更小的子问题，直到达到基本情况。对于斐波那契数列，递归公式为：
//   \[ F(n) = F(n - 1) + F(n - 2) \]
//   基本情况为：
//   \[ F(0) = 0 \]
//   \[ F(1) = 1 \]

//   ### 算法

//   1. 如果 \( n \) 为 0 或 1，直接返回 \( n \)。
//   2. 否则，递归调用 \( F(n - 1) \) 和 \( F(n - 2) \)，并将结果相加。
//   3. 返回最终结果。

//   递归算法的实现如下：
//   \`\`\`python
//   def fibonacci(n):
//       if n == 0:
//           return 0
//       elif n == 1:
//           return 1
//       else:
//           return fibonacci(n - 1) + fibonacci(n - 2)
//   \`\`\`

//   </details>

//   ---

//   <details>
//   <summary>✅ 方法 2：动态规划</summary>

//   ### 直觉

//   动态规划方法可以避免递归中的重复计算，从而提高效率。通过从底向上计算斐波那契数列的每一项，我们可以存储中间结果，避免重复计算。

//   ### 算法

//   1. 初始化一个数组 \`dp\`，其中 \`dp[i]\` 表示第 \( i \) 项的值。
//   2. 设置基本情况：\`dp[0] = 0\` 和 \`dp[1] = 1\`。
//   3. 从 2 到 \( n \) 遍历，计算每一项的值：\`dp[i] = dp[i - 1] + dp[i - 2]\`。
//   4. 返回 \`dp[n]\`。

//   动态规划算法的实现如下：
//   \`\`\`python
//   def fibonacci(n):
//       if n == 0:
//           return 0
//       elif n == 1:
//           return 1
//       dp = [0] * (n + 1)
//       dp[0] = 0
//       dp[1] = 1
//       for i in range(2, n + 1):
//           dp[i] = dp[i - 1] + dp[i - 2]
//       return dp[n]
//   \`\`\`

//   </details>
// `;

// console.log(selectedText);
 




  
  


 
 


  
  const handleNotesClose = () => {
      setIsNotesOpen(false);
    };
  const onNextDraw = async () => {
    if (!excalidrawAPI) {
      console.log('❌ Excalidraw API 未初始化');
      return;
    }
    
    // 检查是否在故事模式或探索模式下
    if (mode !== 'story' && mode !== 'explore') {
      console.log('❌ 当前不在故事模式或探索模式下，无法执行 AI 绘制');
      return;
    }
    
    const elements = excalidrawAPI.getSceneElements();
    if (!elements?.length) {
      console.log('❌ 画布为空');
      setNotes('画布为空，请先在右侧画布绘制后再点击"提示"。');
      setIsNotesOpen(true);
      return;
    }
    // 1) 计算场景外接框（导出前做一遍，随 PNG 一起保存 meta）
    function getSceneAABB(elements: ReadonlyArray<any>) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        // 简化版：未考虑旋转；要更准可引入官方 bbox 工具
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      return { minX, minY, maxX, maxY };
    }

    // 2) 导出 PNG 时计算元信息（务必与实际导出参数一致）
    const W = 1200, H = 800;
    // ...导出前：
    // const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const { minX, minY, maxX, maxY } = getSceneAABB(Array.from(elements));
    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
    // 动态外扩边距，避免裁剪过紧
    const BASE_MARGIN = 120;
    const MARGIN_RATIO = 0.15;
    const EXPAND = Math.max(BASE_MARGIN, MARGIN_RATIO * Math.max(bboxW, bboxH));
    const frameW = bboxW + 2 * EXPAND;
    const frameH = bboxH + 2 * EXPAND;
    const scale  = Math.min(W / frameW, H / frameH);
    const marginX = (W - scale * frameW) / 2;
    const marginY = (H - scale * frameH) / 2;
    const frameX0 = minX - EXPAND;
    const frameY0 = minY - EXPAND;

    const exportMeta = { W, H, frameX0, frameY0, frameW, frameH, scale, marginX, marginY, exportPadding: EXPAND };
    console.groupCollapsed('[DEBUG] analyze export');
    try {
      const app = excalidrawAPI.getAppState?.() as any;
      const elementsSample = Array.from(elements).slice(0, 10).map((el: any) => ({ id: el.id, type: el.type, x: el.x, y: el.y, w: el.width, h: el.height, angle: el.angle }));
      console.log('elements.count', elements.length);
      console.log('elements.sample<=10', elementsSample);
      console.log('exportMeta', exportMeta);
      console.log('appState.scroll', { scrollX: app?.scrollX, scrollY: app?.scrollY });
      console.log('appState.zoom', app?.zoom?.value ?? app?.zoom);
    } catch {}
    console.groupEnd();
    // 用与上面完全一致的参数导出 PNG
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const blob = await exportToBlob({
      elements,
      files,
      appState: { exportWithDarkMode: false, exportEmbedScene: false, viewBackgroundColor: '#fff' },
      getDimensions: () => ({ width: frameW, height: frameH, scale: 1 }),
      exportPadding: EXPAND,
    });
    // 把 PNG + exportMeta 一起发后端（或留在前端，等返回再用）
    // 先尝试保存 PNG 到后端（失败不影响后续）
    let savedPngUrl: string | undefined;
    try {
      const fd = new FormData();
      fd.append('image', blob, `analyze_${Date.now()}.png`);
      const saveResp = await fetch(`${BACKEND_URL}/save-png`, { method: 'POST', body: fd });
      if (saveResp.ok) {
        const saved = await saveResp.json();
        // console.groupCollapsed('[save-png] result');
        // console.log(saved);
        // console.groupEnd();
        savedPngUrl = saved?.url;
      } else {
        const t = await saveResp.text();
        // console.warn('[save-png] failed', saveResp.status, t);
      }
    } catch (e) {
      // console.warn('[save-png] error', e);
    }

    const base64 = await blobToBase64(blob);

    // 根据模式构建不同的请求参数
    const requestBody = mode === 'story' 
      ? {
          base64: base64,   // 后端期望的字段名
          w: frameW,        // 坐标归一化基于裁剪图片尺寸（含边距）
          h: frameH,
          stepText: currentStepText, // 故事模式：当前步骤提示
          mode: 'story',      // 标识这是故事模式
          coords: 'scene',    // 期望后端返回场景坐标（绝对坐标）
          originX: frameX0,
          originY: frameY0,
          frameW,
          frameH,
          algorithm: storyAlgorithm
        }
      : {
          base64: base64,   // 后端期望的字段名
          w: frameW,        // 坐标归一化基于裁剪图片尺寸（含边距）
          h: frameH,
          stepText: currentStepText || 'explore_mode', // 探索模式：使用步骤文本或默认值
          mode: 'explore',    // 标识这是探索模式
          coords: 'scene',    // 期望后端返回场景坐标（绝对坐标）
          originX: frameX0,
          originY: frameY0,
          frameW,
          frameH,
          algorithm: storyAlgorithm
        };

    console.log('🔍 发送分析请求:', {
      base64Length: base64?.length || 0,
      frameW,
      frameH,
      stepText: requestBody.stepText,
      mode: requestBody.mode,
      coords: (requestBody as any).coords,
      origin: { x: (requestBody as any).originX, y: (requestBody as any).originY },
      url: `${BACKEND_URL}/analyze`
    });
    console.log('[DEBUG] analyze requestBody', requestBody);

    // 2) 调用后端分析接口
    let analyze;
    try {
      analyze = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody)
    });
    } catch (e) {
      console.error('❌ 分析请求异常:', e);
      setNotes('网络或 AI 服务暂时不可用，请稍后再试，或再次点击"提示"。');
      setIsNotesOpen(true);
      return;
    }

    if (!analyze.ok) {
      const errorText = await analyze.text();
      console.error('❌ 分析请求失败:', {
        status: analyze.status,
        statusText: analyze.statusText,
        errorText: errorText
      });
      setNotes('AI 服务暂时繁忙，请稍后再试，或再次点击"提示"。');
      setIsNotesOpen(true);
      return;
    }

    const data = await analyze.json();
    console.groupCollapsed('[AI Overlay] response payload');
    console.log('payload', data?.payload);
    try {
      const count = Array.isArray(data?.payload?.elements) ? data.payload.elements.length : 0;
      console.log('payload.elements.count', count);
      console.log('mapping.frame', { frameX0, frameY0, frameW, frameH });
    } catch {}
    try {
      const els = data?.payload?.elements || [];
      const mapped = els.slice(0, 10).map((el: any) => ({
        type: el?.type,
        norm: { x: el?.x_norm, y: el?.y_norm, w: el?.w_norm, h: el?.h_norm },
        scene: {
          x: frameX0 + (el?.x_norm ?? 0) * frameW,
          y: frameY0 + (el?.y_norm ?? 0) * frameH,
          w: (el?.w_norm ?? 0) * frameW,
          h: (el?.h_norm ?? 0) * frameH,
        },
      }));
      console.log('mapped(scene est.) sample<=10', mapped);
    } catch {}
    console.groupEnd();
    // const data = {
    //   "elements": [
    //     {
    //       "type": "text",
    //       "text": "Merged",
    //       "x_norm": 0.0284,
    //       "y_norm": 0.7234,
    //       "style": {
    //         "strokeColor": "#ff0000"
    //       }
    //     },
    //     {
    //       "type": "arrow",
    //       "x_norm": 0.17,
    //       "y_norm": 0.7234,
    //       "end_x_norm": 0.1875,
    //       "end_y_norm": 0.7234,
    //       "style": {
    //         "strokeColor": "#ff0000",
    //         "endArrowhead": "arrow"
    //       }
    //     },
    //     {
    //       "type": "rectangle",
    //       "x_norm": 0.4261,
    //       "y_norm": 0.8596,
    //       "w_norm": 0.1591,
    //       "h_norm": 0.0085,
    //       "style": {
    //         "strokeColor": "#ff0000",
    //         "fillColor": "#ff0000"
    //       }
    //     }
    //   ],
    //   "notes": "Compared heads (1 from list1, 1 from list2). As per instruction, took 1 from list2. 'Merged' pointer now points to list2's node '1'. List2's head pointer (underline) advances to node '3'."
    // }
    let parsed;
    try {
      console.log('payload:', data.payload);
    //   applyGeminiElementsToExcalidraw(excalidrawAPI, data.payload, {
    //   width: frameW,  
    //   height: frameH,
    // },{x: frameX0, 
    //   y: frameY0,});
        // 调试坐标系统
        console.log('🔍 AI绘制坐标调试:', {
          frameW, frameH, frameX0, frameY0,
          payloadElements: data.payload?.elements?.length || 0,
          firstElement: data.payload?.elements?.[0]
        });
        
        // 验证坐标参数
        if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || 
            !Number.isFinite(frameX0) || !Number.isFinite(frameY0)) {
          console.error('❌ 坐标参数无效:', { frameW, frameH, frameX0, frameY0 });
          throw new Error('坐标参数无效，无法绘制AI元素');
        }
        
        // 直接写入画布元素（嵌入到 Excalidraw 场景）
        await applyGeminiElementsToExcalidraw(
          excalidrawAPI,
          data.payload,
          { width: frameW, height: frameH },
          { x: frameX0, y: frameY0 }
        );
        // 写入后立即保存
       saveCurrentScene();
        // 清理任何现有 Ghost
        setAiGhost(null);
        aiGhostActiveRef.current = false;
       
       // 根据模式显示不同的提示信息
       if (mode === 'story') {
         const extra = savedPngUrl ? `\n🖼 已保存: ${savedPngUrl}` : '';
         const aiNote = `🎨 AI绘制完成:\n${data.payload.notes || "暂无说明"}`;
         setNotes(aiNote);
         // 将AI提示保存到当前步骤
         setStepNotes(prev => ({
           ...prev,
           [currentStepIndexRef.current]: aiNote
         }));
       } else {
         const extra = savedPngUrl ? `\n🖼 已保存: ${savedPngUrl}` : '';
         const aiNote = `💡 AI画图提示:\n${data.payload.notes || "暂无提示"}`;
         setNotes(aiNote);
         // 将AI提示保存到当前步骤
         setStepNotes(prev => ({
           ...prev,
           [currentStepIndexRef.current]: aiNote
         }));
       }
       setIsNotesOpen(true);
       // parsed = validateGeminiOverlayResponse(raw);
     } catch (e) {
       console.error('invalid overlay json', e);
       return;
     }
     // // console.log("notes:", data.notes");
  };
    
  // 在当前视口中心插入一个固定大小的矩形（单击即可插入，后续可手动调整）
  const insertFixedRectangle = async () => {
    if (!excalidrawAPI) return;
    try {
      const appState = excalidrawAPI.getAppState();
      const scrollX = (appState && (appState as any).scrollX) || 0;
      const scrollY = (appState && (appState as any).scrollY) || 0;
      const zoom = (appState && ((appState as any).zoom?.value ?? (appState as any).zoom)) || 1;
      // 使用 Excalidraw 画布尺寸（更准确地居中到画布中间，而不是窗口中间）
      const canvasW = ((appState as any).width ?? window.innerWidth) || 1200;
      const canvasH = ((appState as any).height ?? window.innerHeight) || 800;
      const fixedW = 50;
      const fixedH = 50;
      const centerX = scrollX + canvasW / zoom / 2;
      const centerY = scrollY + canvasH / zoom / 2;

      const skeletons = [
        {
          type: 'rectangle',
          x: centerX - fixedW / 2,
          y: centerY - fixedH / 2,
          width: fixedW,
          height: fixedH,
          strokeColor: '#000000',
          backgroundColor: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          roughness: 1,
        },
      ];

      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const newEls = convertToExcalidrawElements(skeletons as any);
      excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements(), ...newEls] });
      // 自动保存新元素
      saveCurrentScene();
    } catch (e) {
      console.error('插入固定矩形失败', e);
    }
  };

  // 在指定场景坐标中心点插入固定大小矩形
  const insertFixedRectangleAt = async (centerX: number, centerY: number) => {
    if (!excalidrawAPI) return;
    try {
      const fixedW = 50;
      const fixedH = 50;
      const skeletons = [
        {
          type: 'rectangle',
          x: centerX - fixedW / 2,
          y: centerY - fixedH / 2,
          width: fixedW,
          height: fixedH,
          strokeColor: '#000000',
          backgroundColor: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          roughness: 1,
        },
      ];
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const newEls = convertToExcalidrawElements(skeletons as any);
      excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements(), ...newEls] });
            // 自动选中新创建的元素并打开属性面板
      // ... existing code ...
      // 自动选中新创建的元素并打开属性面板
      if (newEls.length > 0) {
        const newElementIds = newEls.reduce((acc: any, el: any) => {
          acc[el.id] = true;
          return acc;
        }, {});
        excalidrawAPI.updateScene({
          appState: {
            ...excalidrawAPI.getAppState(),
            selectedElementIds: newElementIds,
            // 打开属性面板
            openMenu: 'shape',
            // 确保选择工具激活
            activeTool: { type: 'selection', lastActiveTool: null, locked: false, customType: null },
          }
        });
      }
// ... existing code ...
      
      saveCurrentScene();
    } catch (e) {
      console.error('插入固定矩形失败', e);
    }
  };

  // 在指定场景坐标中心点插入固定大小椭圆（默认圆形）
  const insertFixedEllipseAt = async (centerX: number, centerY: number) => {
    if (!excalidrawAPI) return;
    try {
      const diameter = 50;
      const skeletons = [
        {
          type: 'ellipse',
          x: centerX - diameter / 2,
          y: centerY - diameter / 2,
          width: diameter,
          height: diameter,
          strokeColor: '#000000',
          backgroundColor: 'transparent',
          strokeWidth: 2,
          strokeStyle: 'solid',
          roughness: 1,
        },
      ];
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const newEls = convertToExcalidrawElements(skeletons as any);
      excalidrawAPI.updateScene({ elements: [...excalidrawAPI.getSceneElements(), ...newEls] });
      // 自动选中新创建的元素并打开属性面板
      if (newEls.length > 0) {
        const newElementIds = newEls.reduce((acc: any, el: any) => {
          acc[el.id] = true;
          return acc;
        }, {});
        excalidrawAPI.updateScene({
          appState: {
            ...excalidrawAPI.getAppState(),
            selectedElementIds: newElementIds,
            // 打开属性面板
            openMenu: 'shape',
            // 确保选择工具激活
            activeTool: { type: 'selection', lastActiveTool: null, locked: false, customType: null },
          }
        });
      }
      saveCurrentScene();
    } catch (e) {
      console.error('插入固定椭圆失败', e);
    }
  };
  
  // 切换 Excalidraw 工具（hand / selection / rectangle / ellipse / arrow / freedraw / text / eraser）
  const setTool = (tool: 'hand' | 'selection' | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'eraser') => {
    if (!excalidrawAPI) return;
    try {
      if (tool === 'freedraw') {
        // 将自由绘制笔触设为 thin
        (excalidrawAPI as any).updateScene?.({
          appState: { currentItemStrokeWidth: 1 } as any,
        });
      } else if (tool === 'arrow' || tool === 'line') {
        // 箭头、连线设为 bold
        (excalidrawAPI as any).updateScene?.({
          appState: { currentItemStrokeWidth: 2 } as any,
        });
      } else if (tool === 'text') {
        // 文字设为 XL 大小，字体为 normal（Helvetica）
        (excalidrawAPI as any).updateScene?.({
          appState: { currentItemFontSize: 36, currentItemFontFamily: 2 } as any,
        });
      }
      (excalidrawAPI as any).setActiveTool?.({ type: tool });
    } catch (e) {
      console.warn('setActiveTool failed', e);
    }
  };
  
  // 素材缩略图组件（基于 exportToBlob 渲染，避免 Worker 跨域问题）
  const LibraryItemThumb = ({ item, thumbId, width = 96, height = 64, onClick }: { item: any; thumbId: string; width?: number; height?: number; onClick: () => void }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          // 如已缓存，直接使用，避免重复生成导致闪烁
          const cached = libraryThumbCache[thumbId];
          if (cached) {
            if (!cancelled) setUrl(cached);
            return;
          }
          const { exportToBlob } = await import('@excalidraw/excalidraw');
          const elements = (item && item.elements) || [];
          if (!elements.length) return;
          const blob = await exportToBlob({
            elements,
            appState: { exportWithDarkMode: false, viewBackgroundColor: '#fff' } as any,
            files: {},
            exportPadding: 8,
          } as any);
          if (cancelled) return;
          const createdUrl = URL.createObjectURL(blob);
          setUrl(createdUrl);
          setLibraryThumbCache(prev => ({ ...prev, [thumbId]: createdUrl }));
        } catch (e) {
          // ignore thumbnail failure
        }
      })();
      return () => { cancelled = true; };
    }, [item, thumbId, libraryThumbCache]);
    return (
      <Box onClick={onClick}
        sx={{
          width,
          height,
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          bgcolor: '#fff',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        {url ? (
          <img src={url} alt={item?.name || 'thumb'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', bgcolor: '#fafafa' }} />
        )}
      </Box>
    );
  };

  // 打开素材库：先切到选择工具，避免左侧面板展开
  const openLibrary = () => {
    if (!excalidrawAPI) return;
    try {
      (excalidrawAPI as any).setActiveTool?.({ type: 'selection' });
      setPendingInsertTool(null);
      // 关闭素材库：不再自动打开
      setShowLibraryBottom(false);
    } catch (e) {
      console.warn('openLibrary failed', e);
    }
  };
    

    
  return (
    <main
      ref={containerRef}
      className="lc-root"
      onMouseMove={(e) => {
        if (!containerRef.current) return;
        // 拖拽中直接显示 col-resize
        if (isResizing) { setNearVResizer(true); }
        const rect = containerRef.current.getBoundingClientRect();
        const dividerX = rect.left + (leftPct / 100) * rect.width;
        const dist = Math.abs(e.clientX - dividerX);
        const threshold = 32; // 垂直分隔线进一步提高容差，适配小圆形光标
        const vHit = dist <= threshold;
        // 右侧上下分隔线接近检测
        if (rightSplitRef.current) {
          const rrect = rightSplitRef.current.getBoundingClientRect();
          const dividerY = rrect.top + (topPct / 100) * rrect.height;
          const distY = Math.abs(e.clientY - dividerY);
          setNearTopResizer(distY <= 16);
        } else {
          setNearTopResizer(false);
        }
        // 左侧底部分隔线接近检测（使用实际分隔线 DOM）
        if (leftColumnRef.current) {
          const lrect = leftColumnRef.current.getBoundingClientRect();
          const dividerY = lrect.bottom - leftAiHeight;
          const distY = Math.abs(e.clientY - dividerY);
          const thresholdH = 48; // 增加左侧底部分隔线的容差
          const insideX = e.clientX >= lrect.left - 16 && e.clientX <= lrect.right + 16; // 增加左侧底部分隔线的水平容差
          setNearLeftAiResizer(distY <= thresholdH && insideX);
        } else {
          setNearLeftAiResizer(false);
        }
        // 距离选择：谁更近就启用谁，避免垂直优先盖过左侧横向
        setNearVResizer(vHit);
        const dV = vHit ? dist : Number.POSITIVE_INFINITY;
        const dTop = (rightSplitRef.current)
          ? Math.abs(e.clientY - (rightSplitRef.current.getBoundingClientRect().top + (topPct / 100) * rightSplitRef.current.getBoundingClientRect().height))
          : Number.POSITIVE_INFINITY;
        const dLeft = (leftColumnRef.current)
          ? Math.abs(e.clientY - (leftColumnRef.current.getBoundingClientRect().bottom - leftAiHeight))
          : Number.POSITIVE_INFINITY;
        // 如果在纵向容差范围内，dLeft 为 0；否则是超出的量
        const hits: Array<{key: 'v'|'top'|'leftAi', dist: number, hit: boolean}> = [
          { key: 'v', dist: dV, hit: vHit },
          { key: 'top', dist: dTop, hit: nearTopResizer },
          { key: 'leftAi', dist: dLeft, hit: nearLeftAiResizer },
        ];
        const active = hits.filter(h => h.hit).sort((a,b) => a.dist - b.dist)[0]?.key ?? null;
        setActiveNear(active);
        // 若用户已按下主键（e.buttons & 1），且尚未进入拖拽，则直接从移动开始拖拽，提高起拖成功率
        if ((e.buttons & 1) && !isResizing && !isTopResizing && !isLeftAiResizing && active) {
          if (active === 'v') setIsResizing(true);
          else if (active === 'top') setIsTopResizing(true);
          else if (active === 'leftAi') setIsLeftAiResizing(true);
        }
      }}
      onPointerMove={(e) => {
        if (!containerRef.current) return;
        if (isResizing) { setNearVResizer(true); }
        const rect = containerRef.current.getBoundingClientRect();
        const dividerX = rect.left + (leftPct / 100) * rect.width;
        const dist = Math.abs(e.clientX - dividerX);
        const threshold = isTablet ? 48 : 32;
        const vHit = dist <= threshold;
        if (rightSplitRef.current) {
          const rrect = rightSplitRef.current.getBoundingClientRect();
          const dividerY = rrect.top + (topPct / 100) * rrect.height;
          const distY = Math.abs(e.clientY - dividerY);
          const topThreshold = isTablet ? 28 : 16;
          setNearTopResizer(distY <= topThreshold);
        } else {
          setNearTopResizer(false);
        }
        if (leftBottomResizerRef.current) {
          const lrect = leftBottomResizerRef.current.getBoundingClientRect();
          const yPad = isTablet ? 28 : 16;
          const xPad = isTablet ? 48 : 32;
          const insideY = e.clientY >= (lrect.top - yPad) && e.clientY <= (lrect.bottom + yPad);
          const insideX = e.clientX >= (lrect.left - xPad) && e.clientX <= (lrect.right + xPad);
          setNearLeftAiResizer(insideY && insideX);
        } else {
          setNearLeftAiResizer(false);
        }
        setNearVResizer(vHit);
        const dV = vHit ? dist : Number.POSITIVE_INFINITY;
        const dTop = (rightSplitRef.current)
          ? Math.abs(e.clientY - (rightSplitRef.current.getBoundingClientRect().top + (topPct / 100) * rightSplitRef.current.getBoundingClientRect().height))
          : Number.POSITIVE_INFINITY;
        const dLeft = (leftBottomResizerRef.current)
          ? Math.max(
              0,
              Math.max((leftBottomResizerRef.current.getBoundingClientRect().top - 16) - e.clientY,
                       e.clientY - (leftBottomResizerRef.current.getBoundingClientRect().bottom + 16))
            )
          : Number.POSITIVE_INFINITY;
        const hits: Array<{key: 'v'|'top'|'leftAi', dist: number, hit: boolean}> = [
          { key: 'v', dist: dV, hit: vHit },
          { key: 'top', dist: dTop, hit: nearTopResizer },
          { key: 'leftAi', dist: dLeft, hit: nearLeftAiResizer },
        ];
        const active = hits.filter(h => h.hit).sort((a,b) => a.dist - b.dist)[0]?.key ?? null;
        setActiveNear(active);
      }}
      onMouseLeave={() => { setNearVResizer(false); setNearTopResizer(false); setNearLeftAiResizer(false); setActiveNear(null); }}
      onPointerLeave={() => { setNearVResizer(false); setNearTopResizer(false); setNearLeftAiResizer(false); setActiveNear(null); }}
      onMouseDown={(e) => {
        // 允许在接近分隔线时，从任何位置开始拖拽
        if (activeNear === 'v') {
          e.preventDefault();
          setIsResizing(true);
        }
        if (activeNear === 'top') {
          e.preventDefault();
          setIsTopResizing(true);
        }
        if (activeNear === 'leftAi') {
          e.preventDefault();
          setIsLeftAiResizing(true);
        }
      }}
      onMouseDownCapture={(e) => {
        // 捕获阶段优先处理，避免子元素（如画布）拦截
        if (activeNear) {
          e.preventDefault();
          e.stopPropagation();
          if (activeNear === 'v') setIsResizing(true);
          else if (activeNear === 'top') setIsTopResizing(true);
          else if (activeNear === 'leftAi') setIsLeftAiResizing(true);
        }
      }}
      onPointerDownCapture={(e) => {
        if (activeNear) {
          e.preventDefault();
          e.stopPropagation();
          if (activeNear === 'v') setIsResizing(true);
          else if (activeNear === 'top') setIsTopResizing(true);
          else if (activeNear === 'leftAi') setIsLeftAiResizing(true);
        }
      }}
      onTouchStartCapture={(e) => {
        if (activeNear) {
          e.preventDefault();
          e.stopPropagation();
          if (activeNear === 'v') setIsResizing(true);
          else if (activeNear === 'top') setIsTopResizing(true);
          else if (activeNear === 'leftAi') setIsLeftAiResizing(true);
        }
      }}
      style={{ display: 'flex', width: '100%', minHeight: '100dvh', height: '100dvh', overflow: 'hidden', position: 'relative', cursor: (
        isResizing ? 'col-resize' as const : (
          activeNear === 'v' ? 'col-resize' as const : (
            activeNear === 'top' ? 'row-resize' as const : (
              activeNear === 'leftAi' ? 'row-resize' as const : undefined
            )
          )
        )
      ) }}
    >
      {/* 顶部全局操作栏（LeetCode风格居中按钮） */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, borderBottom: 1, borderColor: 'divider', bgcolor: '#fff', zIndex: 2000 }}>
        <Box sx={{ position: 'relative', height: '100%' }}>
          {/* 左侧：项目名 */}
          <Box sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#333' }}>SketchMind</Typography>
          </Box>
          {/* 中间操作按钮组 */}
          <Box sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 2, px: 1, py: 0.5, boxShadow: 0 }}>
            <Button
              onClick={handleTopHint}
              disabled={topLoadingHint}
              sx={{ minWidth: 0, color: '#555', textTransform: 'none', '&:hover': { bgcolor: '#eeeeee' } }}
              startIcon={topLoadingHint ? <CircularProgress size={18} /> : <PlayArrow />}
            >
              {zh ? 'AI 画图' : 'AI Draw'}
            </Button>
            <Button
              onClick={handleTopCheck}
              disabled={topLoadingCheck}
              sx={{ minWidth: 0, color: 'success.main', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#e8f5e9' } }}
              startIcon={topLoadingCheck ? <CircularProgress size={18} /> : <CloudUpload sx={{ color: 'success.main' }} />}
            >
              {zh ? '检查步骤' : 'Check Step'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 顶部右侧：语言切换 */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, pointerEvents: 'none', zIndex: 2001 }}>
        <Box sx={{ position: 'relative', height: '100%' }}>
          <Box sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 0.75, pointerEvents: 'auto' }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#666' }}>EN</Typography>
            <Switch
              checked={zh}
              onChange={(_: any, checked: boolean) => {
                if (checked !== zh) setZh(checked);
              }}
              size="small"
              sx={{
                '& .MuiSwitch-thumb': { width: 16, height: 16 },
                '& .MuiSwitch-track': { height: 12, borderRadius: 6 },
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#666' }}>中文</Typography>
          </Box>
        </Box>
      </Box>

      {/* 主体布局容器（顶栏高度占位，防止总高度超过视口） */}
      <Box sx={{ display: 'flex', flex: 1, width: '100%', height: '100%', minHeight: '100%', pt: '56px', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* 问题描述侧拉栏 - 右侧固定标题 */}
      {false && (
      <Box
        sx={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '35%',
          zIndex: 1000,
          display: 'flex',
        }}
      >
        {/* 问题内容面板 */}
        <Box
          sx={{
            width: 400,
            height: '100%',
            bgcolor: 'white',
            borderLeft: 1,
            borderColor: 'divider',
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
            transform: isProblemExpanded ? 'translateX(0)' : 'translateX(400px)',
            transition: 'transform 0.3s ease-in-out',
      
          }}
        >
          {/* 问题内容 */}
          <Box sx={{ p: 1.5, overflow: 'auto', flex: 1 ,'&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.1)' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(165, 175, 76, 0.3)', borderRadius: '2px' },
}}>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#8b7355' }}>
                {zh ? '📋 合并有序链表' : '📋 Merge Two Sorted Lists'}
              </Typography>
            
            
          
                <Typography variant="body1" sx={{ lineHeight: 1.6, mb: 2 }}>
                  {zh 
                    ? '给定两个有序链表的头节点 list1 和 list2。将这两个链表合并为一个有序链表。合并后的链表应通过将两个链表的节点拼接在一起形成。返回合并后的链表的头节点。'
                    : 'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.'
                  }
                </Typography>
           

                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                  {zh ? ' 示例' : 'Example'}
                </Typography>
            
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
                    {zh 
                      ? '输入：list1 = [1,2,4],\n list2 = [1,3,4]'
                      : 'Input: list1 = [1,2,4],\n list2 = [1,3,4]'
                    }
                  </Typography>
               
            

           
          </Box>
        </Box>

        {/* 问题标题 - 固定在右侧边缘，带折叠符号 */}
        <Box
          sx={{
            width: 50,
            height: '100%',
            bgcolor: '#d4c4a8',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: '#b8a082' },
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            boxShadow: 2,
            position: 'relative',
          }}
          onClick={() => setIsProblemExpanded(!isProblemExpanded)}
        >
          {/* 折叠符号 */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconButton 
              size="small" 
              sx={{ 
                color: 'white',
                p: 0.5,
                minWidth: 20,
                minHeight: 20,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsProblemExpanded(!isProblemExpanded);
              }}
            >
              {isProblemExpanded ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </IconButton>
          </Box>
          
          {/* 标题文字 */}
                      <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                fontSize: '1.2rem',
                textAlign: 'center',
              }}
            >
              {zh ? '问题描述' : 'Problem'}
            </Typography>
        </Box>
      </Box>
      )}

      {/* 算法描述侧拉栏 - 右侧固定标题 */}
      {false && (
      <Box
        sx={{
          position: 'fixed',
          right: 0,
          top: '35%',
          height: '65%',
          zIndex: 1002,
          display: 'flex',
        }}
      >
        {/* 算法内容面板 */}
        <Box
          sx={{
            width: 280,
            height: '100%',
            bgcolor: 'white',
            borderLeft: 1,
            borderColor: 'divider',
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
            transform: isAlgorithmExpanded ? 'translateX(0)' : 'translateX(280px)',
            transition: 'transform 0.3s ease-in-out',
          }}
        >
          {/* 算法内容 */}
          <Box sx={{ p: 1.5, overflow: 'auto', flex: 1,'&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.1)' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(76, 175, 80, 0.3)', borderRadius: '2px' },
 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#6b7c32' }}>
              {zh ? '✅ 递归算法' : '✅ Recursion Algorithm'}
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                {zh ? '直觉' : 'Intuition'}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 2 }}>
                {zh 
                  ? '我们可以递归地定义两个链表的合并操作结果如下（避免处理空链表的特殊情况）：'
                  : 'We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):'
                }
              </Typography>
              
              <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 2, border: '1px solid #e0e0e0' }}>
      <Typography
        component="pre"
        variant="body2"
        sx={{ fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap', m: 0 }}
      >
        {zh
          ? 'list1[0] + merge(list1[1:], list2)  if list1[0] < list2[0]\nlist2[0] + merge(list1, list2[1:])  otherwise'
          : 'list1[0] + merge(list1[1:], list2)  if list1[0] < list2[0]\nlist2[0] + merge(list1, list2[1:])  otherwise'}
      </Typography>
    </Box>

              
              <Typography variant="body2" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                {zh 
                  ? '即较小的链表头节点加上对剩余元素的合并结果。'
                  : 'Namely, the smaller of the two lists\' heads plus the result of a merge on the rest of the elements.'
                }
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                {zh ? '算法' : 'Algorithm'}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                {zh 
                  ? '我们直接模拟上述递归过程，首先处理边界情况。具体来说，如果 l1 或 l2 中的任意一个最初为 null，则无需合并，直接返回非空链表即可。否则，我们确定 l1 和 l2 中哪个头节点较小，并递归地将其 next 值设置为下一次合并的结果。鉴于两个链表均以 null 结尾，递归最终会终止。'
                  : 'We model the above recurrence directly, first accounting for edge cases. Specifically, if either of l1 or l2 is initially null, there is no merge to perform, so we simply return the non-null list. Otherwise, we determine which of l1 and l2 has a smaller head, and recursively set the next value for that head to the next merge result. Given that both lists are null-terminated, the recursion will eventually terminate.'
                }
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 算法标题 - 固定在右侧边缘，带折叠符号 */}
        <Box
          sx={{
            width: 50,
            height: '100%',
            bgcolor: '#a8b896',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: '#8fa67b' },
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            boxShadow: 2,
            position: 'relative',
            
            zIndex: 1003, // 确保标题栏在最上层
          }}
          onClick={() => {
            console.log('算法标题被点击，当前状态:', isAlgorithmExpanded);
            setIsAlgorithmExpanded(!isAlgorithmExpanded);
          }}
        >
          {/* 折叠符号 */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconButton 
              size="small" 
              sx={{ 
                color: 'white',
                p: 0.5,
                minWidth: 20,
                minHeight: 20,
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log('算法折叠按钮被点击，当前状态:', isAlgorithmExpanded);
                setIsAlgorithmExpanded(!isAlgorithmExpanded);
              }}
            >
              {isAlgorithmExpanded ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </IconButton>
          </Box>
          
          {/* 标题文字 */}
                      <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                fontSize: '1.2rem',
                textAlign: 'center',
              }}
            >
              {zh ? '递归算法' : 'Algorithm'}
            </Typography>
        </Box>
      </Box>
      )}
      {/* 主页面布局 - LeetCode风格左右分栏 */}
      <div
        className="lc-left"
        style={{ width: `${leftPct}%`, minWidth: 0, position: 'relative', height: '100%', display: 'flex' }}
      >
      {/* 左侧导航栏 */}
      <Box
        sx={{
          width: isNavCollapsed ? 0 : 80,
          bgcolor: 'background.paper',
          borderRight: isNavCollapsed ? 0 : 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 2,
          transition: 'width 0.3s ease, border-right 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
            zIndex: 1001, // 确保在侧拉栏之上
        }}
      >
        {/* 收起/展开按钮 */}
        <IconButton
          onClick={() => setIsNavCollapsed(!isNavCollapsed)}
          sx={{
            position: 'fixed',
            left: isNavCollapsed ? 8 : 72,
            top: 20,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 2,
            zIndex: 1000,
            width: 32,
            height: 32,
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          {isNavCollapsed ? <NextIcon /> : <NextIcon sx={{ transform: 'rotate(180deg)' }} />}
        </IconButton>
      
                <Box sx={{ flex: 1, p: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* 演示按钮 */}
            <Button
              variant="contained"
              fullWidth
              sx={{
                py: 1,
                fontSize: '0.875rem',
                fontWeight: 'bold',
                opacity: isNavCollapsed ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {zh ? '演示' : 'Warm up'}
            </Button>
            
            {/* <Box
              sx={{
                height: 1,
                bgcolor: 'divider',
                my: 1,
                opacity: isNavCollapsed ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}
            /> */}
            
            
              {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                递归
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/recursive/animation'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  动画
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/recursive/drawing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  画图
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/recursive/testing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  测试
                </Button>
              </Box>
            </Box> */}

            {/* 组2 */}
            {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                迭代
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/iterative/animation'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  动画
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/iterative/drawing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  画图 
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/iterative/testing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  测试
                </Button>
              </Box>
            </Box> */}

  {/* 组2 */}
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {zh ? '贪心' : 'Greed'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/greed/animation'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {zh ? '动画' : 'Animation'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/greed/drawing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {zh ? '画图' : 'SketchMind'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => window.location.href = '/greed/testing'}
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {zh ? '测试' : 'Post task'}
                </Button>
              </Box>
            </Box>
            {/* 组3 */}
            {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                组3
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  C1D2
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  C2D1
                </Button>
              </Box>
            </Box> */}

            {/* 组4 */}
            {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                组4
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  C2D1
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  C1D2
                </Button>
              </Box>
            </Box> */}
        </Box>
      </Box>

        {/* 翻译功能（已移动到顶部左侧） */}
        {false && (
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }} />
        )}
      </Box>

        {/* 画布区域 + 左侧底部 AI 结果栏 */}
        <div 
          className="flex-1"
          ref={leftColumnRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            borderRight: '1px solid #eee',
            background: '#fff',
          }}
        >
          {/* 顶部自定义工具栏（移除占位，改为覆盖在遮挡条之上） */}
          {false && <Box />}

          {/* 画布内容区域 */}
          <div
            className="bg-white relative w-full"
        ref={rightPaneRef}
        style={{
          touchAction: 'none',           // 禁用浏览器默认触控手势，稳定手写
          overscrollBehavior: 'contain', // 阻止 iOS 橡皮筋滚动影响布局
          overflow: 'hidden',            // 避免绘制时容器产生滚动条
          contain: 'layout paint',       // 限定重绘范围，减少抖动
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >

        {/* 顶部统一遮挡条（避免原生控件残影；不拦截鼠标） */}
        {/* <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 120,
            bgcolor: '#fff',
            zIndex: 25,
            pointerEvents: 'none',
          }}
        /> */}

        {/* 覆盖在遮挡条之上的工具栏（不占用内容高度） */}
        {/* <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 26,
            display: 'flex',
            alignItems: 'center',
            gap: isTablet ? 1.5 : 1.25,
            bgcolor: 'rgba(255,255,255,0.98)',
            // border: '1px solid #e0e0e0',
            borderRadius: 2,
            px: isTablet ? 1.25 : 1,
            py: isTablet ? 0.75 : 0.5,
            // 提升触控命中区域（只影响本工具条内的 IconButton）
            '& .MuiIconButton-root': {
              minWidth: isTablet ? 44 : 36,
              minHeight: isTablet ? 44 : 36,
            },
          }}
        >
          <Tooltip title={t.toolbar_mode}>
            <IconButton size="medium" onClick={() => setIsModeDialogOpen(true)} sx={{ color: 'rgb(84, 83, 84)' }}>
              <TuneIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_move}>
            <IconButton size="medium" onClick={() => setTool('hand')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <PanToolIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_select}>
            <IconButton size="medium" onClick={() => setTool('selection')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <NavigationIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_rect}>
            <IconButton size="medium" onClick={() => setPendingInsertTool('rectangle')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CropSquareIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_ellipse}>
            <IconButton size="medium" onClick={() => setPendingInsertTool('ellipse')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CircleOutlinedIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_arrow}>
            <IconButton size="medium" onClick={() => setTool('arrow')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <ArrowRightAltIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_line}>
            <IconButton size="medium" onClick={() => setTool('line')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <HorizontalRuleIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_draw}>
            <IconButton size="medium" onClick={() => setTool('freedraw')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CreateIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_text}>
            <IconButton size="medium" onClick={() => setTool('text')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <TextFieldsIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_eraser}>
            <IconButton size="medium" onClick={() => setTool('eraser')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <EraserIcon sx={{ fontSize: '36px', position: 'relative', top: -2 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.toolbar_library}>
            <IconButton size="medium" onClick={openLibrary} sx={{ color: 'rgb(84, 83, 84)' }}>
              <SchemaIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
        </Box> */}

        {/* 面板折叠时的展开指示器 - 放在左下角，不挡住导航栏 */}
        {isLeftPanelCollapsed && (
          <Box
            sx={{
              position: 'fixed',
              left: 16,
              bottom: 64,
              zIndex: 1000,
            }}
          >
            <Tooltip title="展开侧边栏" placement="right">
              <IconButton
                onClick={() => setIsLeftPanelCollapsed(false)}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { 
                    bgcolor: 'primary.dark',
                    transform: 'scale(1.1)',
                    boxShadow: 4,
                  },
                  boxShadow: 3,
                  width: 56,
                  height: 56,
                  fontSize: '1.5rem',
                  border: '3px solid white',
                  transition: 'all 0.2s ease-in-out',
                  // 触摸设备优化
                  minWidth: 56,
                  minHeight: 56,
                }}
              >
                <ChevronRight />
              </IconButton>
            </Tooltip>
            
            {/* 小提示文字 */}
            <Box
              sx={{
                position: 'absolute',
                left: 70,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                opacity: 0.9,
                pointerEvents: 'none',
              }}
            >
              展开
            </Box>
          </Box>
        )}

      {/* 右栏悬浮按钮组 */}
        <Box
          position="absolute"
          top={19}
          left={isLeftPanelCollapsed ? 300 : 280}            // 根据左侧面板状态调整位置
          zIndex={10}
          bgcolor="rgba(255,255,255,0.9)"
          borderRadius={1}
          // boxShadow={1}
          display="flex"
          gap={1}
          sx={{
            transition: 'left 0.3s ease-in-out',
          }}
        >
          {/* <Tooltip title="Check (save this step)">
            <IconButton color="primary" onClick={onCheck}>
              <CheckIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next Draw (overlay from backend)">
            <IconButton color="success" onClick={onNextDraw}>
              <Lightbulb />
            </IconButton>
          </Tooltip> */}
          {/* <Tooltip title="Insert fixed rectangle">
            <IconButton color="inherit" onClick={insertFixedRectangle}>
              <CropSquareIcon />
            </IconButton>
          </Tooltip> */}
        </Box>

        {/* 覆盖 Excalidraw 左侧原生导航（工具栏）
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 88,
            height: '100%',
            bgcolor: '#fff',
            zIndex: 20,
            pointerEvents: 'auto', // 阻止点击到原生导航
          }}
        /> */}

        {/* 遮挡物已移除，避免滚动画布时遮住用户图形 */}
        {false && (
          <Box sx={{ position: 'absolute' }} />
        )}

        {false && (
          <Box sx={{ position: 'absolute' }} />
        )}

        {false && !isLeftPanelCollapsed && (
          <Box sx={{ position: 'absolute' }} />
        )}

        {/* 覆盖 Excalidraw 顶部中间原生工具栏 */}
        {/* <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '70%',
            height: 64,
            bgcolor: '#fff',
            zIndex: 20,
            pointerEvents: 'auto',
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}
        /> */}
        {false && (
          <Box sx={{ position: 'absolute' }} />
        )}
        {/* 自定义简化工具栏（已迁移到画布上方固定栏） */}
        {false && (
          <Box />
        )}

        {/* 画布上方固定工具栏（已移除：使用左列顶部固定栏） */}
        {false && <Box />}

        {/* 模式选择弹窗（美观卡片样式） */}
        <Modal 
          open={isModeDialogOpen} 
          onClose={() => setIsModeDialogOpen(false)}
          sx={{ zIndex: 12000 }}
          BackdropProps={{ sx: { zIndex: 11990, backgroundColor: 'rgba(0,0,0,0.45)' } }}
          slotProps={{ backdrop: { sx: { zIndex: 11990, backgroundColor: 'rgba(0,0,0,0.45)' } } } as any}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: '#fff',
              borderRadius: 3,
              boxShadow: 10,
              p: 3,
              minWidth: 560,
              zIndex: 12010,
              pointerEvents: 'auto',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}>选择模式</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box
                onClick={() => changeMode('story')}
                sx={{
                  p: 2,
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 3, borderColor: '#cfcfcf', transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Book sx={{ fontSize: 28, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={600}>故事模式</Typography>
        </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  按步骤完成链表题目，AI 提示与检查随时辅助。
                </Typography>
              </Box>
              <Box
                onClick={() => changeMode('explore')}
                sx={{
                  p: 2,
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 3, borderColor: '#cfcfcf', transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Explore sx={{ fontSize: 28, color: 'secondary.main' }} />
                  <Typography variant="subtitle1" fontWeight={600}>探索模式</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  自由绘画，随时获取 AI 提示与检查。
                </Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="outlined" size="small" onClick={() => setIsModeDialogOpen(false)}>关闭</Button>
            </Box>
          </Box>
        </Modal>

        {/* 嵌入自定义 Canvas 画布 */}
        <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
          <iframe
            src="/canvas"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            title="SketchMind Canvas"
          />
        </Box>

        {/* Guides Overlay: shake boxes and glow pointers (non-interactive) */}
        <Box
          sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}
        >
          {guides.map(g => (
            <Box
              key={`${g.id}-${g.type}`}
              className={g.type === 'shake' || g.type === 'both' ? 'guide-shake' : undefined}
              sx={{
                position: 'absolute',
                left: g.screenX,
                top: g.screenY,
                width: g.screenW,
                height: g.screenH,
                border: g.type === 'shake' || g.type === 'both' ? '2px dashed rgba(255,0,0,.9)' : 'none',
                borderRadius: 2,
              }}
            >
              {(g.type === 'glow' || g.type === 'both') && (
                <Box sx={{ position: 'absolute', left: g.dotX, top: g.dotY }}>
                  <div className="guide-glow-dot" />
                  <div className="guide-glow-ring" />
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* 画布点击插入覆盖层：仅在待插入模式开启时显示 */}
        {pendingInsertTool === 'rectangle' && (
          <Box
            onClick={async (e) => {
              if (!excalidrawAPI) return;
              try {
                const appState = excalidrawAPI.getAppState();
                const scrollX = (appState && (appState as any).scrollX) || 0;
                const scrollY = (appState && (appState as any).scrollY) || 0;
                const zoom = (appState && ((appState as any).zoom?.value ?? (appState as any).zoom)) || 1;
                const rect = rightPaneRef.current?.getBoundingClientRect();
                if (!rect) return;
                const clientX = (e as any).clientX as number;
                const clientY = (e as any).clientY as number;
                const sceneX = scrollX + (clientX - rect.left) / zoom;
                const sceneY = scrollY + (clientY - rect.top) / zoom;
                await insertFixedRectangleAt(sceneX, sceneY);
              } finally {
                setPendingInsertTool(null);
                setInsertGhost(null);
                // 插入后切回选择工具
                (excalidrawAPI as any).setActiveTool?.({ type: 'selection' });
              }
            }}
            onMouseMove={(e) => {
              if (!excalidrawAPI) return;
              const appState = excalidrawAPI.getAppState();
              const zoom = (appState && ((appState as any).zoom?.value ?? (appState as any).zoom)) || 1;
              const rect = rightPaneRef.current?.getBoundingClientRect();
              if (!rect) return;
              const clientX = (e as any).clientX as number;
              const clientY = (e as any).clientY as number;
              setInsertGhost({ x: clientX - rect.left, y: clientY - rect.top, zoom });
            }}
            onMouseLeave={() => setInsertGhost(null)}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              cursor: 'crosshair',
              background: 'transparent',
            }}
          />
        )}

        {/* Ghost 预览矩形（仅在 pendingInsertTool=rectangle 时显示） */}
        {pendingInsertTool === 'rectangle' && insertGhost && (
          <Box
            sx={{
              position: 'absolute',
              zIndex: 41,
              pointerEvents: 'none',
              border: '2px dashed #666',
              backgroundColor: 'rgba(0,0,0,0.02)',
              top: insertGhost.y - (50 * insertGhost.zoom) / 2,
              left: insertGhost.x - (50 * insertGhost.zoom) / 2,
              width: 50 * insertGhost.zoom,
              height: 50 * insertGhost.zoom,
              borderRadius: 2,
            }}
          />
        )}

        {/* 画布点击插入覆盖层：椭圆（默认圆形） */}
        {pendingInsertTool === 'ellipse' && (
          <Box
            onClick={async (e) => {
              if (!excalidrawAPI) return;
              try {
                const appState = excalidrawAPI.getAppState();
                const scrollX = (appState && (appState as any).scrollX) || 0;
                const scrollY = (appState && (appState as any).scrollY) || 0;
                const zoom = (appState && ((appState as any).zoom?.value ?? (appState as any).zoom)) || 1;
                const rect = rightPaneRef.current?.getBoundingClientRect();
                if (!rect) return;
                const clientX = (e as any).clientX as number;
                const clientY = (e as any).clientY as number;
                const sceneX = scrollX + (clientX - rect.left) / zoom;
                const sceneY = scrollY + (clientY - rect.top) / zoom;
                await insertFixedEllipseAt(sceneX, sceneY);
              } finally {
                setPendingInsertTool(null);
                setInsertGhost(null);
                // 插入后切回选择工具
                (excalidrawAPI as any).setActiveTool?.({ type: 'selection' });
              }
            }}
            onMouseMove={(e) => {
              if (!excalidrawAPI) return;
              const appState = excalidrawAPI.getAppState();
              const zoom = (appState && ((appState as any).zoom?.value ?? (appState as any).zoom)) || 1;
              const rect = rightPaneRef.current?.getBoundingClientRect();
              if (!rect) return;
              const clientX = (e as any).clientX as number;
              const clientY = (e as any).clientY as number;
              setInsertGhost({ x: clientX - rect.left, y: clientY - rect.top, zoom });
            }}
            onMouseLeave={() => setInsertGhost(null)}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              cursor: 'crosshair',
              background: 'transparent',
            }}
          />
        )}

        {/* Ghost 预览圆形（仅在 pendingInsertTool=ellipse 时显示） */}
        {pendingInsertTool === 'ellipse' && insertGhost && (
          <Box
            sx={{
              position: 'absolute',
              zIndex: 41,
              pointerEvents: 'none',
              border: '2px dashed #666',
              backgroundColor: 'rgba(0,0,0,0.02)',
              top: insertGhost.y - (50 * insertGhost.zoom) / 2,
              left: insertGhost.x - (50 * insertGhost.zoom) / 2,
              width: 50 * insertGhost.zoom,
              height: 50 * insertGhost.zoom,
              borderRadius: '50%',
            }}
          />
        )}

        {/* 底部素材库面板（已移除渲染） */}
        {/* 库项点击后在画布点击位置插入（已禁用） */}
        {/* Ghost 预览素材（已禁用） */}
        {/* <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} /> */}

        {/* 自定义鼠标光标环已移除 */}

        {/* 调试信息显示 */}
        {/* <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 2,
            py: 1,
            fontSize: '0.75rem',
            color: 'text.secondary',
            zIndex: 100,
            opacity: 0.8,
            maxWidth: 350,
          }}
        > */}
          {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box>🔍 调试信息</Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              模式: {mode} | 步骤: {mode === 'story' ? currentStepIndex + 1 : '探索'}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              故事模式场景数: {Object.keys(scenes).length}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              当前步骤: {currentStepIndexRef.current + 1}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              当前步骤元素数: {scenes[currentStepIndexRef.current]?.elements?.length || 0}
          </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              探索模式元素数: {exploreModeCanvas.elements.length}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              当前画布元素数: {excalidrawAPI?.getSceneElements()?.length || 0}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              最后保存模式: {debugInfo.lastSavedMode}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              最后保存步骤: {debugInfo.lastSavedStoryStep}
            </Box>
            <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              最后保存探索元素: {debugInfo.lastSavedExploreElements}
            </Box>
          </Box> */}
        {/* </Box> */}
        
        {/* 移动设备提示 */}
        {/* {(isMobile || isTablet) && (
          <Box
            sx={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'warning.light',
              color: 'warning.contrastText',
              p: 2,
              borderRadius: 2,
              zIndex: 1000,
              textAlign: 'center',
              maxWidth: '90vw',
              boxShadow: 3,
              // 移动设备特定样式
              ...(isTablet && {
                fontSize: '1.1rem',
                p: 3,
                maxWidth: '80vw',
              }),
              ...(isMobile && {
                fontSize: '0.9rem',
                p: 1.5,
                maxWidth: '95vw',
              }),
            }}
          >
            <Typography variant="h6" gutterBottom>
              📱 移动设备提示
            </Typography>
            <Typography variant="body2">
              {isTablet ? 'iPad' : '手机'} 用户请注意：
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              • 白板功能在触摸设备上可能有限制
            </Typography>
            <Typography variant="body2">
              • 建议使用手指或触控笔进行绘制
            </Typography>
            <Typography variant="body2">
              • 如果遇到问题，请尝试刷新页面
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => window.location.reload()}
              sx={{ mt: 2 }}
            >
              刷新页面
            </Button>
          </Box>
        )} */}

        {/* 画布区域内不再渲染 StoryPlayer；仅在探索模式渲染 ExploreMode */}
        {/* ExploreMode 面板已移除，不再在探索模式中显示 */}

        

        {/* AI 新增元素闪烁动画层（仅显示 1.2s） */}
        {aiFlash && excalidrawAPI && (
          <Box
            sx={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 42, pointerEvents: 'none',
              '@keyframes aiPulse': {
                '0%': { opacity: 0, transform: 'scale(0.98)' },
                '15%': { opacity: 1, transform: 'scale(1)' },
                '100%': { opacity: 0, transform: 'scale(1)' },
              },
            }}
          >
            {(() => {
              const app = excalidrawAPI.getAppState?.() as any;
              const scrollX = (app && app.scrollX) || 0;
              const scrollY = (app && app.scrollY) || 0;
              const zoom = (app && (app.zoom?.value ?? app.zoom)) || 1;
              const { width, height } = aiFlash.canvas;
              const { x: offX, y: offY } = aiFlash.offset;
              const toScene = (xn: number, yn: number) => ({ x: offX + xn * width, y: offY + yn * height });
              const bbox = {
                top: (offY - scrollY) * zoom,
                left: (offX - scrollX) * zoom,
                width: width * zoom,
                height: height * zoom,
              };
              return (
                <svg
                  width={bbox.width}
                  height={bbox.height}
                  viewBox={`0 0 ${width} ${height}`}
                  style={{ position: 'absolute', top: bbox.top, left: bbox.left, filter: 'drop-shadow(0 0 6px rgba(0,200,0,0.6))', animation: 'aiPulse 1200ms ease-out both' }}
                >
                  <defs>
                    <marker id="ai-flash-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L10,5 L0,10 z" fill="#00c853" />
                    </marker>
                  </defs>
                  {aiFlash.elements.map((el: any, idx: number) => {
                    const stroke = el?.style?.strokeColor || '#00c853';
                    const fill = el?.style?.fillColor && el.style.fillColor !== 'transparent' ? el.style.fillColor : 'none';
                    const sw = Math.max(2, (el?.style?.strokeWidth ?? 2) + 1);
                    const dash = el?.style?.strokeStyle === 'dashed' ? '6,4' : el?.style?.strokeStyle === 'dotted' ? '2,4' : undefined;
                    if (el.type === 'rectangle' || el.type === 'image') {
                      const p = toScene(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      return <rect key={idx} x={p.x - offX} y={p.y - offY} width={w} height={h} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'ellipse') {
                      const p = toScene(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      return <ellipse key={idx} cx={p.x - offX + w / 2} cy={p.y - offY + h / 2} rx={w / 2} ry={h / 2} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'diamond') {
                      const p = toScene(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      const pts = [
                        [p.x - offX + w / 2, p.y - offY],
                        [p.x - offX + w, p.y - offY + h / 2],
                        [p.x - offX + w / 2, p.y - offY + h],
                        [p.x - offX, p.y - offY + h / 2],
                      ];
                      return <polygon key={idx} points={pts.map(p => p.join(',')).join(' ')} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'arrow') {
                      const s = toScene(el.x_norm, el.y_norm);
                      const e = toScene(el.end_x_norm, el.end_y_norm);
                      return <line key={idx} x1={s.x - offX} y1={s.y - offY} x2={e.x - offX} y2={e.y - offY} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} markerEnd="url(#ai-flash-arrow)" />;
                    }
                    if (el.type === 'line' || el.type === 'draw') {
                      const pts = (el.points || []).map((pt: any) => {
                        const p = toScene(pt.x_norm, pt.y_norm);
                        return `${p.x - offX},${p.y - offY}`;
                      }).join(' ');
                      return <polyline key={idx} points={pts} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'text') {
                      const p = toScene(el.x_norm, el.y_norm);
                      return <text key={idx} x={p.x - offX} y={p.y - offY} fontSize={(el.fontSize ?? 20)} fill={stroke} opacity={0.9}>{el.text}</text>;
                    }
                    return null;
                  })}
                </svg>
              );
            })()}
          </Box>
         )}

         {/* AI Ghost 叠加层（持久显示，直到用户开始绘制或切换） */}
         {aiGhost && excalidrawAPI && (
          <Box
            sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 41, pointerEvents: 'none' }}
          >
            {(() => {
              const { width, height } = aiGhost.canvas;
              const bbox = { top: 12, left: 12, width, height };
              const toLocal = (xn: number, yn: number) => ({ x: xn * width, y: yn * height });
              return (
                <svg
                  width={bbox.width}
                  height={bbox.height}
                  viewBox={`0 0 ${width} ${height}`}
                  style={{ position: 'absolute', top: bbox.top, left: bbox.left, opacity: 0.5 }}
                >
                  <defs>
                    <marker id="ai-ghost-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L10,5 L0,10 z" fill="#00c853" />
                    </marker>
                  </defs>
                  {aiGhost.elements.map((el: any, idx: number) => {
                    const stroke = el?.style?.strokeColor || '#00c853';
                    const fill = el?.style?.fillColor && el.style.fillColor !== 'transparent' ? el.style.fillColor : 'none';
                    const sw = Math.max(2, (el?.style?.strokeWidth ?? 2));
                    const dash = '6,4';
                    if (el.type === 'rectangle' || el.type === 'image') {
                      const p = toLocal(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      return <rect key={idx} x={p.x} y={p.y} width={w} height={h} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'ellipse') {
                      const p = toLocal(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      return <ellipse key={idx} cx={p.x + w / 2} cy={p.y + h / 2} rx={w / 2} ry={h / 2} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'diamond') {
                      const p = toLocal(el.x_norm, el.y_norm);
                      const w = Math.max(1, el.w_norm * width);
                      const h = Math.max(1, el.h_norm * height);
                      const pts = [
                        [p.x + w / 2, p.y],
                        [p.x + w, p.y + h / 2],
                        [p.x + w / 2, p.y + h],
                        [p.x, p.y + h / 2],
                      ];
                      return <polygon key={idx} points={pts.map(pt => pt.join(',')).join(' ')} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'arrow') {
                      const s = toLocal(el.x_norm, el.y_norm);
                      const e = toLocal(el.end_x_norm, el.end_y_norm);
                      return <line key={idx} x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} markerEnd="url(#ai-ghost-arrow)" />;
                    }
                    if (el.type === 'line' || el.type === 'draw') {
                      const pts = (el.points || []).map((pt: any) => {
                        const p = toLocal(pt.x_norm, pt.y_norm);
                        return `${p.x},${p.y}`;
                      }).join(' ');
                      return <polyline key={idx} points={pts} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
                    }
                    if (el.type === 'text') {
                      const p = toLocal(el.x_norm, el.y_norm);
                      return <text key={idx} x={p.x} y={p.y} fontSize={(el.fontSize ?? 20)} fill={stroke} opacity={0.9}>{el.text}</text>;
                    }
                    return null;
                  })}
                </svg>
              );
            })()}
          </Box>
         )}



        {/* {excalidrawAPI && (
          <StoryPlayer
            steps={steps}
            excalidrawAPI={excalidrawAPI}
            onStepChange={(stepText, index) => {
              setCurrentStepText(stepText);
              setCurrentStepIndex(index);
              // 加载保存的步骤内容
              const savedStep = savedSteps.find(step => step.index === index);
              if (savedStep) {
                excalidrawAPI.updateScene({
                  elements: Array.from(savedStep.elements) as any[],
                  files: savedStep.files,
                });
              }
            }}
          />
        )} */}
          </div>

          {/* 左侧底部分割线（可拖拽） */}
          <div
            className="lc-left-bottom-resizer"
            ref={leftBottomResizerRef}
            onMouseDown={(e) => { e.preventDefault(); setIsLeftAiResizing(true); }}
            onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as any).setPointerCapture?.((e as any).pointerId); setIsLeftAiResizing(true); }}
            onPointerMove={(e) => {
              if (!isLeftAiResizing || !leftColumnRef.current) return;
              const rect = leftColumnRef.current.getBoundingClientRect();
              const newHeight = Math.round(rect.bottom - e.clientY);
              const clamped = Math.max(80, Math.min(400, newHeight));
              setLeftAiHeight(clamped);
            }}
            onPointerUp={(e) => { (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId); setIsLeftAiResizing(false); }}
            onTouchStart={(e) => { e.preventDefault(); setIsLeftAiResizing(true); }}
            onTouchMove={(e) => {
              if (!isLeftAiResizing || !leftColumnRef.current) return;
              e.preventDefault();
              const rect = leftColumnRef.current.getBoundingClientRect();
              const touch = e.touches && e.touches[0];
              if (!touch) return;
              const newHeight = Math.round(rect.bottom - touch.clientY);
              const clamped = Math.max(80, Math.min(400, newHeight));
              setLeftAiHeight(clamped);
            }}
            onTouchEnd={() => setIsLeftAiResizing(false)}
            style={{ height: 8, cursor: 'row-resize', background: '#fff', width: '100%', touchAction: 'none', position: 'relative', zIndex: 1400, userSelect: 'none', boxShadow: 'inset 0 1px 0 #ddd, inset 0 -1px 0 #ddd', pointerEvents: isModeDialogOpen ? 'none' : 'auto' }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 3px)',
                columnGap: 2,
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ccc' }} />
              ))}
            </div>
          </div>

          {/* 左侧底部分割线的“隐形命中区”（绝对定位，不改变样式） */}
          <div
            aria-hidden
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsLeftAiResizing(true); }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsLeftAiResizing(true); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsLeftAiResizing(true); }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: `${leftAiHeight}px`, transform: 'translateY(28px)', height: 56, background: 'transparent', cursor: 'row-resize', zIndex: 9000, pointerEvents: isModeDialogOpen ? 'none' : 'auto' }}
          />
          {/* 左侧底部 AI 结果栏 */}
          <Box sx={{ flex: '0 0 auto', height: `${leftAiHeight}px`, borderTop: 1, borderColor: 'divider', bgcolor: '#fafafa', p: 1.25, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{zh ? '提示' : 'Feedback'}</Typography>
              {stepChecks[currentStepIndex] && (
                <Box component="span" sx={{ fontSize: 12, color: stepChecks[currentStepIndex].isValid ? 'success.main' : 'error.main', border: '1px solid', borderColor: stepChecks[currentStepIndex].isValid ? 'success.light' : 'error.light', px: 0.75, py: 0.25, borderRadius: 1 }}>
                  {stepChecks[currentStepIndex].isValid ? (zh ? '检查：✅' : 'Check: ✅') : (zh ? '检查：❌' : 'Check: ❌')}
                </Box>
              )}
            </Box>
            {checkMsg && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {checkMsg}
              </Typography>
            )}
            {displayNote ? (
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: isErrorNote ? '#f7f7f7' : '#fff3e0', border: '1px solid', borderColor: isErrorNote ? '#e0e0e0' : '#ffb74d' }}>
                <Typography variant="body2" whiteSpace="pre-line" sx={{ color: isErrorNote ? 'text.secondary' : 'text.primary', fontSize: '0.875rem' }}>
                  {displayNote}
                </Typography>
              </Box>
            ) : (
              (() => {
                if (!isClient) {
                  return <Typography variant="caption" color="text.secondary">{zh ? '暂无提示' : 'No hints yet'}</Typography>;
                }
                if (currentScaffoldingMode === 'High') {
                  if (hasSelectionError) {
                    return <Typography variant="caption" color="error.main">{zh ? '选择错误，请重新选择' : 'Wrong choice, please select again'}</Typography>;
                  }
                  return <Typography variant="caption" color="text.secondary">{zh ? '点击选中应该首先合并的节点' : 'Click to select the node that should be merged first'}</Typography>;
                }
                return <Typography variant="caption" color="text.secondary">{zh ? '暂无提示' : 'No hints yet'}</Typography>;
              })()
            )}
          </Box>
        </div>
      </div>

      {/* 垂直分割线（可拖拽） */}
      <div
        className="lc-resizer"
        onMouseDown={() => setIsResizing(true)}
        onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as any).setPointerCapture?.((e as any).pointerId); setIsResizing(true); }}
        onPointerUp={(e) => { (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId); setIsResizing(false); }}
        onTouchStart={(e) => { e.preventDefault(); setIsResizing(true); }}
        onTouchEnd={() => setIsResizing(false)}
        onPointerMove={(e) => {
          if (!isResizing || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const next = Math.max(20, Math.min(80, (x / rect.width) * 100));
          setLeftPct(next);
        }}
        onTouchMove={(e) => {
          if (!isResizing || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const touch = e.touches && e.touches[0];
          if (!touch) return;
          const x = touch.clientX - rect.left;
          const next = Math.max(20, Math.min(80, (x / rect.width) * 100));
          setLeftPct(next);
        }}
        style={{ display: 'none' }}
      />

      {/* 垂直分隔线的“隐形命中区”（不改变样式，仅提高可命中范围） */}
      <div
        aria-hidden
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizing(true); }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizing(true); }}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizing(true); }}
        style={{ position: 'absolute', top: 57, bottom: 0, left: `${leftPct}%`, transform: 'translateX(-28px)', width: 56, background: 'transparent', cursor: 'col-resize', zIndex: 1500, pointerEvents: 'auto' }}
      />

      {/* 可见垂直分隔条（带点 grip），不改变布局，仅作视觉与更易拖拽的热点区域 */}
      <div
        aria-hidden
        onMouseDown={() => setIsResizing(true)}
        onPointerDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        onTouchStart={(e) => { e.preventDefault(); setIsResizing(true); }}
        style={{
          position: 'absolute',
          top: 57,
          bottom: 0,
          left: `calc(${leftPct}% - 4px)`,
          width: 8,
          cursor: 'col-resize',
          zIndex: 2000,
          touchAction: 'none',
          // 中间白色，左右细线
          background: '#fff',
          boxShadow: 'inset 1px 0 0 #ddd, inset -1px 0 0 #ddd',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'grid',
            gridTemplateRows: 'repeat(5, 3px)',
            rowGap: 2,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ccc' }} />
          ))}
        </div>
      </div>

      {/* 右侧：问题/算法（上栏 Tab 切换） + 下栏 Story 步骤 */}
      <div
        className="lc-right"
        ref={rightSplitRef}
        style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #eee', background: '#fff' }}
      >
        {/* 上栏（Tab 切换）：问题 / 直觉 / 算法 */}
        <Box sx={{ flex: `0 0 ${topPct}%`, minHeight: 0, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
            <Tabs
              value={rightTopTab}
              onChange={(_, v) => setRightTopTab(v)}
              aria-label="problem algorithm tabs"
            >
              <Tab label={zh ? '问题' : 'Problem'} value="problem" />
              <Tab label={zh ? '直觉' : 'Intuition'} value="intuition" />
              <Tab label={zh ? '算法' : 'Algorithm'} value="algorithm" />
            </Tabs>
          </Box>
          <Box sx={{ p: 1.5, overflow: 'auto', flex: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.1)' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(165, 175, 76, 0.3)', borderRadius: '2px' } }}>
            {rightTopTab === 'problem' ? (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#8b7355' }}>
                  {zh ? '📋 合并有序链表' : '📋 Merge Two Sorted Lists'}
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.6, mb: 2 }}>
                  {zh 
                    ? '给定两个有序链表的头节点 list1 和 list2。将这两个链表合并为一个有序链表。合并后的链表应通过将两个链表的节点拼接在一起形成。返回合并后的链表的头节点。'
                    : 'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.'
                  }
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                  {zh ? ' 示例' : 'Example'}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
                  {zh 
                    ? '输入：list1 = [1,2,4],\n list2 = [1,3,4]'
                    : 'Input: list1 = [1,2,4],\n list2 = [1,3,4]'
                  }
                </Typography>
              </>
            ) : rightTopTab === 'intuition' ? (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#6b7c32' }}>
                  {zh ? '🧠 直觉' : '🧠 Intuition'}
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 2 }}>
                  {zh 
                    ? '我们可以递归地定义两个链表的合并操作结果如下（避免处理空链表的特殊情况）：'
                    : 'We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):'
                  }
                </Typography>
                <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 2, border: '1px solid #e0e0e0' }}>
                  <Typography component="pre" variant="body2" sx={{ fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap', m: 0 }}>
                    {zh
                      ? 'list1[0] + merge(list1[1:], list2)  if list1[0] < list2[0]\nlist2[0] + merge(list1, list2[1:])  otherwise'
                      : 'list1[0] + merge(list1[1:], list2)  if list1[0] < list2[0]\nlist2[0] + merge(list1, list2[1:])  otherwise'}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                  {zh 
                    ? '即较小的链表头节点加上对剩余元素的合并结果。'
                    : 'Namely, the smaller of the two lists\' heads plus the result of a merge on the rest of the elements.'
                  }
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#6b7c32' }}>
                  {zh ? '✅ 算法' : '✅ Algorithm'}
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {zh 
                    ? '我们直接模拟上述递归过程，首先处理边界情况。具体来说，如果 l1 或 l2 中的任意一个最初为 null，则无需合并，直接返回非空链表即可。否则，我们确定 l1 和 l2 中哪个头节点较小，并递归地将其 next 值设置为下一次合并的结果。鉴于两个链表均以 null 结尾，递归最终会终止。'
                    : 'We model the above recurrence directly, first accounting for edge cases. Specifically, if either of l1 or l2 is initially null, there is no merge to perform, so we simply return the non-null list. Otherwise, we determine which of l1 and l2 has a smaller head, and recursively set the next value for that head to the next merge result. Given that both lists are null-terminated, the recursion will eventually terminate.'
                  }
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {/* 水平分割线（可拖拽） */}
        <div
          className="lc-resizer-h"
          ref={topResizerRef}
          onMouseDown={() => setIsTopResizing(true)}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as any).setPointerCapture?.((e as any).pointerId); setIsTopResizing(true); }}
          onPointerUp={(e) => { (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId); setIsTopResizing(false); }}
          onTouchStart={(e) => { e.preventDefault(); setIsTopResizing(true); }}
          onTouchEnd={() => setIsTopResizing(false)}
          style={{ height: 8, cursor: 'row-resize', background: '#fff', width: '100%', touchAction: 'none', position: 'relative', zIndex: 1400, userSelect: 'none', boxShadow: 'inset 0 1px 0 #ddd, inset 0 -1px 0 #ddd' }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 3px)',
              columnGap: 2,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ccc' }} />
            ))}
          </div>
        </div>

        {/* 下栏：Story 步骤（内嵌，不再悬浮在画布） */}
        <Box sx={{ flex: `1 1 ${100 - topPct}%`, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* <Box sx={{ p: 1, overflow: 'auto', flex: 1 }}>
            {mode === 'story' ? (
              <StoryPlayer 
                steps={steps} 
                onStepChange={handleStepChange} 
                stepStatuses={stepStatuses}
                setStepStatuses={setStepStatuses}
                onCheck={onCheck}
                onNextDraw={onNextDraw}
                notes={notes}
                isNotesOpen={isNotesOpen}
                stepNotes={stepNotes}
                currentStepIndex={currentStepIndex}
                stepChecks={stepChecks}
                containerRef={rightPaneRef}
                titles={storyAlgorithm === 'iter' ? titles_iter : undefined}
                hints={storyAlgorithm === 'iter' ? hints_iter : undefined}
                isLeftPanelCollapsed={isLeftPanelCollapsed}
                zh={zh}
                inline
              />
            ) : (
              <Box sx={{
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                bgcolor: '#fff',
                boxShadow: 0,
                p: 1.25,
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {zh ? '探索模式' : 'Explore Mode'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {zh
                    ? '现在处于探索模式：可以按照自己的想法在右侧画布上绘制。需要时可随时点击顶部“AI 画图”和“检查步骤”。'
                    : 'You are in Explore mode. Draw freely on the right canvas. Use "AI Draw" and "Check Step" from the top bar anytime.'}
                </Typography>
              </Box>
            )}
          </Box> */}
        </Box>
      </div>
      </Box>
      {/* 全屏透明拖拽覆盖层：仅在拖拽中启用，用于可靠捕获事件，不改变可见样式 */}
      {(isResizing || isTopResizing || isLeftAiResizing) && (
        <div
          onMouseMove={(e) => {
            if (isResizing && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const next = Math.max(20, Math.min(80, (x / rect.width) * 100));
              setLeftPct(next);
            } else if (isTopResizing && rightSplitRef.current) {
              const rect = rightSplitRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const next = Math.max(20, Math.min(80, (y / rect.height) * 100));
              setTopPct(next);
            } else if (isLeftAiResizing && leftColumnRef.current) {
              const rect = leftColumnRef.current.getBoundingClientRect();
              const newHeight = Math.round(rect.bottom - e.clientY);
              const clamped = Math.max(80, Math.min(400, newHeight));
              setLeftAiHeight(clamped);
            }
          }}
          onPointerMove={(e) => {
            if (isResizing && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const next = Math.max(20, Math.min(80, (x / rect.width) * 100));
              setLeftPct(next);
            } else if (isTopResizing && rightSplitRef.current) {
              const rect = rightSplitRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const next = Math.max(20, Math.min(80, (y / rect.height) * 100));
              setTopPct(next);
            } else if (isLeftAiResizing && leftColumnRef.current) {
              const rect = leftColumnRef.current.getBoundingClientRect();
              const newHeight = Math.round(rect.bottom - e.clientY);
              const clamped = Math.max(80, Math.min(400, newHeight));
              setLeftAiHeight(clamped);
            }
          }}
          onTouchMove={(e) => {
            const t = e.touches && e.touches[0];
            if (!t) return;
            if (isResizing && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = t.clientX - rect.left;
              const next = Math.max(20, Math.min(80, (x / rect.width) * 100));
              setLeftPct(next);
            } else if (isTopResizing && rightSplitRef.current) {
              const rect = rightSplitRef.current.getBoundingClientRect();
              const y = t.clientY - rect.top;
              const next = Math.max(20, Math.min(80, (y / rect.height) * 100));
              setTopPct(next);
            } else if (isLeftAiResizing && leftColumnRef.current) {
              const rect = leftColumnRef.current.getBoundingClientRect();
              const newHeight = Math.round(rect.bottom - t.clientY);
              const clamped = Math.max(80, Math.min(400, newHeight));
              setLeftAiHeight(clamped);
            }
            e.preventDefault();
          }}
          onMouseUp={() => { setIsResizing(false); setIsTopResizing(false); setIsLeftAiResizing(false); }}
          onPointerUp={() => { setIsResizing(false); setIsTopResizing(false); setIsLeftAiResizing(false); }}
          onTouchEnd={() => { setIsResizing(false); setIsTopResizing(false); setIsLeftAiResizing(false); }}
          style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 5000, cursor: (isResizing ? 'col-resize' : 'row-resize') as any, background: 'transparent', touchAction: 'none' }}
        />
      )}
      {/* Notes功能已集成到Story卡片中，不再需要单独的Modal */}
    </main>
  );
}
