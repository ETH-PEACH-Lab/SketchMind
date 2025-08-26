import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

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
  // 使用浮点精度，避免提前取整导致位置误差
  return { x: x * width + offsetX, y: y * height + offsetY };
}

/* ============ 4. 把 Gemini 元素 → Excalidraw Skeleton ============ */
function toSkeletons(payload: GeminiPayload, canvas: CanvasPx, P: Position) {
  const out: any[] = [];
  try {
    console.groupCollapsed('[AI Overlay] toSkeletons: canvas + offset');
    console.log('canvas', canvas);
    console.log('offset(P)', P);
    console.log('elements.count', payload?.elements?.length || 0);
  } catch {}
  for (const el of payload.elements || []) {
    const hasAbsRect = typeof (el as any).x === 'number' && typeof (el as any).y === 'number' && (typeof (el as any).w === 'number' || typeof (el as any).width === 'number') && (typeof (el as any).h === 'number' || typeof (el as any).height === 'number');
    const hasAbsArrow = typeof (el as any).x === 'number' && typeof (el as any).y === 'number' && typeof (el as any).end_x === 'number' && typeof (el as any).end_y === 'number';
    const hasAbsText = typeof (el as any).x === 'number' && typeof (el as any).y === 'number' && (el as any).type === 'text';
    const hasAbsPoly = Array.isArray((el as any).points) && (el as any).points.length && typeof (el as any).points[0]?.x === 'number' && typeof (el as any).points[0]?.y === 'number';
    const base = {
      strokeColor: el.style?.strokeColor ?? "#000000",
      backgroundColor: el.style?.fillColor ?? "transparent",
      strokeWidth: el.style?.strokeWidth ?? 2,
      // 强制统一 AI 生成样式：虚线 + 50% 透明
      strokeStyle: "dashed" as const,
      roughness: el.style?.roughness ?? 1,
      opacity: 50,
    } as const;

    const pos = denorm(el.x_norm ?? 0, el.y_norm ?? 0, canvas);
    try {
      console.log('[AI Overlay] map element', {
        type: (el as any)?.type,
        x_norm: (el as any)?.x_norm,
        y_norm: (el as any)?.y_norm,
        w_norm: (el as any)?.w_norm,
        h_norm: (el as any)?.h_norm,
        start: pos,
      });
    } catch {}

    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
      case "image": {
        const w = hasAbsRect ? Math.round(((el as any).w ?? (el as any).width) as number) : Math.round((el as any).w_norm * canvas.width);
        const h = hasAbsRect ? Math.round(((el as any).h ?? (el as any).height) as number) : Math.round((el as any).h_norm * canvas.height);
        try {
          console.log('  -> shape wh(px)', { w, h });
        } catch {}
        out.push({
          type: el.type,
          x: hasAbsRect ? (el as any).x : P.x + pos.x,
          y: hasAbsRect ? (el as any).y : P.y + pos.y,
          width: w,
          height: h,
          ...base,
          ...(el.type === "image" && { fileId: (el as any).fileId }), // image 额外字段
          ...(el.label && { label: { text: el.label } }),
        });
        // 若有 label，则附加一个文本元素（50% 透明），放在形状中心附近
        if (el.label) {
          out.push({
            type: "text",
            x: (hasAbsRect ? ((el as any).x as number) : (P.x + pos.x)) + Math.round(w / 2),
            y: (hasAbsRect ? ((el as any).y as number) : (P.y + pos.y)) + Math.round(h / 2),
            text: el.label,
            fontSize: (el as any).fontSize ?? 20,
            strokeColor: el.style?.strokeColor ?? "#000",
            opacity: 50,
          });
        }
        continue;
      }

      case "arrow": {
        const start = hasAbsArrow ? { x: (el as any).x as number, y: (el as any).y as number } : pos;
        const end = hasAbsArrow ? { x: (el as any).end_x as number, y: (el as any).end_y as number } : denorm((el as any).end_x_norm, (el as any).end_y_norm, canvas);
        try {
          console.log('  -> arrow', { start, end, endArrowhead: (el as any)?.style?.endArrowhead ?? null });
        } catch {}
        out.push({
          type: "arrow",
          x: hasAbsArrow ? start.x : P.x + start.x,
          y: hasAbsArrow ? start.y : P.y + start.y,
          width: end.x - start.x,
          height: end.y - start.y,
          ...base,
          endArrowhead: (el as any)?.style?.endArrowhead ?? null,
          // startArrowhead: null,
          ...(el.label && { label: { text: el.label } }),
        });
        if (el.label) {
          // 将箭头的 label 文本放在箭头中点附近
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          out.push({
            type: "text",
            x: (hasAbsArrow ? midX : (P.x + Math.round(midX))),
            y: (hasAbsArrow ? midY : (P.y + Math.round(midY))),
            text: el.label,
            fontSize: (el as any).fontSize ?? 20,
            strokeColor: el.style?.strokeColor ?? "#000",
            opacity: 50,
          });
        }
        continue;
      }

      case "text": {
        out.push({
          type: "text",
          x: hasAbsText ? (el as any).x : (P.x + pos.x),
          y: hasAbsText ? (el as any).y : (P.y + pos.y),
          text: (el as any).text,
          fontSize: (el as any).fontSize ?? 20,
          strokeColor: el.style?.strokeColor ?? "#000",
          opacity: 50,
        });
        continue;
      }

      case "draw":
      case "line": {
        const points = hasAbsPoly
          ? (el as any).points.map((pt: any) => [pt.x, pt.y] as [number, number])
          : (el as any).points.map((pt: any) => {
          const p = denorm(pt.x_norm, pt.y_norm, canvas);
          return [p.x - pos.x, p.y - pos.y] as [number, number];
        });
        try { console.log('  -> poly points.count', points.length); } catch {}
        out.push({
          type: el.type,
          x: hasAbsPoly ? 0 : (P.x + pos.x),
          y: hasAbsPoly ? 0 : (P.y + pos.y),
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
  try { console.groupEnd(); } catch {}
  return out;
}

/* ============ 5. 增量追加到 Excalidraw ============ */
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

  // 去重：避免同一批/重复调用导致叠加相同元素
  const existing = api.getSceneElements() as any[];
  const nearlyEqual = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps;
  const isDup = (a: any, b: any) => {
    if (a.type !== b.type) return false;
    if (a.type === 'text') {
      return nearlyEqual(a.x, b.x) && nearlyEqual(a.y, b.y) && ((a as any).text || '') === ((b as any).text || '');
    }
    // 形状/箭头等：比较位置和尺寸
    return nearlyEqual(a.x, b.x) && nearlyEqual(a.y, b.y)
      && nearlyEqual((a as any).width || 0, (b as any).width || 0)
      && nearlyEqual((a as any).height || 0, (b as any).height || 0);
  };
  const deduped = (newEls as any[]).filter((n: any) => !existing.some((e: any) => isDup(n, e)));

  try {
    console.groupCollapsed('[AI Overlay] apply');
    console.log('existing.count', existing.length);
    console.log('skeletons.count', skeletons.length);
    console.log('newEls.count', (newEls as any[])?.length || 0);
    console.log('deduped.count', deduped.length);
    console.groupEnd();
  } catch {}

  if (!deduped.length) return;
  api.updateScene({ elements: [...existing, ...deduped] });
}
