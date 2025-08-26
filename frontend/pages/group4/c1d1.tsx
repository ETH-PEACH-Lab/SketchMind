import dynamic from 'next/dynamic';
import { useState, useRef, useMemo, useEffect } from 'react';
import "@excalidraw/excalidraw/index.css"; 
import { IconButton, Tooltip, Box, Modal, Typography, Button, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material'
import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon, Explore, Book } from '@mui/icons-material'
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { injectSvgImagesAsLibraryItems } from "../utils/loadLibraryFromSVGImages";
import { applyGeminiElementsToExcalidraw, type GeminiPayload } from "../utils/geminiOverlay";

const BACKEND_URL = 'http://localhost:4000';

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

type StepScene = {
  elements: any[];
  files: any;
  appState?: any;
};

export default function Group1C1D1() {
  const [api, setApi] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [currentStepText, setCurrentStepText] = useState<string>(''); 
  const [notes, setNotes] = useState<string>('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [savedSteps, setSavedSteps] = useState<any[]>([]);
  const [mode, setMode] = useState<'story' | 'explore'>('story');
  
  const [currentGroup, setCurrentGroup] = useState(1);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [modeWindowPosition, setModeWindowPosition] = useState({ x: 96, y: 16 });
  const modeWindowDragging = useRef(false);
  const modeWindowOffset = useRef({ x: 0, y: 0 });

  const steps = useMemo(
      () =>
        [
          { stepText: "让我们开始吧！请画出两个链表：\n• 链表1: 1 → 2 → 4\n• 链表2: 1 → 3 → 4\n用方框和箭头来表示节点和连接。" },
          { stepText: "看看链表1和链表2的头节点（都是1）。\n我们应该先添加哪一个呢？\n用红色圆圈圈出你选择的头节点。" },
          { stepText: "现在开始画合并后的链表，从1开始（来自链表2）。\n然后从链表2中删除这个节点。" },
          { stepText: "比较新的头节点：链表1是1，链表2是3。\n哪一个应该放在合并链表的下一个位置？" },
          { stepText: "将链表1中的1添加到合并链表中。\n更新链表1，删除这个节点，然后继续。" },
          { stepText: "哪个节点更小：链表1中的2还是链表2中的3？\n选择更小的那个放在下一个位置。" },
          { stepText: "将更小的节点添加到合并链表中。\n相应地更新你的链表，并画出新的状态。" },
          { stepText: "在链表1的4和链表2的3之间，哪一个应该放在下一个位置？\n添加后画出更新后的合并链表。" },
          { stepText: "继续！合并下一个节点。\n在4和4之间选择后，画出更新后的链表。" },
          { stepText: "只剩下一个节点了。\n让我们将最后一个节点连接起来完成合并后的链表。" },
          { stepText: "干得漂亮！你已经逐步构建了合并后的链表。\n检查你的绘图，确保所有节点都已包含且顺序正确。" }
        ] as { stepText: string }[],
      []
  );

  const [stepStatuses, setStepStatuses] = useState<string[]>(Array(steps.length).fill("pending"));
  const [scenes, setScenes] = useState<Record<number, StepScene>>({});
  const currentStepIndexRef = useRef(0);

  useEffect(() => {
    if (excalidrawAPI) {
      const initialScene = {
        elements: [],
        files: {},
        appState: {}
      };
      setScenes(prev => ({ ...prev, 0: initialScene }));
    }
  }, [excalidrawAPI]);

  const handleStepChange = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    
    const currentElements = excalidrawAPI?.getSceneElements() || [];
    const currentFiles = excalidrawAPI?.getFiles() || {};
    const currentAppState = excalidrawAPI?.getAppState() || {};
    
    setScenes(prev => {
      const updatedScenes = { ...prev };
      updatedScenes[currentStepIndex] = {
        elements: currentElements,
        files: currentFiles,
        appState: currentAppState
      };
      
      if (updatedScenes[nextIndex]) {
        excalidrawAPI?.updateScene(updatedScenes[nextIndex]);
      } else {
        const previousScene = updatedScenes[currentStepIndex];
        if (previousScene) {
          const filteredElements = previousScene.elements.filter(el => 
            !(el.type === 'text' && (el.text?.includes('temp') || el.text?.includes('标注')))
          );
          const newScene = {
            elements: filteredElements,
            files: previousScene.files,
            appState: previousScene.appState
          };
          updatedScenes[nextIndex] = newScene;
          excalidrawAPI?.updateScene(newScene);
        }
      }
      
      return updatedScenes;
    });
    
    setCurrentStepIndex(nextIndex);
    currentStepIndexRef.current = nextIndex;
  };

  const handleModeWindowMouseDown = (e: React.MouseEvent) => {
    modeWindowDragging.current = true;
    modeWindowOffset.current = {
      x: e.clientX - modeWindowPosition.x,
      y: e.clientY - modeWindowPosition.y
    };
  };

  const handleModeWindowMouseMove = (e: MouseEvent) => {
    if (modeWindowDragging.current) {
      setModeWindowPosition({
        x: e.clientX - modeWindowOffset.current.x,
        y: e.clientY - modeWindowOffset.current.y
      });
    }
  };

  const handleModeWindowMouseUp = () => {
    modeWindowDragging.current = false;
  };

  useEffect(() => {
    if (modeWindowDragging.current) {
      document.addEventListener('mousemove', handleModeWindowMouseMove);
      document.addEventListener('mouseup', handleModeWindowMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleModeWindowMouseMove);
        document.removeEventListener('mouseup', handleModeWindowMouseUp);
      };
    }
  }, [modeWindowDragging.current]);

  const selectedText = steps[currentStepIndex]?.stepText || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
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
                variant="contained"
                fullWidth
                onClick={() => window.location.href = '/'}
                sx={{
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                }}
              >
                演示
              </Button>
              
              <Box
                sx={{
                  height: 1,
                  bgcolor: 'divider',
                  my: 1,
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              />
              
              测试组
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
                    组1
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group1/c1d1'}
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
                      C1D1
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group1/c2d2'}
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
                      C2D2
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
                    组2
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group2/c2d2'}
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
                      C2D2
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group2/c1d1'}
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
                      C1D1
                    </Button>
                  </Box>
                </Box>

                {/* 组3 */}
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
                    组3
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group3/c1d2'}
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
                      C1D2
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group3/c2d1'}
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
                      C2D1
                    </Button>
                  </Box>
                </Box>

                {/* 组4 */}
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
                    组4
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group4/c2d1'}
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
                      C2D1
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => window.location.href = '/group4/c1d2'}
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
                      C1D2
                    </Button>
                  </Box>
                </Box>
            </Box>
          </Box>
        </Box>

        {/* 内容区域 */}
        <div className="flex-1 flex">
          {/* 左侧内容 */}
          <div className="w-2/5 relative bg-gray-100">
            <MarkdownWithDrawing markdown={selectedText} />
          </div>

          {/* 右侧内容 */}
          <div className="w-3/5 bg-white relative">
            {/* 右栏悬浮按钮组 */}
            <Box
              sx={{
                position: 'absolute',
                top: modeWindowPosition.y,
                left: modeWindowPosition.x,
                zIndex: 1000,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: 3,
                p: 1,
                cursor: 'move',
                userSelect: 'none',
                '&:hover': {
                  boxShadow: 4,
                },
              }}
              onMouseDown={handleModeWindowMouseDown}
            >
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(e, newMode) => {
                  if (newMode !== null) {
                    setMode(newMode);
                  }
                }}
                size="small"
              >
                <ToggleButton value="story">
                  <Tooltip title="故事模式">
                    <Book />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="explore">
                  <Tooltip title="探索模式">
                    <Explore />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {mode === 'story' ? (
              <StoryPlayer
                steps={steps}
                currentStepIndex={currentStepIndex}
                onStepChange={handleStepChange}
                stepStatuses={stepStatuses}
                setStepStatuses={setStepStatuses}
                excalidrawAPI={excalidrawAPI}
                onCheck={async () => {
                  // 这里可以添加验证逻辑
                  return { isValid: true };
                }}
                onNextDraw={async () => {
                  // 这里可以添加下一步绘制逻辑
                }}
              />
            ) : (
              <ExploreMode
                excalidrawAPI={excalidrawAPI}
                onSave={(elements, files, appState) => {
                  console.log('Saved:', { elements, files, appState });
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
