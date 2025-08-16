import dynamic from 'next/dynamic';
import { useState, useRef, useMemo, useEffect } from 'react';
// import StoryPlayer from '../components/StoryPlayer';
import "@excalidraw/excalidraw/index.css"; 
// 顶部先引入 MUI 组件
import { IconButton, Tooltip, Box, Modal, Typography, Button } from '@mui/material'
import { CheckCircle as CheckIcon, Lightbulb, ArrowForwardIos as NextIcon } from '@mui/icons-material'
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
// import { loadLibraryFromSVGImages } from "../utils/loadLibraryFromSVGImages";
import { injectSvgImagesAsLibraryItems } from "../utils/loadLibraryFromSVGImages";
// import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
// import { validateGeminiOverlayResponse } from '../utils/geminiTypes';
// import { applyGeminiOverlayToExcalidraw } from '../utils/geminiOverlay';
import { applyGeminiElementsToExcalidraw, type GeminiPayload } from "../utils/geminiOverlay";
// import { useSession } from 'next-auth/react';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const StoryPlayer = dynamic(() => import('../components/StoryPlayer'), {
  ssr: false
})

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const MarkdownWithDrawing = dynamic(() => import('../components/MarkdownWithDrawing'), { ssr: false });
// const SVGWhiteboard = dynamic(() => import('../components/SVGWhiteboard'), { ssr: false });

type StepScene = {
  elements: any[];
  files: any;
  appState?: any;
};

