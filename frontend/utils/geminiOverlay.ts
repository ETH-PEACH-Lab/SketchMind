// utils/geminiOverlayFull.ts
// import {
//   convertToExcalidrawElements,
//   type ExcalidrawImperativeAPI,
// } from "@excalidraw/excalidraw";
// ✅ type-only import is fine (erased at runtime)
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw';

// type CanvasPx = { width:number; height:number; offsetX?:number; offsetY?:number };
// type Position = { x:number; y:number };

// ... your GeminiPayload / toSkeletons(...) helpers stay the same



/* ============ 1. 把 Gemini 能描述的所有元素类型补齐 ============ */
type ElemCommon = {
  x_norm: number; // 0..1
  y_norm: number; // 0..1
  style?: {
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
    roughness?: number;
  };
  label?: string;
};

/* 矩形 / 椭圆 / 菱形 共享宽高属性 */
type SizeElem = ElemCommon & {
  w_norm: number;
  h_norm: number;
};

type RectElem   = SizeElem & { type: "rectangle" };
type EllipseElem = SizeElem & { type: "ellipse" };
type DiamondElem = SizeElem & { type: "diamond" };

type ArrowElem = ElemCommon & {
  type: "arrow";
  end_x_norm: number;
  end_y_norm: number;
};

type TextElem = ElemCommon & {
  type: "text";
  text: string;
  fontSize?: number;
};

type DrawElem = ElemCommon & {
  type: "draw";
  points: { x_norm: number; y_norm: number }[]; // 归一化的点序列
};

type LineElem = ElemCommon & {
  type: "line";
  points: { x_norm: number; y_norm: number }[];
};

type ImageElem = ElemCommon & {
  type: "image";
  w_norm: number;
  h_norm: number;
  fileId: string; // Excalidraw fileId
};

export type GeminiPayload = {
  elements: Array<
    | RectElem
    | EllipseElem
    | DiamondElem
    | ArrowElem
    | TextElem
    | DrawElem
    | LineElem
    | ImageElem
  >;
  notes?: string;
};

/* ============ 2. 画布像素信息 ============ */
export type CanvasPx = {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
};
export type Position = { x: number; y: number };

/* ============ 3. 工具函数 ============ */
function denorm(
  x: number,
  y: number,
  { width, height, offsetX = 0, offsetY = 0 }: CanvasPx,
) {
  return { x: Math.round(x * width + offsetX), y: Math.round(y * height + offsetY) };
}

/* ============ 4. 把 Gemini 元素 → Excalidraw Skeleton ============ */
function toSkeletons(payload: GeminiPayload, canvas: CanvasPx, P: Position) {
  const out: any[] = [];
  for (const el of payload.elements || []) {
    const base = {
      strokeColor: el.style?.strokeColor ?? "#000000",
      backgroundColor: el.style?.fillColor ?? "transparent",
      strokeWidth: el.style?.strokeWidth ?? 2,
      strokeStyle: el.style?.strokeStyle ?? "solid",
      roughness: el.style?.roughness ?? 1,
    };

    const pos = denorm(el.x_norm, el.y_norm, canvas);

    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
      case "image": {
        const w = Math.round(el.w_norm * canvas.width);
        const h = Math.round(el.h_norm * canvas.height);
        out.push({
          type: el.type,
          x: P.x + pos.x,
          y: P.y + pos.y,
          width: w,
          height: h,
          ...base,
          ...(el.type === "image" && { fileId: el.fileId }), // image 额外字段
          ...(el.label && { label: { text: el.label } }),
        });
        continue;
      }

      case "arrow": {
        const start = pos;
        const end = denorm(el.end_x_norm, el.end_y_norm, canvas);
        out.push({
          type: "arrow",
          x: P.x + start.x,
          y: P.y + start.y,
          width: end.x - start.x,
          height: end.y - start.y,
          ...base,
          endArrowhead: "none",
          ...(el.label && { label: { text: el.label } }),
        });
        continue;
      }

      case "text": {
        out.push({
          type: "text",
          x: P.x + pos.x,
          y: P.y + pos.y,
          text: el.text,
          fontSize: el.fontSize ?? 20,
          strokeColor: el.style?.strokeColor ?? "#000",
        });
        continue;
      }

      case "draw":
      case "line": {
        const points = el.points.map((pt) => {
          const p = denorm(pt.x_norm, pt.y_norm, canvas);
          return [p.x - pos.x, p.y - pos.y] as [number, number];
        });
        out.push({
          type: el.type,
          x: P.x + pos.x,
          y: P.y + pos.y,
          points,
          width: 0, // Excalidraw 会根据 points 自动计算包围盒
          height: 0,
          ...base,
        });
        continue;
      }

      default:
        // 未来再支持其它类型
        break;
    }
  }
  return out;
}

/* ============ 5. 增量追加到 Excalidraw ============ */
// export function applyGeminiElementsToExcalidraw(
//   api: ExcalidrawImperativeAPI,
//   payload: GeminiPayload,
//   canvas: CanvasPx,
//   P: Position,
// ) {
//   if (!payload?.elements?.length) return;
//   const skeletons = toSkeletons(payload, canvas, P);
//   console.log('Skeletons:', skeletons)
//   try {
//     const newEls = convertToExcalidrawElements(skeletons);
//     const cur = api.getSceneElements();
//     api.updateScene({ elements: [...cur, ...newEls] });
//   } catch (error) {
//     console.error('Error converting skeletons to Excalidraw elements:', error);
//   }
// }
export async function applyGeminiElementsToExcalidraw(
  api: ExcalidrawImperativeAPI,
  payload: GeminiPayload,
  canvas: CanvasPx,
  offset: Position
) {
  if (!payload?.elements?.length) return;
  if (typeof window === 'undefined') return; // guard against SSR

  // 👇 dynamic import on the client only
  const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');

  const skeletons = toSkeletons(payload, canvas, offset);
  const newEls = convertToExcalidrawElements(skeletons);
  api.updateScene({ elements: [...api.getSceneElements(), ...newEls] });
}