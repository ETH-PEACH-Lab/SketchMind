import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback } from 'react';
// import StoryPlayer from '../components/StoryPlayer';
// 顶部先引入 MUI 组件
import { IconButton, Tooltip, Box, Modal, Typography, Button, ToggleButton, ToggleButtonGroup, Stack, SvgIcon } from '@mui/material'
import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon, Explore, Book } from '@mui/icons-material'
// 追加这些组件
import { Paper, Divider, RadioGroup, Radio, FormControlLabel, TextField, Switch } from '@mui/material';

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

// const MarkdownWithDrawing = dynamic(() => import('../../components/MarkdownWithDrawing'), { ssr: false });
// const SVGWhiteboard = dynamic(() => import('../components/SVGWhiteboard'), { ssr: false });

type StepScene = {
  elements: readonly any[];
  files: any;
  appState?: any;
};
type MCQ = {
    id: string;
    promptEN: string;
    promptZH: string;
    options: { key: string; textEN: string; textZH: string }[];
    // 不展示答案，保留结构以便后续扩展
  };
  
  type OrderingQ = {
    id: string;
    promptEN: string;
    promptZH: string;
    stepsEN: string[];
    stepsZH: string[];
  };
  
  type FillBlankQ = {
    id: string;
    promptEN: string;
    promptZH: string;
    blanks: { id: string; placeholder: string }[];
    footerEN: string;
    footerZH: string;
  };
  
  // ==== Questions content (no answers shown) ====
  const MCQS: MCQ[] = [
    {
      id: 'q1',
      promptEN: 'Q1 · What is the core recursive logic for removing elements from a linked list?',
      promptZH: 'Q1 · 递归删除链表元素的核心逻辑是什么？',
      options: [
        { key: 'A', textEN: 'Traverse and directly delete all target nodes', textZH: '从头到尾遍历并直接删除所有目标值节点' },
        { key: 'B', textEN: 'Solve the subproblem first (rest of the list), then decide whether to keep the current node', textZH: '先解决子问题（余下链表），再决定是否保留当前节点' },
        { key: 'C', textEN: 'Loop until encountering a node equal to val, then stop', textZH: '循环直到遇到等于 val 的节点就停止' },
        { key: 'D', textEN: 'Copy into an array, filter, rebuild the list', textZH: '复制到数组，过滤后重建链表' },
      ],
    },
    {
      id: 'q2',
      promptEN: 'Q2 · True or False: The base case is when the list is empty (head == nullptr).',
      promptZH: 'Q2 · 判断：递归的基本情况是链表为空（head == nullptr）。',
      options: [
        { key: 'T', textEN: 'True', textZH: '对' },
        { key: 'F', textEN: 'False', textZH: '错' },
      ],
    },
    {
      id: 'q4',
      promptEN: 'Q4 · Input: head = [6, 6, 3], val = 6. When recursion first expands, which node is processed first (the first recursive call goes to)?',
      promptZH: 'Q4 · 输入：head = [6, 6, 3], val = 6。递归首次展开时，先处理哪个节点（首次递归调用指向的节点）？',
      options: [
        { key: 'A', textEN: 'The first node with value 6', textZH: '值为 6 的第一个节点' },
        { key: 'B', textEN: 'The second node with value 6', textZH: '值为 6 的第二个节点' },
        { key: 'C', textEN: 'The third node with value 3', textZH: '值为 3 的第三个节点' },
        { key: 'D', textEN: 'The recursion stops immediately because head->val == 6', textZH: '由于 head->val == 6，递归立即停止' },
      ],
    },
  ];
  
  const ORDERING_Q: OrderingQ = {
    id: 'q3',
    promptEN: 'Q3 · Arrange the steps into the correct recursive process.',
    promptZH: 'Q3 · 将以下步骤按正确的递归流程排序。',
    // promptZH: '将以下步骤按正确的递归流程排序。',
    stepsEN: [
      'Check if the list is empty',
      'Recursively remove elements from head->next',
      'Decide whether to return head or head->next based on head->val',
    ],
    stepsZH: ['判断链表是否为空', '对 head->next 进行递归删除', '根据 head->val 决定返回 head 或 head->next'],
  };
  
  const FILL_Q: FillBlankQ = {
    id: 'q5',
    promptEN: 'Q5 · Fill in the blanks (C++):',
    promptZH: 'Q5 · 填空（C++）：',
    blanks: [
      { id: 'b1', placeholder: 'base condition' },
      { id: 'b2', placeholder: 'return value when head->val == val' },
    ],
    footerEN:
      'if (__________) return head;\nhead->next = removeElements(head->next, val);\nreturn (head->val == val) ? _____________ : head;',
    footerZH:
      'if (__________) return head;\nhead->next = removeElements(head->next, val);\nreturn (head->val == val) ? _____________ : head;',
  };
  
  // ==== Small UI blocks (no correctness/answers shown) ====
  function MCQBlock({ q, zh }: { q: MCQ; zh: boolean }) {
    const [choice, setChoice] = useState<string>('');
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={700} gutterBottom>
          {zh ? q.promptZH : q.promptEN}
        </Typography>
        <RadioGroup value={choice} onChange={(e) => setChoice((e.target as HTMLInputElement).value)}>
          <Stack gap={1}>
            {q.options.map((op) => (
              <FormControlLabel
                key={op.key}
                value={op.key}
                control={<Radio />}
                label={`${op.key}. ${zh ? op.textZH : op.textEN}`}
              />
            ))}
          </Stack>
        </RadioGroup>
      </Paper>
    );
  }
  
  function OrderingBlock({ q, zh }: { q: OrderingQ; zh: boolean }) {
    const [order, setOrder] = useState<number[]>(q.stepsEN.map((_, i) => i));
    const steps = zh ? q.stepsZH : q.stepsEN;
    const move = (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      setOrder(next);
    };
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={700} gutterBottom>
          {zh ? q.promptZH : q.promptEN}
        </Typography>
        <Stack gap={1}>
          {order.map((idx, i) => (
            <Stack key={`${idx}-${i}`} direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ width: 24, textAlign: 'right', color: 'text.secondary' }}>
                {i + 1}.
              </Typography>
              <Paper sx={{ p: 1, flex: 1 }} variant="outlined">
                {steps[idx]}
              </Paper>
              <Stack direction="row" gap={1}>
                <Button size="small" variant="outlined" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                >
                  ↓
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Paper>
    );
  }
  
  function FillBlankBlock({ q, zh }: { q: FillBlankQ; zh: boolean }) {
    const [b1, setB1] = useState('');
    const [b2, setB2] = useState('');
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={700} gutterBottom>
          {zh ? q.promptZH : q.promptEN}
        </Typography>
        <Stack gap={1}>
          <TextField size="small" label={zh ? '空 1' : 'Blank 1'} placeholder={q.blanks[0].placeholder} value={b1} onChange={(e) => setB1(e.target.value)} />
          <TextField size="small" label={zh ? '空 2' : 'Blank 2'} placeholder={q.blanks[1].placeholder} value={b2} onChange={(e) => setB2(e.target.value)} />
          <Paper variant="outlined" sx={{ p: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
            {zh ? q.footerZH : q.footerEN}
          </Paper>
        </Stack>
      </Paper>
    );
  }
  
  function ParsonsBlock({ lines, zh }: { lines: string[]; zh: boolean }) {
    const [order, setOrder] = useState<number[]>(lines.map((_, i) => i));
    const move = (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      setOrder(next);
    };
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={700} gutterBottom>
          {zh ? 'Q6 · Parsons 拼图（代码排序）' : 'Q6 · Parsons Problem (Code Ordering)'}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {zh ? '将下列代码重排为正确的递归函数：' : 'Reorder the lines to form the correct recursive function:'}
        </Typography>
        <Stack gap={1}>
          {order.map((idx, i) => (
            <Stack key={`${idx}-${i}`} direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ width: 24, textAlign: 'right', color: 'text.secondary' }}>
                {i + 1}.
              </Typography>
              <Paper sx={{ p: 1, flex: 1, fontFamily: 'monospace', fontSize: 13 }} variant="outlined">
                {lines[idx]}
              </Paper>
              <Stack direction="row" gap={1}>
                <Button size="small" variant="outlined" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                >
                  ↓
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Paper>
    );
  }
  
  const PARSONS_LINES = [
    'return (head->val == val) ? head->next : head;',
    'head->next = removeElements(head->next, val);',
    'if (head == nullptr) {',
    'return head;',
    '}',
  ];
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
    // 语言切换（EN/中文）
const [zh, setZh] = useState(false);
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
  // 故事模式算法选择：greed（贪心算法）
  const [storyAlgorithm, setStoryAlgorithm] = useState<'greed'>('greed');
  
  const titles_greed = [
    '贪心选择',
    '局部最优',
    '继续贪心',
    '完成合并',
  ];
  const hints_greed = [
    "贪心算法：每次选择当前最小的节点。\n比较 list1 和 list2 的头节点，选择较小的一个。\n用绿色圆圈🟢标记出你选择的节点。",
    "继续贪心策略：在剩余的节点中选择最小的。\n标记已选择的节点，继续比较下一个。",
    "重复贪心选择：每次都在当前可用的节点中选择最小的。\n保持贪心的局部最优性质。",
    "完成！检查是否得到了有序的合并链表。\n贪心算法保证了每一步都是局部最优的选择。",
  ];

  // const steps = useMemo(() => {
  //   return hints_greed.map((h) => ({ stepText: h }));
  // }, []);
// ... existing code ...
const steps = hints_greed.map((h) => ({ stepText: h }));
// ... existing code ...
  // 根据算法重置故事模式的所有步骤与画布；第0步采用不同初始文件
  const resetStoryForAlgorithm = async (alg: 'greed') => {
    if (!excalidrawAPI) return;
    try {
      const initFile = '/initial1.excalidraw'; // 使用默认初始文件
      let initialStep0: StepScene = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
      try {
        const resp = await fetch(initFile);
        if (resp.ok) {
          const data = await resp.json();
          initialStep0 = {
            elements: Array.isArray(data?.elements) ? data.elements : [],
            files: data?.files || {},
            appState: { viewBackgroundColor: '#fff', ...(data?.appState || {}) },
          };
        }
      } catch {}

      const initialScenes: Record<number, StepScene> = {};
      initialScenes[0] = initialStep0;
      for (let i = 1; i < hints_greed.length; i++) {
        initialScenes[i] = { elements: [], files: {}, appState: { viewBackgroundColor: '#fff' } };
      }
      setScenes(initialScenes);

      // 重置步骤索引/状态/提示
      currentStepIndexRef.current = 0;
      setCurrentStepIndex(0);
      // 同步当前步骤文本为所选算法的第0步
      setCurrentStepText(hints_greed[0] || '');
      setStepStatuses(Array(Object.keys(initialScenes).length).fill('pending'));
      setStepNotes({});
      setStepChecks({});
      setNotes('');
      setIsNotesOpen(false);

      // 显示第0步
      const scene0 = initialScenes[0];
      excalidrawAPI.updateScene({
        elements: Array.from(scene0.elements) as any[],
        appState: scene0.appState,
        captureUpdate: 2 as any,
      });
    } catch (e) {
      console.warn('重置故事模式失败', e);
    }
  };

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
      ? (steps[idx - 1]?.stepText || '')
      : '';

    // 调试信息
    console.log('🔍 步骤索引调试:', {
      currentStepIndex,
      targetStepIndex: idx,
      storyAlgorithm,
      hasPreviousStep,
      steps_length: steps.length,
      previousStepIndex: idx - 1,
      steps_previous: steps[idx - 1]?.stepText,
      previousStepText,
      // 添加更多调试信息
      currentStepText_preview: currentStepText?.substring(0, 50),
      steps_array: steps.map((s, i) => ({ index: i, text: s.stepText?.substring(0, 30) }))
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
                  variant="contained"
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
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
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
            
          </Box>
        </Box>
      </Box>

      {/* 内容区域 */}
      <div className="flex-1 flex">
        {/* 左侧内容 */}
        <div className="w-2/5 relative bg-gray-100" style={{ overflowY: 'auto', height: '100vh' }}>
          {/* ================= Recursion · Remove Linked List Elements (Testing) ================= */}
<Box sx={{ p: 3, pt: 0 }}>
  {/* 顶部标题 + 语言切换 */}
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
    <Typography variant="h6" sx={{ color: '#333', fontWeight: 600 }}>
      {zh ? '递归 · 移除链表元素' : 'Recursion · Remove Linked List Elements'}
    </Typography>
    <Stack direction="row" alignItems="center" gap={1}>
      <Typography variant="body2">EN</Typography>
      <Switch checked={zh} onChange={(e) => setZh(e.target.checked)} />
      <Typography variant="body2">中文</Typography>
    </Stack>
  </Box>

  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
    <Typography sx={{ mb: 1.5 }}>
      {zh
        ? '给定链表头节点 head 和整数 val，删除所有满足 Node.val == val 的节点，并返回新的头节点。请用递归思路回答以下题目。'
        : 'Given the head of a linked list and an integer val, remove all nodes where Node.val == val and return the new head. Answer the following using the recursive approach.'}
    </Typography>
    <Divider />
  </Paper>

  {/* Q1 */}
  <MCQBlock q={MCQS[0]} zh={zh} />
  {/* Q2 */}
  <MCQBlock q={MCQS[1]} zh={zh} />
  {/* Q3 (ordering) */}
  <OrderingBlock q={ORDERING_Q} zh={zh} />
  {/* Q4 */}
  <MCQBlock q={MCQS[2]} zh={zh} />
  {/* Q5 (fill-in) */}
  <FillBlankBlock q={FILL_Q} zh={zh} />
  {/* Q6 (Parsons) */}
  <ParsonsBlock lines={PARSONS_LINES} zh={zh} />
</Box>

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
         
        </Box>

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
          <Tooltip title="模式">
            <IconButton size="medium" onClick={() => setIsModeDialogOpen(true)} sx={{ color: 'rgb(84, 83, 84)' }}>
              <TuneIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="移动">
            <IconButton size="medium" onClick={() => setTool('hand')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <PanToolIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="选择">
            <IconButton size="medium" onClick={() => setTool('selection')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <NavigationIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="矩形">
            <IconButton size="medium" onClick={() => setPendingInsertTool('rectangle')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CropSquareIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="椭圆">
            <IconButton size="medium" onClick={() => setPendingInsertTool('ellipse')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CircleOutlinedIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="箭头">
            <IconButton size="medium" onClick={() => setTool('arrow')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <ArrowRightAltIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="连线">
            <IconButton size="medium" onClick={() => setTool('line')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <HorizontalRuleIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="自由绘制">
            <IconButton size="medium" onClick={() => setTool('freedraw')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <CreateIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="文字">
            <IconButton size="medium" onClick={() => setTool('text')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <TextFieldsIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
          <Tooltip title="橡皮擦">
            <IconButton size="medium" onClick={() => setTool('eraser')} sx={{ color: 'rgb(84, 83, 84)' }}>
              <EraserIcon sx={{ fontSize: '36px', position: 'relative', top: -2 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="素材库">
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



       
        </div>
      </div>
      {/* Notes功能已集成到Story卡片中，不再需要单独的Modal */}
    </div>
  );
}
