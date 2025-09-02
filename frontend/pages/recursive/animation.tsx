import dynamic from 'next/dynamic';
import { useState, useRef, useMemo, useEffect } from 'react';
// import StoryPlayer from '../components/StoryPlayer';
// 顶部先引入 MUI 组件
import { IconButton, Tooltip, Box, Modal, Typography, Button, ToggleButton, ToggleButtonGroup, Stack, SvgIcon } from '@mui/material'
// import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon, Explore, Book } from '@mui/icons-material'
import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon, Explore, Book, ChevronRight } from '@mui/icons-material'

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
import { injectSvgImagesAsLibraryItems } from "../../utils/loadLibraryFromSVGImages";
// import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
// import { validateGeminiOverlayResponse } from '../utils/geminiTypes';
// import { applyGeminiOverlayToExcalidraw } from '../utils/geminiOverlay';
import { applyGeminiElementsToExcalidraw, type GeminiPayload } from "../../utils/geminiOverlay";
// import { useSession } from 'next-auth/react';

// const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
// const BACKEND_URL = 'http://localhost:4000';
// export const BACKEND_URL =
//   process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5095';
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '/api';

const StoryPlayer = dynamic(() => import('../../components/StoryPlayer'), {
  ssr: false
})

const ExploreMode = dynamic(() => import('../../components/ExploreMode'), {
  ssr: false
})

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const MarkdownWithDrawing = dynamic(() => import('../../components/MarkdownWithDrawing'), { ssr: false });
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
  const [zh, setZh] = useState(true);
  // 自定义插入模式（点击画布插入）
  const [pendingInsertTool, setPendingInsertTool] = useState<'rectangle' | 'ellipse' | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  // 底部素材库
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
  const libraryCaptions = ['代码','手写','打字','公式','任意图形','箭头连线','矩阵','图','树','栈','数组','链表'];

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
  // 故事模式算法选择：algo1（默认）或 iter（迭代版）
  const [storyAlgorithm, setStoryAlgorithm] = useState<'algo1' | 'iter'>('algo1');
  
  const titles_iter = [
    // '初始化指针',
    '第一次比较并接入',
    '移动 prev，更新指针',
    '再次比较',
    '继续接入，形成 1→1',
    '循环推进：直到有一条用完',
    '连接剩余部分',
    '🎉 全部完成！',
  ];
  const hints_iter = [
    "创建一个虚拟头结点 prehead（值可写 -1，仅作占位），让 prev 指向它；\n设置 l1 指向 list1 头、l2 指向 list2 头。\n现在：l1=1，l2=1。\n比较 l1 与 l2, 应该接入哪个到 prev.next?\n 用⭕标记出你选择的节点。",
    "把 prev 向前移动到刚接入的1，并将 l1 指向下一个（此时 l1=2）。\n当前合并链：1。",
    "再次比较：l1=2，l2=1。\n这次应接入哪个节点。",
    "接入 l2 的 1 后，prev 前移到新接入的 1；l2 前移到 3。\n当前合并链：1 → 1。",
    "继续循环：\n比较 2 与 3 → 接入 2；\n比较 4 与 3 → 接入 3；\n比较 4 与 4 → 接入任意一个（按 ≤ 规则先接入 list1 的 4）。\n在每次接入后，prev 与对应指针同步前移。",
    "当某一条链表指针变为 null（示例中接入 list1 的 4 后，l1=null），\n将另一条未用完的链表（此处 l2=4 开头）整体接到 prev.next。",
    "完成！返回 prehead.next。\n检查：是否得到有序链 1 → 1 → 2 → 3 → 4 → 4，且所有原节点都被包含。",
  ];

  const steps = useMemo(() => {
    if (storyAlgorithm === 'iter') {
      return hints_iter.map((h) => ({ stepText: h }));
    }
    return [
      { stepText: "让我们开始吧！现在有两个链表：\n• 链表1: 1 → 2 → 4\n• 链表2: 1 → 3 → 4\n查看 list1 和 list2 的头节点（都是 1）。\n我们应该先添加哪一个？\n用绿色圆圈🟢标记出你选择的头节点。" },
      { stepText: "在从 list2 中取出 1，开始绘制合并后的链表。\n然后从 list2 中用红色打叉❌标记移除这个节点。" },
      { stepText: "比较新的头节点：list1 是 1，list2 是 3。\n哪一个应该接下来加入合并后的链表？\n用绿色圆圈🟢标记出你选择的节点。" },
      { stepText: "将 list1 中的 1 添加到合并后的链表中。\n更新 list1，用红色打叉❌标记移除这个节点，然后继续。" },
      { stepText: "连续做两次，自己试着完成！现在链表list1: 2->4, list2：3->4\n规则：🟢选择更小节点 → 接入合并链表 → 在原链表中❌删除\n完成合并链表新接两个节点"},
          { stepText: "继续！合并下一个节点。\n在4和4之间选择后，画出更新后的链表。" },
      { stepText: "干得漂亮！\n让我们连接最后一个节点，完成合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。" },
    ] as { stepText: string }[];
  }, [storyAlgorithm]);

  // 根据算法重置故事模式的所有步骤与画布；第0步采用不同初始文件
  const resetStoryForAlgorithm = async (alg: 'algo1' | 'iter', zh: boolean) => {
    if (!excalidrawAPI) return;
    try {
      // 根据语言 & 算法，选择初始文件
      const initFile =
        alg === 'iter'
          ? (zh ? '/initial2.excalidraw' : '/initial2e.excalidraw')
          : (zh ? '/initial1.excalidraw' : '/initial1e.excalidraw');
  
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

      const stepsCount = steps.length; // 你已有的 steps
    const initialScenes: Record<number, StepScene> = {};
    initialScenes[0] = initialStep0;
    for (let i = 1; i < stepsCount; i++) {
      initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
    }
    setScenes(initialScenes);


      // 重置步骤索引/状态/提示
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
  resetStoryForAlgorithm(storyAlgorithm, zh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
//   useEffect(() => {
//     if (!excalidrawAPI) return;
//     console.log('🚀 初始化画布和场景（第1步载入 initial1.excalidraw，其余空白）');
//     (async () => {
//       let initialStep0: StepScene | null = null;
//       try {
//         const resp = await fetch('/initial1.excalidraw');
//         if (resp.ok) {
//           const data = await resp.json();
//           const elements = Array.isArray(data?.elements) ? data.elements : [];
//           const files = data?.files || {};
//           const appState = { viewBackgroundColor: '#fff', ...(data?.appState || {}) };
//           initialStep0 = { elements, files, appState };
//           console.log('✅ 载入 initial1.excalidraw 成功，元素数:', elements.length);
//         } else {
//           console.warn('⚠️ 载入 initial1.excalidraw 失败:', resp.status);
//         }
//       } catch (e) {
//         console.warn('⚠️ 载入 initial1.excalidraw 异常:', e);
//       }

//     const initialScenes: Record<number, StepScene> = {};
//       // 第一步：若有文件则载入，否则空白
//       if (initialStep0) {
//         initialScenes[0] = initialStep0;
//         console.log('✅ 步骤 0 使用 initial1.excalidraw 初始化');
//       } else {
//         initialScenes[0] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
//         console.log('✅ 步骤 0 初始化为空白画布（未找到 initial1.excalidraw）');
//       }
//       // 其余步骤空白
//     for (let i = 1; i < steps.length; i++) {
//         initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
//         console.log(`✅ 步骤 ${i} 初始化为空白画布`);
//       }

//     setScenes(initialScenes);
//       console.log(`✅ 初始化了 ${steps.length} 个步骤，步骤0载入${initialStep0 ? '文件' : '空白'}，其余空白`);
    
//       // 显示第0步
//       const scene0 = initialScenes[0];
//       excalidrawAPI.updateScene({
//         elements: Array.from(scene0.elements) as any[],
//         appState: scene0.appState,
//       captureUpdate: 2 as any,
//     });
//       console.log('✅ 显示第0步画布');
    
//     // 确保探索模式有独立的初始状态
//     if (exploreModeCanvas.elements.length === 0) {
//         setExploreModeCanvas({ elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } });
//       console.log('✅ 初始化探索模式画布完成');
//     }
    
//     currentStepIndexRef.current = 0;
//     console.log('📍 设置当前步骤索引为 0');
//     if (steps.length > 0) {
//       setCurrentStepText(steps[0].stepText);
//       console.log('📝 设置初始步骤文本:', steps[0].stepText.substring(0, 50) + '...');
//     }
//     })();
//   }, [excalidrawAPI]); // eslint-disable-line

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
  const selectedText = `  # 递归算法

  ## 问题描述 - 合并两个有序链表

  给定两个有序链表的头节点 \`list1\` 和 \`list2\`。

  将这两个链表合并为一个**有序**链表。合并后的链表应通过将两个链表的节点**拼接**在一起形成。返回合并后的链表的头节点。


  \`\`\`
  输入：list1 = [1,2,4], list2 = [1,3,4]
  \`\`\`

  ### 直觉

  我们可以递归地定义两个链表的合并操作结果如下（避免处理空链表的特殊情况）：


  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0] \n
  list2[0] + merge(list1, list2[1:])  否则


  即较小的链表头节点加上对剩余元素的合并结果。

  ### 算法

  我们直接模拟上述递归过程，首先处理边界情况。具体来说，如果 l1 或 l2 中的任意一个最初为 null，则无需合并，直接返回非空链表即可。否则，我们确定 l1 和 l2 中哪个头节点较小，并递归地将其 next 值设置为下一次合并的结果。鉴于两个链表均以 null 结尾，递归最终会终止。

  </details>

  `
  const selectedTextEN = `
  # Recursion Algorithm

  ## 📋 Problem Description - Merge Two Sorted Lists

  You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

  Merge the two lists into one **sorted** list. The list should be made by **splicing together** the nodes of the first two lists. Return the head of the merged linked list.

  ---

  ### Example

  \`\`\`
  Input: list1 = [1,2,4], list2 = [1,3,4]
  \`\`\`





  ### Intuition

  We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):


  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0] \n
  list2[0] + merge(list1, list2[1:])  otherwise


  Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.

  ### Algorithm

  We model the above recurrence directly, first accounting for edge cases. Specifically, if either of l1 or l2 is initially null, there is no merge to perform, so we simply return the non-null list. Otherwise, we determine which of l1 and l2 has a smaller head, and recursively set the next value for that head to the next merge result. Given that both lists are null-terminated, the recursion will eventually terminate.

  </details>
`
  // ---

  // <details>
  // <summary>✅ Approach 2: Iteration</summary>

  // ### Intuition

  // We can achieve the same idea via iteration by assuming that l1 is entirely less than l2 and processing the elements one-by-one, inserting elements of l2 in the necessary places in l1.

  // ### Algorithm

  // First, we set up a false "prehead" node that allows us to easily return the head of the merged list later. We also maintain a prev pointer, which points to the current node for which we are considering adjusting its next pointer. Then, we do the following until at least one of l1 and l2 points to null: if the value at l1 is less than or equal to the value at l2, then we connect l1 to the previous node and increment l1. Otherwise, we do the same, but for l2. Then, regardless of which list we connected, we increment prev to keep it one step behind one of our list heads.

  // After the loop terminates, at most one of l1 and l2 is non-null. Therefore (because the input lists were in sorted order), if either list is non-null, it contains only elements greater than all of the previously-merged elements. This means that we can simply connect the non-null list to the merged list and return it.

  // To see this in action on an example, check out the animation below:

  // <!-- animation-slot -->
  // </details>
  // `;
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
      // 固定打开底部素材库，避免重复点击造成闪烁
      setShowLibraryBottom(true);
    } catch (e) {
      console.warn('openLibrary failed', e);
    }
  };
    

    
  return (
    <div className="flex h-screen">
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
              variant="outlined"
              fullWidth
              onClick={() => window.location.href = '/'}
              sx={{
                py: 1,
                fontSize: '0.875rem',
                fontWeight: 'bold',
                opacity: isNavCollapsed ? 0 : 1,
                transition: 'opacity 0.3s ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              演示
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
                递归
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    minHeight: '20px',
                    textTransform: 'none',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
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
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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
            </Box>

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
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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
            </Box>

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
                贪心
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
                  动画
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
                  画图 
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
                  测试
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
      </Box>

      {/* 内容区域 */}
      <div className="flex-1 flex">
        {/* 左侧内容 */}
      <div className="w-2/5 relative bg-gray-100">
      <MarkdownWithDrawing
            markdown={zh?selectedText:selectedTextEN}
            zh={zh}
            onToggleZh={() => setZh(v => !v)}
            // setZh={setZh}
            onAlgorithmSelect={async (alg) => {
              setStoryAlgorithm(alg);
              if (mode === 'story') {
                await resetStoryForAlgorithm(alg,zh);
              }
            }}
            // isCollapsed={isLeftPanelCollapsed}
            // onToggleCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
          />
        </div>

        {/* 右侧内容 */}
      <div
        className="w-3/5 bg-white relative"
        ref={rightPaneRef}
        style={{
          touchAction: 'none',           // 禁用浏览器默认触控手势，稳定手写
          overscrollBehavior: 'contain', // 阻止 iOS 橡皮筋滚动影响布局
          overflow: 'hidden',            // 避免绘制时容器产生滚动条
          contain: 'layout paint',       // 限定重绘范围，减少抖动
        }}
      >
      {/* 右栏悬浮按钮组 */}
        <Box
          position="absolute"
          top={19}
          left={300}            // ✅ 靠左
          zIndex={10}
          bgcolor="rgba(255,255,255,0.9)"
          borderRadius={1}
          // boxShadow={1}
          display="flex"
          gap={1}
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

        {/* 遮挡 Excalidraw 左上角菜单按钮的白色遮挡物 */}
         <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 64,
            height: 64,
            bgcolor: '#fff',
            borderRadius: 1,
            zIndex: 20,
            pointerEvents: 'auto', // 阻止点击到底层按钮
          }}
        />

        {/* 遮挡 Excalidraw 右上角的 Library 按钮 */}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 120,
            height: 64,
            bgcolor: '#fff',
            borderRadius: 1,
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        />

        <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: '60%',
              transform: 'translateX(-50%)',
              width: '100%', // 自适应右侧面板宽度
              maxWidth: '90%', // 限制最大宽度，避免超出面板
              height: 81,
              bgcolor: '#fff',
              borderRadius: 1,
              zIndex: 25,
              pointerEvents: 'none',
              // boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
        
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

        {/* 自定义简化工具栏（顶部居中，横向排列） */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: '60%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            bgcolor: 'rgba(255,255,255,1)',
            borderRadius: 1,
            p: 0.5,
            display: 'flex',
            flexDirection: 'row',
            gap: 1.25,
            width: 'auto', // 自适应内容宽度
            minWidth: 200, // 最小宽度保证按钮可见
            maxWidth: '90%', // 最大宽度限制，避免超出面板
            height: 72,
            transition: 'left 0.3s ease-in-out',
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
        </Box>

        {/* 模式选择弹窗（美观卡片样式） */}
        <Modal open={isModeDialogOpen} onClose={() => setIsModeDialogOpen(false)}>
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

        <Excalidraw 
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={(elements, appState, files) => {
            // 实时保存画布变化
            if (api) {
              // console.log(`🎨 Excalidraw onChange 事件 - 模式: ${mode}, 元素数: ${elements.length}`);
              // 若存在 AI Ghost，用户一旦作画（元素数量增加）则清除 Ghost
              try {
                if (aiGhostActiveRef.current && elements.length > lastElementsCountRef.current) {
                  setAiGhost(null);
                  aiGhostActiveRef.current = false;
                }
              } catch {}
              // 使用防抖保存，避免频繁保存
              if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
              }
              autoSaveTimerRef.current = setTimeout(() => {
                // 只有在正确的模式下才保存，并且确保不是正在切换模式
                if ((mode === 'story' || mode === 'explore') && !isModeSwitching.current) {
                  // console.log(`💾 自动保存 - 模式: ${mode}`);
                saveCurrentScene();
                } else {
                  // console.log(`⚠️ 跳过自动保存 - 模式: ${mode}, 是否正在切换: ${isModeSwitching.current}`);
                }
              }, 300); // 300ms 后保存
            }
          }}
          // 移动设备适配配置
         
          UIOptions={{
            tools: { image: false },               // 隐藏工具（移除不受支持的 'line' 字段）
            // canvasActions: {
            //   saveToActiveFile: true,
            //   loadScene: false,
            //   export: false,
            //   saveAsImage: false,
            //   clearCanvas: true,
            // },
            dockedSidebarBreakpoint: 100000, // 移动设备上不显示侧边栏
            welcomeScreen: false, // 禁用欢迎屏幕
          }}
          // 触摸设备优化
          gridModeEnabled={false} // 移动设备上禁用网格模式
          zenModeEnabled={false} // 移动设备上禁用禅模式
          viewModeEnabled={false} // 移动设备上禁用视图模式
          // 移动设备特定的应用状态
          initialData={{
            appState: {
              viewBackgroundColor: "#fff",
              // 移动设备上禁用一些功能
              showWelcomeScreen: false,
              // 触摸设备优化
              penMode: false,
              gridSize: undefined,
            },
            scrollToContent: true
          }}
        />

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

        {/* 底部素材库面板 */}
        {showLibraryBottom && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 80,
              transform: 'translateX(-50%)',
              zIndex: 35,
              bgcolor: 'rgba(255,255,255,0.98)',
              borderRadius: 1,
              boxShadow: 3,
              p: 1,
              width: '80%',
              maxWidth: 900,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>素材库</Typography>
              <Button size="small" onClick={() => setShowLibraryBottom(false)}>关闭</Button>
            </Box>
            <Box sx={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridTemplateRows: 'repeat(2, auto)',
              gap: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              p: 0.5,
              alignItems: 'start'
            }}>
              {libraryItems && libraryItems.length > 0 ? (
                libraryItems.slice().reverse().map((item: any, idx: number) => {
                  const origIdx = libraryItems.length - 1 - idx;
                  const thumbId = String(item?.id ?? `item-${origIdx}`);
                  return (
                  <Box key={thumbId} sx={{ textAlign: 'center', width: 120 }}>
                    <LibraryItemThumb
                      item={item}
                      thumbId={thumbId}
                      width={110}
                      height={72}
                      onClick={() => {
                        setPendingLibraryItem(item);
                        // 预计算素材包围盒，用于 Ghost 预览
                        try {
                          const els: any[] = item?.elements || [];
                          if (els.length) {
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            for (const el of els) {
                              const x = typeof el.x === 'number' ? el.x : 0;
                              const y = typeof el.y === 'number' ? el.y : 0;
                              const w = typeof el.width === 'number' ? el.width : 0;
                              const h = typeof el.height === 'number' ? el.height : 0;
                              minX = Math.min(minX, x);
                              minY = Math.min(minY, y);
                              maxX = Math.max(maxX, x + w);
                              maxY = Math.max(maxY, y + h);
                            }
                            const w = Math.max(1, maxX - minX);
                            const h = Math.max(1, maxY - minY);
                            // 归一化元素到局部坐标系（以 minX/minY 为原点）
                            const mapped = els.map((el: any) => {
                              const x = (el.x ?? 0) - minX;
                              const y = (el.y ?? 0) - minY;
                              return {
                                type: el.type,
                                x, y,
                                width: el.width ?? 0,
                                height: el.height ?? 0,
                                points: Array.isArray(el.points) ? el.points : undefined,
                                text: el.text,
                                fontSize: el.fontSize ?? 18,
                                strokeColor: el.strokeColor ?? '#000',
                                backgroundColor: el.backgroundColor ?? 'transparent',
                                strokeWidth: el.strokeWidth ?? 2,
                                strokeStyle: el.strokeStyle ?? 'solid',
                              };
                            });
                            setLibraryGhost({ width: w, height: h, minX, minY, elements: mapped });
                          } else {
                            setLibraryGhost(null);
                          }
                        } catch {
                          setLibraryGhost(null);
                        }
                        setShowLibraryBottom(false);
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, maxWidth: 110 }} noWrap>
                      {libraryCaptions[origIdx] ?? item?.name ?? `Item ${origIdx + 1}`}
                    </Typography>
                  </Box>
                );})
              ) : (
                <Typography variant="caption" color="text.secondary">暂无素材</Typography>
              )}
            </Box>
          </Box>
        )}

        {/* 库项点击后在画布点击位置插入 */}
        {pendingLibraryItem && (
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

                // 计算库元素的包围盒，居中插入
                const elements: any[] = pendingLibraryItem?.elements || [];
                if (!elements.length) return;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const el of elements) {
                  if (typeof el.x === 'number' && typeof el.y === 'number') {
                    minX = Math.min(minX, el.x);
                    minY = Math.min(minY, el.y);
                    const w = typeof el.width === 'number' ? el.width : 0;
                    const h = typeof el.height === 'number' ? el.height : 0;
                    maxX = Math.max(maxX, el.x + w);
                    maxY = Math.max(maxY, el.y + h);
                  }
                }
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;
                const dx = sceneX - cx;
                const dy = sceneY - cy;
                const cloned = elements.map((el: any) => ({ ...el, x: el.x + dx, y: el.y + dy }));

                excalidrawAPI.updateScene({
                  elements: [...excalidrawAPI.getSceneElements(), ...cloned as any],
                });
                saveCurrentScene();
              } finally {
                setPendingLibraryItem(null);
                setLibraryGhost(null);
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
        {/* Ghost 预览素材（完整形状渲染） */}
        {pendingLibraryItem && insertGhost && libraryGhost && (
          <Box
            sx={{ position: 'absolute', zIndex: 41, pointerEvents: 'none', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <svg
              width={libraryGhost.width * insertGhost.zoom}
              height={libraryGhost.height * insertGhost.zoom}
              viewBox={`0 0 ${libraryGhost.width} ${libraryGhost.height}`}
              style={{
                position: 'absolute',
                top: insertGhost.y - (libraryGhost.height * insertGhost.zoom) / 2,
                left: insertGhost.x - (libraryGhost.width * insertGhost.zoom) / 2,
                overflow: 'visible',
                opacity: 0.9,
              }}
            >
              <defs>
                <marker id="lib-ghost-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L10,5 L0,10 z" fill="#666" />
                </marker>
              </defs>
              {libraryGhost.elements.map((el, idx) => {
                const stroke = el.strokeColor || '#000';
                const fill = el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : 'none';
                const sw = Math.max(1, el.strokeWidth || 2);
                const dash = el.strokeStyle === 'dashed' ? '6,4' : el.strokeStyle === 'dotted' ? '2,4' : undefined;
                if (el.type === 'rectangle' || el.type === 'image') {
                  return (
                    <rect key={idx} x={el.x} y={el.y} width={el.width} height={el.height} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />
                  );
                }
                if (el.type === 'ellipse') {
                  return (
                    <ellipse key={idx} cx={el.x + el.width / 2} cy={el.y + el.height / 2} rx={el.width / 2} ry={el.height / 2} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />
                  );
                }
                if (el.type === 'diamond') {
                  const points = [
                    [el.x + el.width / 2, el.y],
                    [el.x + el.width, el.y + el.height / 2],
                    [el.x + el.width / 2, el.y + el.height],
                    [el.x, el.y + el.height / 2],
                  ];
                  return (
                    <polygon key={idx} points={points.map(p => p.join(',')).join(' ')} stroke={stroke} fill={fill} strokeWidth={sw} strokeDasharray={dash} />
                  );
                }
                if (el.type === 'line' || el.type === 'arrow') {
                  const baseX = el.x;
                  const baseY = el.y;
                  const pts: [number, number][] = Array.isArray(el.points) && el.points.length ? el.points.map((p: [number, number]) => [baseX + p[0], baseY + p[1]]) : [[baseX, baseY], [baseX + (el.width || 0), baseY + (el.height || 0)]];
                  return (
                    <polyline key={idx} points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} markerEnd={el.type === 'arrow' ? 'url(#lib-ghost-arrow)' : undefined} />
                  );
                }
                if (el.type === 'text' && el.text) {
                  return (
                    <text key={idx} x={el.x} y={el.y + (el.fontSize || 18)} fontSize={el.fontSize || 18} fill={stroke}>
                      {el.text}
                    </text>
                  );
                }
                return null;
              })}
            </svg>
          </Box>
        )}
        {/* <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} /> */}
        
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

        {/* 根据mode显示不同的组件 */}
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
            // isLeftPanelCollapsed={isLeftPanelCollapsed}
            zh={zh}
          />
                 ) : (
           <ExploreMode 
             onCheck={onCheck}
             onNextDraw={onNextDraw}
             notes={notes}
             containerRef={rightPaneRef}
            //  isLeftPanelCollapsed={isLeftPanelCollapsed}
           />
         )}

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
      </div>
      {/* Notes功能已集成到Story卡片中，不再需要单独的Modal */}
    </div>
  );
}