export default function Home() {
  const [api, setApi] = useState(null);
  // const [steps, setSteps] = useState<any[]>([])
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [currentStepText, setCurrentStepText] = useState<string>(''); 
  const [notes, setNotes] = useState<string>('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // 添加保存状态
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // 当前 step 的 index
  const [savedSteps, setSavedSteps] = useState<any[]>([]); // 保存的步骤内容
  const steps = useMemo(
      () =>
        [
          { stepText: "Let's begin! Please draw two linked lists:\n• list1: 1 → 2 → 4\n• list2: 1 → 3 → 4\nUse boxes and arrows to represent the nodes and connections." },
          { stepText: "Look at the heads of list1 and list2 (both are 1). \nWhich one should we add first? \nCircle the chosen head in red." },
          { stepText: "Now draw the merged list starting with 1 (from list2).\nThen remove this node from list2." },
          { stepText: "Compare the new heads: list1 is 1, list2 is 3.\nWhich one goes next in the merged list?" },
          { stepText: "Add the 1 from list1 to the merged list.\nUpdate list1 to remove this node, and keep going." },
          { stepText: "Which node is smaller: 2 (list1) or 3 (list2)?\nChoose the smaller one to add next." },
          { stepText: "Add the smaller node to the merged list.\nUpdate your lists accordingly and draw the new state." },
          { stepText: "Between 4 (list1) and 3 (list2), which one should go next?\nDraw the updated merged list after adding it." },
          { stepText: "Keep going! Merge the next node.\nDraw the updated list after choosing between 4 and 4." },
          { stepText: "Only one node left.\nLet’s connect the last node to finish the merged list." },
           { stepText: "Great job! You've built the merged list step by step.\nCheck your drawing to make sure all nodes are included and correctly ordered." },
        ] as { stepText: string }[],
      []
  );

  const [stepStatuses, setStepStatuses] = useState<string[]>(Array(steps.length).fill("pending"));

  // 用 index->scene 的 map 存每步画布
  const [scenes, setScenes] = useState<Record<number, StepScene>>({});
  const currentStepIndexRef = useRef(0);

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
      });
  }, [excalidrawAPI]);

  // 初始 step 的空白场景
  useEffect(() => {
    if (!excalidrawAPI) return;
    // 初始化第0步（若没有已存）
    if (!scenes[0]) {
      excalidrawAPI.updateScene({
        elements: [],
        appState: { viewBackgroundColor: "#fff" },
        captureUpdate: 2, // CaptureUpdateAction.NEVER (不入undo)；不传也行
      });
      setScenes((prev) => ({
        ...prev,
        0: { elements: [], files: {}, appState: { viewBackgroundColor: "#fff" } },
      }));
    }
  }, [excalidrawAPI]); // eslint-disable-line

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

  // 保存当前场景
  const saveCurrentScene = () => {
    if (!excalidrawAPI) return;
    const idx = currentStepIndexRef.current;
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const appState = excalidrawAPI.getAppState();
    setScenes((prev) => ({
      ...prev,
      [idx]: { elements, files, appState },
    }));
  };

  // 切换步骤：先保存旧的，再加载新的
  const handleStepChange = (stepText: string, nextIndex: number) => {
    if (!excalidrawAPI) return;
    // 保存旧场景
    saveCurrentScene();
    currentStepIndexRef.current = nextIndex;

    // 更新当前步骤文本
    setCurrentStepText(stepText);
    setCurrentStepIndex(nextIndex);

    // 保持 stepStatuses 长度一致
  setStepStatuses((prev) => {
    const next = Array(steps.length).fill("pending");
    for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
    return next;
  });

    // 载入目标场景（若没有则空白）
    const scene = scenes[nextIndex] ?? {
      elements: [],
      files: {},
      appState: { viewBackgroundColor: "#fff" },
    };

    excalidrawAPI.updateScene({
      elements: scene.elements,
      appState: scene.appState,
      collaborators: new Map(),
      captureUpdate: 2, // NEVER；不进 undo
    });
  };

  // 示例按钮：Check = 保存当前 step
  const onCheck = async () => {
    saveCurrentScene();
    if (!excalidrawAPI) return
    // const { exportToBlob, exportToSvg } = await import('@excalidraw/excalidraw');
    const elements = excalidrawAPI.getSceneElements();
    if (!elements?.length) {
      alert('Canvas is empty.');
      return;
    }
    // 1) 计算场景外接框（导出前做一遍，随 PNG 一起保存 meta）
    function getSceneAABB(elements: any[]) {
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
    const W = 1200, H = 800, PADDING = 0;
    // ...导出前：
    // const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const { minX, minY, maxX, maxY } = getSceneAABB(elements);
    const frameW = (maxX - minX) + 2 * PADDING;
    const frameH = (maxY - minY) + 2 * PADDING;
    const scale  = Math.min(W / frameW, H / frameH);
    const marginX = (W - scale * frameW) / 2;
    const marginY = (H - scale * frameH) / 2;
    const frameX0 = minX - PADDING;
    const frameY0 = minY - PADDING;

    const exportMeta = { W, H, PADDING, frameX0, frameY0, frameW, frameH, scale, marginX, marginY };
    console.log(exportMeta)
    // 用与上面完全一致的参数导出 PNG
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const blob = await exportToBlob({
      elements,
      files,
      appState: { exportWithDarkMode: false, exportEmbedScene: false, viewBackgroundColor: '#fff' },
      getDimensions: () => ({ width: frameW, height: frameH, scale: 1 }),
      exportPadding: PADDING,
    });
    // 把 PNG + exportMeta 一起发后端（或留在前端，等返回再用）

    // const fd = new FormData();
    // fd.append("image", blob, `sketch_${Date.now()}.png`);

    try {
    // const resp = await fetch(`${BACKEND_URL}/save-png`, { method: 'POST', body: fd });
    // if (!resp.ok) {
    //   throw new Error('Upload failed');
    // }
    // const { path } = await resp.json();
    const base64 = await blobToBase64(blob);
    // console.log('Image base64:', base64); // 打印保存的图片路径
    // console.log('Step text:', currentStepText); // 打印步骤文本

    const analyze = await fetch(`${BACKEND_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64,
        stepText: currentStepText,
      }),
    });

    if (!analyze.ok) {
      throw new Error('Validation failed');
    }

    const validationData = await analyze.json();
    console.log('Validation result:', validationData);
    setNotes(
  (validationData.isValid ? "✅ Correct!\n" : "❌ Incorrect.\n") +
  (validationData.message || "")
);
    setIsNotesOpen(true);

    setStepStatuses(prev => {
      const next = [...prev];
      next[currentStepIndex] = validationData.isValid ? 'correct' : 'wrong';
      return next;
    });
// 返回验证结果数组
    return validationData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(errorMessage);
    alert(`Error: ${errorMessage}`);
    return;
  }
};

  const selectedText = `
  # 🧠 LeetCode 21: Merge Two Sorted Lists

  ## 📋 Problem Description

  You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

  Merge the two lists into one **sorted** list. The list should be made by **splicing together** the nodes of the first two lists. Return the head of the merged linked list.

  ---

  ### Example

  \`\`\`
  Input: list1 = [1,2,4], list2 = [1,3,4]
  \`\`\`

  ### Constraints

  - The number of nodes in both lists is in the range \`[0, 50]\`.
  - \`-100 <= Node.val <= 100\`
  - Both \`list1\` and \`list2\` are sorted in **non-decreasing order**.

  ---

  <details>
  <summary>✅ Approach 1: Recursion</summary>

  ### Intuition

  We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):


  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0] \n
  list2[0] + merge(list1, list2[1:])  otherwise


  Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.

  ### Algorithm

  We model the above recurrence directly, first accounting for edge cases. Specifically, if either of l1 or l2 is initially null, there is no merge to perform, so we simply return the non-null list. Otherwise, we determine which of l1 and l2 has a smaller head, and recursively set the next value for that head to the next merge result. Given that both lists are null-terminated, the recursion will eventually terminate.

  </details>

  ---

  <details>
  <summary>✅ Approach 2: Iteration</summary>

  ### Intuition

  We can achieve the same idea via iteration by assuming that l1 is entirely less than l2 and processing the elements one-by-one, inserting elements of l2 in the necessary places in l1.

  ### Algorithm

  First, we set up a false "prehead" node that allows us to easily return the head of the merged list later. We also maintain a prev pointer, which points to the current node for which we are considering adjusting its next pointer. Then, we do the following until at least one of l1 and l2 points to null: if the value at l1 is less than or equal to the value at l2, then we connect l1 to the previous node and increment l1. Otherwise, we do the same, but for l2. Then, regardless of which list we connected, we increment prev to keep it one step behind one of our list heads.

  After the loop terminates, at most one of l1 and l2 is non-null. Therefore (because the input lists were in sorted order), if either list is non-null, it contains only elements greater than all of the previously-merged elements. This means that we can simply connect the non-null list to the merged list and return it.

  To see this in action on an example, check out the animation below:

  <!-- animation-slot -->
  </details>
  `;
  const handleNotesClose = () => {
      setIsNotesOpen(false);
    };
  const onNextDraw = async () => {
    if (!excalidrawAPI) return
    // const { exportToBlob, exportToSvg } = await import('@excalidraw/excalidraw');
    const elements = excalidrawAPI.getSceneElements();
    if (!elements?.length) {
      alert('Canvas is empty.');
      return;
    }
    // 1) 计算场景外接框（导出前做一遍，随 PNG 一起保存 meta）
    function getSceneAABB(elements: any[]) {
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
    const W = 1200, H = 800, PADDING = 0;
    // ...导出前：
    // const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const { minX, minY, maxX, maxY } = getSceneAABB(elements);
    const frameW = (maxX - minX) + 2 * PADDING;
    const frameH = (maxY - minY) + 2 * PADDING;
    const scale  = Math.min(W / frameW, H / frameH);
    const marginX = (W - scale * frameW) / 2;
    const marginY = (H - scale * frameH) / 2;
    const frameX0 = minX - PADDING;
    const frameY0 = minY - PADDING;

    const exportMeta = { W, H, PADDING, frameX0, frameY0, frameW, frameH, scale, marginX, marginY };
    console.log(exportMeta)
    // 用与上面完全一致的参数导出 PNG
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const blob = await exportToBlob({
      elements,
      files,
      appState: { exportWithDarkMode: false, exportEmbedScene: false, viewBackgroundColor: '#fff' },
      getDimensions: () => ({ width: frameW, height: frameH, scale: 1 }),
      exportPadding: PADDING,
    });
    // 把 PNG + exportMeta 一起发后端（或留在前端，等返回再用）

    const base64 = await blobToBase64(blob);
    // const fd = new FormData();
    // fd.append("image", blob, `sketch_${Date.now()}.png`);

    // // 1) 上传 PNG
    // const resp = await fetch(`${BACKEND_URL}/save-png`, { method: 'POST', body: fd });
    // if (!resp.ok) {
    //   console.error('upload failed');
    //   return;
    // }
    // const { path } = await resp.json(); // 例如: /uploads/sketch_***.png

    // 2) 调用后端分析接口
    const analyze = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        base64,   // 你保存的本地 png 路径，比如 backend/save-png 返回的绝对/相对路径
        w: frameW,         // 你导出 PNG 时固定的宽
        h: frameH,         // 你导出 PNG 时固定的高
        stepText:   currentStepText // 可选：给模型的当前步骤提示
      })
    });


    if (!analyze.ok) {
      console.error('analyze failed');
      return;
    }

    const data = await analyze.json();
    console.log("return gemini data", data.payload)
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
    // let parsed;
    try {
      console.log('payload:', data.payload);
      applyGeminiElementsToExcalidraw(excalidrawAPI, data.payload, {
      width: frameW,  // 这里请用你导出 PNG 的固定尺寸
      height: frameH,
    },{x: frameX0,  // 这里请用你导出 PNG 的固定尺寸
      y: frameY0,});
      setNotes(data.payload.notes);
      setIsNotesOpen(true);
      // parsed = validateGeminiOverlayResponse(raw);
    } catch (e) {
      console.error('invalid overlay json', e);
      return;
    }
    // // console.log("notes:", data.notes);
      }
    
  return (
    <div className="flex h-screen">
      {/* Left side */}
      <div className="w-2/5 relative bg-gray-100">
        <MarkdownWithDrawing markdown={selectedText} />
      </div>

      {/* Right side */}
      <div className="w-3/5 bg-white relative">
      {/* 右栏悬浮按钮组 */}
        {/* <Box
          position="absolute"
          top={8}
          left={100}            // ✅ 靠左
          zIndex={10}
          bgcolor="rgba(255,255,255,0.9)"
          borderRadius={1}
          boxShadow={1}
          display="flex"
          gap={1}
        >
          <Tooltip title="Check (save this step)">
            <IconButton color="primary" onClick={onCheck}>
              <CheckIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next Draw (overlay from backend)">
            <IconButton color="success" onClick={onNextDraw}>
              <Lightbulb />
            </IconButton>
          </Tooltip>
        </Box> */}

        <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} />
        {/* <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} /> */}
        <StoryPlayer steps={steps} 
        onStepChange={handleStepChange} 
        stepStatuses={stepStatuses}
        setStepStatuses={setStepStatuses}
        onCheck={onCheck}
        onNextDraw={onNextDraw}
  />

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
                  elements: savedStep.elements,
                  files: savedStep.files,
                });
              }
            }}
          />
        )} */}
      </div>
      {/* Notes Modal */}
        {isNotesOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            zIndex: 1000,
          }}
        >
          <Typography variant="h6" component="h2">
            Notes
          </Typography>
          <Typography sx={{ mt: 2 }}>
            {notes}
          </Typography>
          <Button onClick={handleNotesClose} variant="contained" color="primary" sx={{ mt: 2 }}>
            Close
          </Button>
        </Box>
      )}
    </div>
  );
}
