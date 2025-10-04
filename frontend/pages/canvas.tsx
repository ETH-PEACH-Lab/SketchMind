import { useEffect, useRef, useState } from 'react';

// A minimal, dependency-free, full-screen canvas whiteboard.
// Features: freehand pen (mouse/touch), color & size, undo, clear, export.
export default function CanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<HTMLDivElement | null>(null); // inner drawing area
  const dprRef = useRef<number>(1);
  const DEFAULT_SHAPE_SIZE = 80;
  const GUIDE_RECT_WIDTH = 64;  // Same as node width
  const GUIDE_RECT_HEIGHT = 40; // Same as node height
  const [color, setColor] = useState<string>('#1e1e1e');
  const [size, setSize] = useState<number>(3);
  const [tool, setTool] = useState<'select'|'pen'|'rect'|'ellipse'|'triangle'|'line'|'text'|'eraser'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  type Path = { id: string; color: string; size: number; points: Array<{x:number;y:number}> };
  const [paths, setPaths] = useState<Path[]>([]);
  const currentPathRef = useRef<Path | null>(null);
  type Shape = { id: string; type: 'rect'|'ellipse'|'triangle'|'text'; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; label?: string; labelSize?: number; locked?: boolean };
  const [shapes, setShapes] = useState<Shape[]>([]);
  // During drag, we draw from this ref for instant visual feedback, then commit to state on end
  const renderShapesRef = useRef<Shape[] | null>(null);
  const draftShapeRef = useRef<Shape | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<null | 'shape' | 'path' | 'line'>(null);
  const selectionDragRef = useRef<null | { mode: 'move'|'resize'; handle: number|null; start:{x:number;y:number}; orig: Shape }>(null);
  const selectionDragLineRef = useRef<null | { mode: 'move'|'endpoint'; handle: 0|1|null; start:{x:number;y:number}; orig: Line }>(null);
  const [shakingNodeIds, setShakingNodeIds] = useState<string[]>([]);
  const shakeOffsetRef = useRef(0);
  // Highlighted recursion branch (t2) and animation time
  const highlightedLabelRef = useRef<string>('list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]');
  const highlightStartRef = useRef<number | null>(null);
  const animTimeRef = useRef<number>(0);
  // Ghost check indicator while waiting for user to draw
  const ghostCheckRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  // Track the correct/incorrect first nodes for validation
  const correctFirstNodeRef = useRef<string | null>(null);
  const incorrectFirstNodeRef = useRef<string | null>(null);
  const [selectionError, setSelectionError] = useState<boolean>(false);
  // Intro animation state: guide user to draw circle around merged result
  const [guideAnimationProgress, setGuideAnimationProgress] = useState<number>(0);
  const guideAnimationRef = useRef<boolean>(false);
  const mergedNodeIdRef = useRef<string | null>(null);
  const guideAnimationStartTime = useRef<number>(0);
  const guideTrailPoints = useRef<Array<{x: number; y: number; age: number}>>([]);
  const userCreatedRectRef = useRef<boolean>(false);
  const finalCycleStartTimeRef = useRef<number>(0);
  const [showNumberHint, setShowNumberHint] = useState<boolean>(false);
  const numberHintStartTimeRef = useRef<number>(0);
  const userCreatedRectIdRef = useRef<string | null>(null);
  const [showArrowAnimation, setShowArrowAnimation] = useState<boolean>(false);
  const arrowAnimationProgressRef = useRef<number>(0);
  const numberRecognizedRef = useRef<boolean>(false);
  const t2TextIdRef = useRef<string | null>(null);
  const t1TextIdRef = useRef<string | null>(null);
  const [showColorSelection, setShowColorSelection] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const userDrawnPathsRef = useRef<string[]>([]); // Store path IDs drawn by user in the rect
  const [showErrorHighlight, setShowErrorHighlight] = useState<boolean>(false);
  const errorHighlightStartRef = useRef<number>(0);
  const mergeStepRef = useRef<number>(0); // Track current merge step
  const s1IdsRef = useRef<string[]>([]); // Store list1 node IDs
  const s2IdsRef = useRef<string[]>([]); // Store list2 node IDs
  const nextStepTriggeredRef = useRef<boolean>(false); // Prevent multiple triggers
  const mergedNodesRef = useRef<Shape[]>([]); // Store merged nodes for connecting arrows
  const numberRecognitionTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for delayed recognition
  const pendingPathsForRecognitionRef = useRef<Path[]>([]); // Paths waiting for recognition
  const [showFireworks, setShowFireworks] = useState<boolean>(false);
  const fireworksRef = useRef<Array<{x: number; y: number; particles: Array<{x: number; y: number; vx: number; vy: number; life: number; color: string}>}>>([])
  // Helper: read scaffolding mode from window or localStorage
  const getScaffoldingMode = (): string | undefined => {
    try {
      const w = (window as any);
      if (w && typeof w.sketchMindScaffoldingMode !== 'undefined') return w.sketchMindScaffoldingMode;
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('sketchMindScaffoldingMode');
        return v || undefined;
      }
    } catch {}
    return undefined;
  };
  // In High mode: user can click two shaking head nodes to mark them as first picks
  const [firstPickIds, setFirstPickIds] = useState<string[]>([]);
  const pointInRect = (s: Shape, p: {x:number;y:number}) => {
    const x1 = Math.min(s.x, s.x + s.w);
    const x2 = Math.max(s.x, s.x + s.w);
    const y1 = Math.min(s.y, s.y + s.h);
    const y2 = Math.max(s.y, s.y + s.h);
    return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
  };
  // History stacks for undo/redo
  type Snap = { shapes: Shape[]; lines: Line[]; paths: Path[]; firstPickIds: string[]; shakingNodeIds: string[] };
  const [history, setHistory] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const dragDirtyRef = useRef(false);
  const snapshot = (): Snap => ({
    shapes: JSON.parse(JSON.stringify(shapes)),
    lines: JSON.parse(JSON.stringify(lines)),
    paths: JSON.parse(JSON.stringify(paths)),
    firstPickIds: [...firstPickIds],
    shakingNodeIds: [...shakingNodeIds],
  });
  const recordBeforeChange = () => {
    const s = snapshot();
    setHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(s)) return prev; // avoid duplicate snapshots
      return [...prev, s];
    });
    setFuture([]);
  };
  const applySnap = (s: Snap) => {
    setShapes(s.shapes);
    setLines(s.lines);
    setPaths(s.paths);
    setFirstPickIds(s.firstPickIds || []);
    setShakingNodeIds(s.shakingNodeIds || []);
    setSelectedId(null);
    setSelectedKind(null);
    selectionDragRef.current = null;
    selectionDragLineRef.current = null;
    renderShapesRef.current = null;
    // cancel any drafts/in-progress drawing so they don't overlay after undo/redo
    currentPathRef.current = null;
    draftShapeRef.current = null;
    draftLineRef.current = null;
    setIsDrawing(false);
    setTool('select');
    // Redraw will be triggered by the main useEffect
  };

  const undoAll = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]; // previous state
      const cur = snapshot(); // current state goes to future
      setFuture(f => [cur, ...f]);
      applySnap(last);
      return prev.slice(0, -1);
    });
  };
  const redoAll = () => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const cur = snapshot();
      const next = prev[0];
      setHistory(h => [...h, cur]);
      applySnap(next);
      return prev.slice(1);
    });
  };
  // Visible pointer for tablet
  const [cursorPos, setCursorPos] = useState<{x:number;y:number}>({x:0,y:0});
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);
  const showCursor = (p?: {x:number;y:number}) => {
    if (p) setCursorPos(p);
    setCursorVisible(true);
  };
  // one-time default shape insertion flag
  const defaultInsertedRef = useRef<boolean>(false);
  const [shakeOverlay, setShakeOverlay] = useState<null | { x:number; y:number; w:number; h:number }>(null);
  // annotations for titles and notes
  type Annotation = { id: string; x: number; y: number; text: string; size: number; color: string };
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const initLayoutRef = useRef<null | { originX:number; originY:number; nodeW:number; nodeH:number; gapX:number; gapY:number; totalW:number; totalH:number }>(null);
  // Text input overlay state
  const [textInput, setTextInput] = useState<null | { x:number; y:number; value:string }>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const erasedThisDragRef = useRef(false);
  const textCommittingRef = useRef(false);

  // helper: measure text width with given font size
  const measureTextWidth = (text: string, fontSize: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return text.length * fontSize * 0.6;
    ctx.save();
    ctx.font = `${fontSize}px "Comic Sans MS", "Segoe UI", ui-sans-serif`;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  };

  const drawPathSelection = (ctx: CanvasRenderingContext2D, p: Path) => {
    const b = getPathBounds(p);
    if (!b) return;
    ctx.save();
    ctx.setLineDash([6,4]);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  };

  const getPathBounds = (p: Path) => {
    if (!p.points.length) return null;
    let minX = p.points[0].x, maxX = p.points[0].x;
    let minY = p.points[0].y, maxY = p.points[0].y;
    for (const pt of p.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    // pad by stroke size for easier selection
    const pad = Math.max(6, p.size);
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad*2, h: (maxY - minY) + pad*2 };
  };

  // Hand-drawn helpers (rounded rect path + double-pass jitter stroke)
  const roundedRectPath = (ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) => {
    const rr = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.lineTo(x+w-rr, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
    ctx.lineTo(x+w, y+h-rr);
    ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
    ctx.lineTo(x+rr, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
    ctx.lineTo(x, y+rr);
    ctx.quadraticCurveTo(x, y, x+rr, y);
  };

  const handStroke = (ctx: CanvasRenderingContext2D, draw: () => void) => {
    ctx.save();
    draw();
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.translate(0.4, 0.2);
    draw();
    ctx.stroke();
    ctx.restore();
  };

  // Draw a line with optional dashes and arrowheads
  const drawLine = (ctx: CanvasRenderingContext2D, l: { x1:number; y1:number; x2:number; y2:number; stroke:string; strokeWidth:number; dashed:boolean; arrowStart:boolean; arrowEnd:boolean }) => {
    ctx.save();
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.strokeWidth;
    ctx.setLineDash(l.dashed ? [8,6] : []);
    const drawSeg = () => { ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); };
    handStroke(ctx, drawSeg);

    const drawArrowHead = (x1:number,y1:number,x2:number,y2:number) => {
      const angle = Math.atan2(y2-y1, x2-x1);
      const len = Math.max(10, 4 + l.strokeWidth*2);
      const drawHead = () => {
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - len*Math.cos(angle - Math.PI/6), y2 - len*Math.sin(angle - Math.PI/6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - len*Math.cos(angle + Math.PI/6), y2 - len*Math.sin(angle + Math.PI/6));
      };
      handStroke(ctx, drawHead);
    };
    if (l.arrowEnd) drawArrowHead(l.x1,l.y1,l.x2,l.y2);
    if (l.arrowStart) drawArrowHead(l.x2,l.y2,l.x1,l.y1);
    ctx.restore();
  };

  // Selection box for lines
  const drawLineSelection = (ctx: CanvasRenderingContext2D, l: { x1:number; y1:number; x2:number; y2:number }) => {
    ctx.save();
    ctx.setLineDash([6,4]);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    const x = Math.min(l.x1,l.x2), y = Math.min(l.y1,l.y2);
    const w = Math.abs(l.x2-l.x1), h = Math.abs(l.y2-l.y1);
    ctx.strokeRect(x, y, w, h);
    // endpoint handles
    const hs = 12; const half = hs/2;
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#3b82f6';
    // start point
    ctx.beginPath(); ctx.rect(l.x1 - half, l.y1 - half, hs, hs); ctx.fill(); ctx.stroke();
    // end point
    ctx.beginPath(); ctx.rect(l.x2 - half, l.y2 - half, hs, hs); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  // Shapes / Lines menu open/close
  const [shapesMenuOpen, setShapesMenuOpen] = useState<boolean>(false);
  const [linesMenuOpen, setLinesMenuOpen] = useState<boolean>(false);
  type Line = { id: string; x1:number; y1:number; x2:number; y2:number; stroke:string; strokeWidth:number; dashed:boolean; arrowStart:boolean; arrowEnd:boolean; locked?: boolean };
  const [lines, setLines] = useState<Line[]>([]);
  const draftLineRef = useRef<Line | null>(null);
  type LineStyle = 'solid'|'dashed'|'arrow'|'doubleArrow';
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');

  // Resize canvas to device pixel ratio
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const drawing = drawingRef.current || containerRef.current; // fallback
    if (!canvas || !drawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    const { clientWidth: cssW, clientHeight: cssH } = drawing;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    // Do not scale here. We will manage DPR transform inside redraw() to avoid double-scaling.
    redraw();
    // center position and keep cursor visible
    setCursorPos({ x: Math.max(0, cssW / 2), y: Math.max(0, cssH / 2) });
    setCursorVisible(true);

    // Insert a default linked-lists diagram once on init
    if (!defaultInsertedRef.current) {
      const nodeW = 64, nodeH = 40, gapX = 32, gapY = 48;
      const totalW = nodeW*3 + gapX*2;
      const totalH = nodeH*2 + gapY;
      const originX = Math.max(16, Math.round(cssW/2 - totalW/2));
      const originY = Math.max(16, Math.round(cssH/2 - totalH/2));

      const mkNode = (row: number, col: number, label: string) => {
        const x = originX + col*(nodeW + gapX);
        const y = originY + row*(nodeH + gapY);
        const id = `n_${row}_${col}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
        // Use different colors for different lists
        const stroke = row === 0 ? '#3b82f6' : '#ef4444'; // list1: blue, list2: red
        const shape: Shape = { id, type: 'rect', x, y, w: nodeW, h: nodeH, stroke, strokeWidth: 2, label, labelSize: 16, locked: true };
        return shape;
      };
      const s11 = mkNode(0,0,'1');
      const s12 = mkNode(0,1,'2');
      const s13 = mkNode(0,2,'4');
      const s21 = mkNode(1,0,'1');
      const s22 = mkNode(1,1,'3');
      const s23 = mkNode(1,2,'4');
      // Store node IDs for later reference
      s1IdsRef.current = [s11.id, s12.id, s13.id];
      s2IdsRef.current = [s21.id, s22.id, s23.id];
      setShapes(prev => [...prev, s11, s12, s13, s21, s22, s23]);

      // lines with arrows between nodes in each row
      const mkArrow = (from: Shape, to: Shape) => {
        const id = `l_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
        const x1 = from.x + from.w; const y1 = from.y + from.h/2;
        const x2 = to.x; const y2 = to.y + to.h/2;
        // Use the same color as the nodes
        return { id, x1, y1, x2, y2, stroke: from.stroke, strokeWidth: 2, dashed: false, arrowStart: false, arrowEnd: true, locked: true } as Line;
      };
      const l1 = mkArrow(s11, s12);
      const l2 = mkArrow(s12, s13);
      const l3 = mkArrow(s21, s22);
      const l4 = mkArrow(s22, s23);
      setLines(prev => [...prev, l1, l2, l3, l4]);

      defaultInsertedRef.current = true;
      // store layout for text placement
      initLayoutRef.current = { originX, originY, nodeW, nodeH, gapX, gapY, totalW, totalH };
      // Identify first nodes to make them shake
      setShakingNodeIds([s11.id, s21.id]);
      // Track which node is correct/incorrect
      incorrectFirstNodeRef.current = s11.id; // list1's first node (wrong choice)
      correctFirstNodeRef.current = s21.id;   // list2's first node (correct choice)
      // Insert interactive text shapes for labels and recursion notes
      const makeText = (text: string, x: number, y: number, font: number, centerY = false): Shape => {
        const pad = 6; const w = measureTextWidth(text, font) + pad*2; const h = font + pad*2;
        const ty = centerY ? (y - h/2) : y;
        return { id: `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'text', x, y: ty, w, h, stroke: '#111827', strokeWidth: 1.5, label: text, labelSize: font, locked: true };
      };
      const t1 = makeText('list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]', originX, originY - 76, 14);
      const t2 = makeText('list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]', originX, originY - 56, 14);
      const l1label = makeText('list 1', originX - 54, originY + nodeH/2, 16, true);
      const l2label = makeText('list 2', originX - 54, originY + nodeH + gapY + nodeH/2, 16, true);
      const resultlabel = makeText('merged', originX - 65, originY + nodeH + gapY + nodeH + gapY + nodeH/2, 16, true);

      // Store text ids for highlighting
      t1TextIdRef.current = t1.id;
      t2TextIdRef.current = t2.id;
      
      setShapes(prev => [...prev, t1, t2, l1label, l2label, resultlabel]);
      
      // Create the merged result node (invisible, just for position reference)
      const mergedNode = mkNode(2, 0, '1');
      mergedNodeIdRef.current = mergedNode.id;
      // Don't add to shapes - we only use it for guide position
      // Store the position data directly
      const guideTargetX = mergedNode.x;
      const guideTargetY = mergedNode.y;
      const guideTargetW = mergedNode.w;
      const guideTargetH = mergedNode.h;
      
      // Store as a hidden reference shape
      const hiddenGuideShape: Shape = { ...mergedNode, locked: true };
      (window as any).__guideTargetShape = hiddenGuideShape;
      
      // Start guide animation after a short delay
      setTimeout(() => {
        guideAnimationRef.current = true;
        guideAnimationStartTime.current = performance.now();
        // Auto-select rectangle tool for user to draw
        setTool('rect');
      }, 500);
      // mark highlight start/ghost only if current mode is High
      try {
        const mode = getScaffoldingMode();
        if (mode === 'High') {
          highlightStartRef.current = (typeof performance !== 'undefined' && (performance as any).now) ? performance.now() : Date.now();
          if (!userInteractedRef.current) ghostCheckRef.current = true;
        } else {
          highlightStartRef.current = null;
          ghostCheckRef.current = false;
        }
      } catch {
        // default: do not enable when unknown
        highlightStartRef.current = null;
        ghostCheckRef.current = false;
      }
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape, draft = false) => {
    const isShaking = shakingNodeIds.includes(s.id);
    const isPicked = firstPickIds.includes(s.id);
    ctx.save();
    if (isShaking) {
      ctx.translate(shakeOffsetRef.current, 0);
    }
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth;
    if (s.type === 'rect') {
      // High mode: fill green background for picked nodes
      if (isPicked) {
        ctx.save();
        ctx.fillStyle = '#bbf7d0'; // green-200
        ctx.beginPath();
        roundedRectPath(ctx, s.x, s.y, s.w, s.h, 8);
        ctx.fill();
        ctx.restore();
      }
      handStroke(ctx, () => { roundedRectPath(ctx, s.x, s.y, s.w, s.h, 8); });
      if (s.label) {
        const fs = s.labelSize ?? 16;
        ctx.font = `${fs}px "Comic Sans MS", "Segoe UI", ui-sans-serif`;
        ctx.fillStyle = s.stroke;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = s.x + s.w/2;
        const cy = s.y + s.h/2;
        ctx.fillText(s.label, cx, cy);
      }
    } else if (s.type === 'text') {
      // draw only text, no rect outline (selection overlay will show box)
      const fs = s.labelSize ?? Math.max(12, Math.round(Math.max(s.h - 8, 8)));
      ctx.font = `${fs}px "Comic Sans MS", "Segoe UI", ui-sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // Check if this text should show error highlight
      const isT2 = t2TextIdRef.current && s.id === t2TextIdRef.current;
      const isT1 = t1TextIdRef.current && s.id === t1TextIdRef.current;
      // Show error on t2 for step 0, 3, 4; t1 for step 1, 2, 5
      const shouldShowError = showErrorHighlight && 
                              ((mergeStepRef.current === 0 && isT2) || 
                               (mergeStepRef.current === 1 && isT1) ||
                               (mergeStepRef.current === 2 && isT1) ||
                               (mergeStepRef.current === 3 && isT2) ||
                               (mergeStepRef.current === 4 && isT2) ||
                               (mergeStepRef.current === 5 && isT1));
      
      if (shouldShowError) {
        // Draw with error highlight (color depends on step)
        const t = animTimeRef.current || 0;
        const start = errorHighlightStartRef.current;
        const fade = Math.max(0, Math.min(1, (t - start) / 400)); // 400ms fade-in
        const pulse = 0.7 + 0.3 * Math.abs(Math.sin(t / 300)); // faster breathing
        
        // Step 0/3/4 error: red (list2), Step 1/2/5 error: blue (list1)
        const errorColor = (mergeStepRef.current === 0 || mergeStepRef.current === 3 || mergeStepRef.current === 4) ? '#dc2626' : '#3b82f6';
        const errorGlow = (mergeStepRef.current === 0 || mergeStepRef.current === 3 || mergeStepRef.current === 4) ? 'rgba(239,68,68,0.9)' : 'rgba(59,130,246,0.9)';
        
        ctx.save();
        ctx.globalAlpha = fade * pulse;
        ctx.shadowColor = errorGlow;
        ctx.shadowBlur = 14 * pulse;
        ctx.fillStyle = errorColor;
        ctx.fillText(s.label!, s.x, s.y);
        ctx.restore();
      } else {
        // Normal drawing
        ctx.fillStyle = s.stroke;
        if (s.label) ctx.fillText(s.label, s.x, s.y);
      }
    } else if (s.type === 'ellipse') {
      const rx = Math.abs(s.w)/2, ry = Math.abs(s.h)/2; const cx = s.x + (s.w>=0?rx:-rx), cy = s.y + (s.h>=0?ry:-ry);
      handStroke(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx,0.01), Math.max(ry,0.01), 0, 0, Math.PI*2);
      });
    } else if (s.type === 'triangle') {
      const x1 = s.x, y1 = s.y + s.h; // bottom-left
      const x2 = s.x + s.w, y2 = s.y + s.h; // bottom-right
      const x3 = s.x + s.w/2, y3 = s.y; // top-center
      handStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); });
    }
    ctx.restore();
  };

  const drawSelection = (ctx: CanvasRenderingContext2D, s: Shape) => {
    ctx.save();
    ctx.setLineDash([6,4]);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    // handles (tl, tr, br, bl)
    const hs = 8; const half = hs/2;
    const pts = [
      {x:s.x, y:s.y},
      {x:s.x + s.w, y:s.y},
      {x:s.x + s.w, y:s.y + s.h},
      {x:s.x, y:s.y + s.h},
    ];
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([]);
    for (const p of pts) { ctx.beginPath(); ctx.rect(p.x - half, p.y - half, hs, hs); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  };

  // Hit testing: return shape/path/line and which handle (-1 for body)
  const hitTest = (x: number, y: number): { shape?: Shape; path?: Path; line?: Line; id: string; handle: number } | null => {
    // check handles first
    const hs = 10; const half = hs/2;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.locked) continue;
      const handles = [
        {x:s.x, y:s.y},
        {x:s.x + s.w, y:s.y},
        {x:s.x + s.w, y:s.y + s.h},
        {x:s.x, y:s.y + s.h},
      ];
      for (let h=0; h<handles.length; h++) {
        const p = handles[h];
        if (x >= p.x - half && x <= p.x + half && y >= p.y - half && y <= p.y + half) {
          return { shape: s, id: s.id, handle: h };
        }
      }
    }
    // body box
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.locked) continue;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        return { shape: s, id: s.id, handle: -1 };
      }
    }
    // paths body (by bounding box)
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i];
      const b = getPathBounds(p);
      if (!b) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { path: p, id: p.id, handle: -1 };
      }
    }
    // helper: distance from point to segment
    const distToSeg = (px:number, py:number, x1:number, y1:number, x2:number, y2:number) => {
      const dx = x2 - x1, dy = y2 - y1;
      if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1)*dx + (py - y1)*dy) / (dx*dx + dy*dy)));
      const cx = x1 + t*dx, cy = y1 + t*dy;
      return Math.hypot(px - cx, py - cy);
    };
    // lines body/handles
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (l.locked) continue;
      // endpoint handles
      const hs = 12; const half = hs/2;
      if (x >= l.x1 - half && x <= l.x1 + half && y >= l.y1 - half && y <= l.y1 + half) {
        return { line: l, id: l.id, handle: 0 };
      }
      if (x >= l.x2 - half && x <= l.x2 + half && y >= l.y2 - half && y <= l.y2 + half) {
        return { line: l, id: l.id, handle: 1 };
      }
      // body via distance threshold (more reliable than bbox)
      const thresh = Math.max(10, lines[i].strokeWidth + 6);
      if (distToSeg(x, y, l.x1, l.y1, l.x2, l.y2) <= thresh) {
        return { line: l, id: l.id, handle: -1 };
      }
    }
    return null;
  };

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resizeCanvas);
      if (containerRef.current) ro.observe(containerRef.current);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', resizeCanvas);
    }
    // run once initially
    resizeCanvas();
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Fireworks animation
  useEffect(() => {
    if (!showFireworks) return;
    
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const animate = () => {
      // Create new firework occasionally
      if (Math.random() < 0.05) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.5; // Upper half of screen
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        const particles: Array<{x: number; y: number; vx: number; vy: number; life: number; color: string}> = [];
        
        // Create particles
        for (let i = 0; i < 30; i++) {
          const angle = (Math.PI * 2 * i) / 30;
          const speed = 2 + Math.random() * 3;
          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
        
        fireworksRef.current.push({ x, y, particles });
      }
      
      // Update and remove old fireworks
      fireworksRef.current = fireworksRef.current.filter(fw => {
        fw.particles = fw.particles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1; // gravity
          p.life -= 0.02;
          return p.life > 0;
        });
        return fw.particles.length > 0;
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [showFireworks]);

  // Animation loop for shaking nodes and guide animation
  useEffect(() => {
    let frameId: number;
    const animate = (time: number) => {
      animTimeRef.current = time;
      shakeOffsetRef.current = Math.sin(time / 120) * 1.5; // Oscillates between -1.5 and 1.5
      
      // Guide animation: moving highlighter dot to guide user drawing
      if (guideAnimationRef.current) {
        const elapsed = time - guideAnimationStartTime.current;
        const cycleDuration = 1000; // 1 second per cycle
        const progress = (elapsed % cycleDuration) / cycleDuration;
        setGuideAnimationProgress(progress);
        
        // If user created a rect, run one more cycle then stop
        if (userCreatedRectRef.current) {
          const timeSinceCreation = time - finalCycleStartTimeRef.current;
          if (timeSinceCreation >= cycleDuration) {
            guideAnimationRef.current = false;
            guideTrailPoints.current = []; // Clear trail
            // Start number hint animation and switch to pen tool
            if (!showNumberHint) {
              setShowNumberHint(true);
              numberHintStartTimeRef.current = time;
              setTool('pen');
              // Deselect the created rect so user can draw freely
              setSelectedId(null);
              setSelectedKind(null);
            }
          }
        }
      }
      
      // Sync highlight start with ScaffoldingMode=High
      try {
        const mode = getScaffoldingMode();
        if (mode === 'High') {
          if (highlightStartRef.current == null) highlightStartRef.current = time;
          if (!userInteractedRef.current) ghostCheckRef.current = true;
        } else {
          highlightStartRef.current = null;
          ghostCheckRef.current = false;
        }
      } catch {}
      
      // Arrow animation progress
      if (showArrowAnimation) {
        arrowAnimationProgressRef.current = Math.min(1, arrowAnimationProgressRef.current + 0.02);
        
        // When arrow animation completes, trigger next merge step
        if (arrowAnimationProgressRef.current >= 1 && !nextStepTriggeredRef.current) {
          nextStepTriggeredRef.current = true;
          
          // Convert animated arrow to permanent line
          if (userCreatedRectIdRef.current) {
            const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
            if (createdRect) {
              const arrowId = `l_arrow_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
              const startX = createdRect.x + createdRect.w;
              const startY = createdRect.y + createdRect.h / 2;
              const arrowLength = 32;
              const endX = startX + arrowLength;
              const endY = startY;
              
              // Arrow color depends on merge step: red for step 0, 3, 4; blue for step 1, 2, 5
              const arrowColor = (mergeStepRef.current === 0 || mergeStepRef.current === 3 || mergeStepRef.current === 4) ? '#ef4444' : '#3b82f6';
              
              const permanentArrow: Line = {
                id: arrowId,
                x1: startX,
                y1: startY,
                x2: endX,
                y2: endY,
                stroke: arrowColor,
                strokeWidth: 2,
                dashed: false,
                arrowStart: false,
                arrowEnd: true,
                locked: true
              };
              
              setLines(prev => [...prev, permanentArrow]);
            }
          }
          
          // Wait a bit before starting next step
          setTimeout(() => {
            setupNextMergeStep();
          }, 500);
        }
      }
      
      redraw();
      frameId = requestAnimationFrame(animate);
    };
    // Always run the animation loop to handle dynamic effects like highlighting
    frameId = requestAnimationFrame(animate);

    // If no nodes are shaking, ensure the offset is zero
    if (shakingNodeIds.length === 0) {
      shakeOffsetRef.current = 0;
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
    // Redraw is handled inside the loop, but we depend on shakingNodeIds to start/stop it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakingNodeIds, guideAnimationProgress, paths, shapes, lines]);

  useEffect(() => {
    // redraw when pen settings change (not necessary but keeps strokes consistent after undo)
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, size]);

  // Listen for external mode changes to force redraw and switch tool
  useEffect(() => {
    const handleModeChange = () => {
      try {
        const mode = getScaffoldingMode();
        if (mode === 'High') {
          setTool('select');
        }
      } catch {}
      redraw();
    };

    // Initial check on mount
    handleModeChange();

    // Listen for external custom event (if the toggler dispatches it)
    window.addEventListener('scaffoldingModeChanged', handleModeChange);
    // Additionally, poll periodically in case no event is dispatched when mode changes
    const intervalId = window.setInterval(() => {
      handleModeChange();
    }, 300);

    return () => {
      window.removeEventListener('scaffoldingModeChanged', handleModeChange);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Redraw when any drawable state changes to ensure state-committed render
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, paths, lines, selectedId, selectedKind, history, future, selectedColor]);

  // Setup next merge step
  const setupNextMergeStep = () => {
    console.log('Setting up next merge step, current step:', mergeStepRef.current);
    
    if (mergeStepRef.current === 0) {
      // Move to step 1: compare list1[0] ("1") with list2[1] ("3")
      mergeStepRef.current = 1;
      
      // Update shaking nodes: list1's first node and list2's second node
      const list1FirstId = s1IdsRef.current[0]; // list1 "1" (blue)
      const list2SecondId = s2IdsRef.current[1]; // list2 "3" (red)
      
      console.log('Shaking nodes:', list1FirstId, list2SecondId);
      setShakingNodeIds([list1FirstId, list2SecondId]);
      
      // Highlight t1 formula (list1[0] < list2[0])
      highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
      highlightStartRef.current = animTimeRef.current;
      
      // Store the created rect as a merged node
      if (userCreatedRectIdRef.current) {
        const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
        if (createdRect) {
          mergedNodesRef.current.push(createdRect);
        }
      }
      
      // Reset animation state
      setShowArrowAnimation(false);
      arrowAnimationProgressRef.current = 0;
      nextStepTriggeredRef.current = false;
      
      // Reset for next merge
      userCreatedRectIdRef.current = null;
      numberRecognizedRef.current = false;
      userDrawnPathsRef.current = [];
      setSelectedColor(null);
      
      // Start guide animation for the second merged node
      const { originX, originY, nodeW, nodeH, gapX, gapY } = initLayoutRef.current!;
      // Calculate position for second merged node (row 2, col 1)
      const secondMergedX = originX + 1 * (nodeW + gapX);
      const secondMergedY = originY + 2 * (nodeH + gapY);
      
      const guideShape: Shape = {
        id: 'guide_merged_2',
        type: 'rect',
        x: secondMergedX,
        y: secondMergedY,
        w: nodeW,
        h: nodeH,
        stroke: '#111827',
        strokeWidth: 2,
        locked: true
      };
      
      (window as any).__guideTargetShape = guideShape;
      guideAnimationRef.current = true;
      guideAnimationStartTime.current = performance.now();
      userCreatedRectRef.current = false;
      finalCycleStartTimeRef.current = 0;
      setShowNumberHint(false);
      
      // Switch tool to rect for drawing
      setTool('rect');
    } else if (mergeStepRef.current === 1) {
      // Move to step 2: compare list1[1] ("2") with list2[1] ("3")
      mergeStepRef.current = 2;
      
      // Update shaking nodes: list1's second node and list2's second node
      const list1SecondId = s1IdsRef.current[1]; // list1 "2" (blue)
      const list2SecondId = s2IdsRef.current[1]; // list2 "3" (red)
      
      console.log('Step 2: Shaking nodes:', list1SecondId, list2SecondId);
      setShakingNodeIds([list1SecondId, list2SecondId]);
      
      // Highlight t1 formula (list1[0] < list2[0])
      highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
      highlightStartRef.current = animTimeRef.current;
      
      // Store the created rect as a merged node
      if (userCreatedRectIdRef.current) {
        const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
        if (createdRect) {
          mergedNodesRef.current.push(createdRect);
        }
      }
      
      // Reset animation state
      setShowArrowAnimation(false);
      arrowAnimationProgressRef.current = 0;
      nextStepTriggeredRef.current = false;
      
      // Reset for next merge
      userCreatedRectIdRef.current = null;
      numberRecognizedRef.current = false;
      userDrawnPathsRef.current = [];
      setSelectedColor(null);
      
      // Start guide animation for the third merged node
      const { originX, originY, nodeW, nodeH, gapX, gapY } = initLayoutRef.current!;
      // Calculate position for third merged node (row 2, col 2)
      const thirdMergedX = originX + 2 * (nodeW + gapX);
      const thirdMergedY = originY + 2 * (nodeH + gapY);
      
      const guideShape: Shape = {
        id: 'guide_merged_3',
        type: 'rect',
        x: thirdMergedX,
        y: thirdMergedY,
        w: nodeW,
        h: nodeH,
        stroke: '#111827',
        strokeWidth: 2,
        locked: true
      };
      
      (window as any).__guideTargetShape = guideShape;
      guideAnimationRef.current = true;
      guideAnimationStartTime.current = performance.now();
      userCreatedRectRef.current = false;
      finalCycleStartTimeRef.current = 0;
      setShowNumberHint(false);
      
      // Switch tool to rect for drawing
      setTool('rect');
    } else if (mergeStepRef.current === 2) {
      // Move to step 3: compare list1[2] ("4") with list2[1] ("3")
      mergeStepRef.current = 3;
      
      // Update shaking nodes: list1's third node and list2's second node
      const list1ThirdId = s1IdsRef.current[2]; // list1 "4" (blue)
      const list2SecondId = s2IdsRef.current[1]; // list2 "3" (red)
      
      console.log('Step 3: Shaking nodes:', list1ThirdId, list2SecondId);
      setShakingNodeIds([list1ThirdId, list2SecondId]);
      
      // Highlight t2 formula (list2[0] >= list1[0])
      highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
      highlightStartRef.current = animTimeRef.current;
      
      // Store the created rect as a merged node
      if (userCreatedRectIdRef.current) {
        const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
        if (createdRect) {
          mergedNodesRef.current.push(createdRect);
        }
      }
      
      // Reset animation state
      setShowArrowAnimation(false);
      arrowAnimationProgressRef.current = 0;
      nextStepTriggeredRef.current = false;
      
      // Reset for next merge
      userCreatedRectIdRef.current = null;
      numberRecognizedRef.current = false;
      userDrawnPathsRef.current = [];
      setSelectedColor(null);
      
      // Start guide animation for the fourth merged node
      const { originX, originY, nodeW, nodeH, gapX, gapY } = initLayoutRef.current!;
      // Calculate position for fourth merged node (row 2, col 3)
      const fourthMergedX = originX + 3 * (nodeW + gapX);
      const fourthMergedY = originY + 2 * (nodeH + gapY);
      
      const guideShape: Shape = {
        id: 'guide_merged_4',
        type: 'rect',
        x: fourthMergedX,
        y: fourthMergedY,
        w: nodeW,
        h: nodeH,
        stroke: '#111827',
        strokeWidth: 2,
        locked: true
      };
      
      (window as any).__guideTargetShape = guideShape;
      guideAnimationRef.current = true;
      guideAnimationStartTime.current = performance.now();
      userCreatedRectRef.current = false;
      finalCycleStartTimeRef.current = 0;
      setShowNumberHint(false);
      
      // Switch tool to rect for drawing
      setTool('rect');
    } else if (mergeStepRef.current === 3) {
      // Move to step 4: compare list1[2] ("4") with list2[2] ("5")
      mergeStepRef.current = 4;
      
      // Update shaking nodes: list1's third node and list2's third node
      const list1ThirdId = s1IdsRef.current[2]; // list1 "4" (blue)
      const list2ThirdId = s2IdsRef.current[2]; // list2 "5" (red)
      
      console.log('Step 4: Shaking nodes:', list1ThirdId, list2ThirdId);
      setShakingNodeIds([list1ThirdId, list2ThirdId]);
      
      // Highlight t2 formula (list2[0] >= list1[0])
      highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
      highlightStartRef.current = animTimeRef.current;
      
      // Store the created rect as a merged node
      if (userCreatedRectIdRef.current) {
        const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
        if (createdRect) {
          mergedNodesRef.current.push(createdRect);
        }
      }
      
      // Reset animation state
      setShowArrowAnimation(false);
      arrowAnimationProgressRef.current = 0;
      nextStepTriggeredRef.current = false;
      
      // Reset for next merge
      userCreatedRectIdRef.current = null;
      numberRecognizedRef.current = false;
      userDrawnPathsRef.current = [];
      setSelectedColor(null);
      
      // Start guide animation for the fifth merged node
      const { originX, originY, nodeW, nodeH, gapX, gapY } = initLayoutRef.current!;
      // Calculate position for fifth merged node (row 2, col 4)
      const fifthMergedX = originX + 4 * (nodeW + gapX);
      const fifthMergedY = originY + 2 * (nodeH + gapY);
      
      const guideShape: Shape = {
        id: 'guide_merged_5',
        type: 'rect',
        x: fifthMergedX,
        y: fifthMergedY,
        w: nodeW,
        h: nodeH,
        stroke: '#111827',
        strokeWidth: 2,
        locked: true
      };
      
      (window as any).__guideTargetShape = guideShape;
      guideAnimationRef.current = true;
      guideAnimationStartTime.current = performance.now();
      userCreatedRectRef.current = false;
      finalCycleStartTimeRef.current = 0;
      setShowNumberHint(false);
      
      // Switch tool to rect for drawing
      setTool('rect');
    } else if (mergeStepRef.current === 4) {
      // Move to step 5: only list1[2] ("4") remains
      mergeStepRef.current = 5;
      
      // Update shaking nodes: only list1's third node
      const list1ThirdId = s1IdsRef.current[2]; // list1 "4" (blue)
      
      console.log('Step 5: Shaking node:', list1ThirdId);
      setShakingNodeIds([list1ThirdId]);
      
      // Highlight t1 formula
      highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
      highlightStartRef.current = animTimeRef.current;
      
      // Store the created rect as a merged node
      if (userCreatedRectIdRef.current) {
        const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
        if (createdRect) {
          mergedNodesRef.current.push(createdRect);
        }
      }
      
      // Reset animation state
      setShowArrowAnimation(false);
      arrowAnimationProgressRef.current = 0;
      nextStepTriggeredRef.current = false;
      
      // Reset for next merge
      userCreatedRectIdRef.current = null;
      numberRecognizedRef.current = false;
      userDrawnPathsRef.current = [];
      setSelectedColor(null);
      
      // Start guide animation for the sixth merged node
      const { originX, originY, nodeW, nodeH, gapX, gapY } = initLayoutRef.current!;
      // Calculate position for sixth merged node (row 2, col 5)
      const sixthMergedX = originX + 5 * (nodeW + gapX);
      const sixthMergedY = originY + 2 * (nodeH + gapY);
      
      const guideShape: Shape = {
        id: 'guide_merged_6',
        type: 'rect',
        x: sixthMergedX,
        y: sixthMergedY,
        w: nodeW,
        h: nodeH,
        stroke: '#111827',
        strokeWidth: 2,
        locked: true
      };
      
      (window as any).__guideTargetShape = guideShape;
      guideAnimationRef.current = true;
      guideAnimationStartTime.current = performance.now();
      userCreatedRectRef.current = false;
      finalCycleStartTimeRef.current = 0;
      setShowNumberHint(false);
      
      // Switch tool to rect for drawing
      setTool('rect');
    }
    // Add more steps here for subsequent merges
  };

  // Handle color selection
  const handleColorSelect = (colorChoice: 'blue' | 'red') => {
    const chosenColor = colorChoice === 'blue' ? '#3b82f6' : '#ef4444';
    setSelectedColor(chosenColor);
    
    // Change the rect color
    if (userCreatedRectIdRef.current) {
      setShapes(prev => prev.map(s => 
        s.id === userCreatedRectIdRef.current ? { ...s, stroke: chosenColor } : s
      ));
    }
    
    // Change the drawn paths color
    setPaths(prev => prev.map(p => 
      userDrawnPathsRef.current.includes(p.id) ? { ...p, color: chosenColor } : p
    ));
    
    setShowColorSelection(false);
    
    // Check if correct color based on current merge step
    // Step 0: red is correct (list2[0] = "1")
    // Step 1: blue is correct (list1[0] = "1")
    // Step 2: blue is correct (list1[1] = "2" < list2[1] = "3")
    // Step 3: red is correct (list2[1] = "3" < list1[2] = "4")
    // Step 4: red is correct (list1[2] = "4" < list2[2] = "5")
    // Step 5: blue is correct (list1[2] = "4", no more list2)
    const isCorrect = (mergeStepRef.current === 0 && colorChoice === 'red') || 
                      (mergeStepRef.current === 1 && colorChoice === 'blue') ||
                      (mergeStepRef.current === 2 && colorChoice === 'blue') ||
                      (mergeStepRef.current === 3 && colorChoice === 'red') ||
                      (mergeStepRef.current === 4 && colorChoice === 'red') ||
                      (mergeStepRef.current === 5 && colorChoice === 'blue');
    
    if (isCorrect) {
      // Correct!
      // For step 5 (final step), don't show arrow animation
      if (mergeStepRef.current === 5) {
        // Final step - just stop shaking and clear selection
        setShakingNodeIds([]);
        setSelectedId(null);
        setSelectedKind(null);
        setShowErrorHighlight(false);
        console.log('Merge complete!');
        
        // Show fireworks celebration!
        setShowFireworks(true);
        
        // Stop fireworks after 5 seconds
        setTimeout(() => {
          setShowFireworks(false);
          fireworksRef.current = [];
        }, 5000);
      } else {
        // Show arrow animation for other steps
        setShowArrowAnimation(true);
        // Stop nodes from shaking
        setShakingNodeIds([]);
        setSelectedId(null);
        setSelectedKind(null);
        setShowErrorHighlight(false);
      }
    } else {
      // Wrong color - show error highlight and revert to black
      setShowErrorHighlight(true);
      errorHighlightStartRef.current = animTimeRef.current;
      
      // Highlight the correct formula based on step
      if (mergeStepRef.current === 0) {
        // Step 0: should have chosen red (list2), highlight t2
        highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
      } else if (mergeStepRef.current === 1 || mergeStepRef.current === 2) {
        // Step 1 or 2: should have chosen blue (list1), highlight t1
        highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
      } else if (mergeStepRef.current === 3 || mergeStepRef.current === 4) {
        // Step 3 or 4: should have chosen red (list2), highlight t2
        highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
      } else if (mergeStepRef.current === 5) {
        // Step 5: should have chosen blue (list1 only), highlight t1
        highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
      }
      highlightStartRef.current = animTimeRef.current;
      
      // Revert to black color after showing error
      setTimeout(() => {
        const blackColor = '#1e1e1e';
        
        // Change rect back to black
        if (userCreatedRectIdRef.current) {
          setShapes(prev => prev.map(s => 
            s.id === userCreatedRectIdRef.current ? { ...s, stroke: blackColor } : s
          ));
        }
        
        // Change paths back to black
        setPaths(prev => prev.map(p => 
          userDrawnPathsRef.current.includes(p.id) ? { ...p, color: blackColor } : p
        ));
        
        // Reset selected color and show color selection again
        setSelectedColor(null);
        setShowColorSelection(true);
        setShowErrorHighlight(false);
      }, 1000);
    }
  };

  const getCanvasOffset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { left: 0, top: 0 };
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  };

  const pointerPos = (e: PointerEvent | React.PointerEvent) => {
    const off = getCanvasOffset();
    // client coords -> CSS pixels
    const anyE: any = e as any;
    const x = typeof anyE.clientX === 'number' ? anyE.clientX : (anyE.touches && anyE.touches[0] ? anyE.touches[0].clientX : 0);
    const y = typeof anyE.clientY === 'number' ? anyE.clientY : (anyE.touches && anyE.touches[0] ? anyE.touches[0].clientY : 0);
    return { x: x - off.left, y: y - off.top };
  };

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault();
    // close shapes menu on canvas interaction
    if (shapesMenuOpen) setShapesMenuOpen(false);
    if (linesMenuOpen) setLinesMenuOpen(false);
    if (!canvasRef.current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return; // left button only
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pointerPos(e);
    showCursor(p);
    // mark drag as clean at start
    dragDirtyRef.current = false;
    erasedThisDragRef.current = false;

    // High mode: click shaking node to select it (stop shaking, fill green)
    try {
      const mode = getScaffoldingMode();
      if (mode === 'High' && tool === 'select') {
        // Hit-test shaking nodes (for picking) and picked nodes (for dragging)
        for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i];
          if (pointInRect(s, p)) {
            if (shakingNodeIds.includes(s.id)) {
              // --- 1. Logic for PICKING a shaking node ---
              recordBeforeChange();
              if (firstPickIds.length === 0 && s.id === incorrectFirstNodeRef.current) {
                // Incorrect pick: flash error and revert
                setFirstPickIds([s.id]);
                setShakingNodeIds([]);
                redraw();
                setTimeout(() => {
                  setSelectionError(true);
                  setFirstPickIds([]);
                  if (incorrectFirstNodeRef.current && correctFirstNodeRef.current) {
                    setShakingNodeIds([incorrectFirstNodeRef.current, correctFirstNodeRef.current]);
                  }
                  try {
                    (window as any).sketchMindSelectionError = true;
                    window.dispatchEvent(new CustomEvent('selectionErrorChanged', { detail: { error: true } }));
                  } catch {}
                  redraw();
                }, 800);
                return;
              }

              // Correct pick
              setSelectionError(false);
              try {
                (window as any).sketchMindSelectionError = false;
                window.dispatchEvent(new CustomEvent('selectionErrorChanged', { detail: { error: false } }));
              } catch {}
              // Compute next picks synchronously to decide shaking behavior
              const nextPicks = firstPickIds.includes(s.id)
                ? firstPickIds  // If already picked, keep the same list
                : ([...firstPickIds, s.id].slice(0, 2));  // Add new pick, limit to 2
              setFirstPickIds(nextPicks);
              // If two nodes are picked, stop all shaking; otherwise stop only the clicked one
              if (nextPicks.length >= 2) {
                setShakingNodeIds([]);
              } else {
                setShakingNodeIds(prev => prev.filter(id => id !== s.id));
              }
              // Immediately allow dragging this picked node in the same gesture
              const unlockedNode = { ...s, locked: false };
              selectionDragRef.current = { mode: 'move', handle: null, start: p, orig: unlockedNode } as any;
              setSelectedId(s.id);
              setSelectedKind('shape');
              setShapes(prev => prev.map(shape => shape.id === s.id ? unlockedNode : shape));
              redraw();
              return; // consume click

            } else if (firstPickIds.includes(s.id)) {
              // --- 2. Logic for DRAGGING a picked node ---
              // Temporarily unlock the node to allow dragging
              const unlockedNode = { ...s, locked: false };
              recordBeforeChange();
              selectionDragRef.current = { mode: 'move', handle: null, start: p, orig: unlockedNode } as any;
              setSelectedId(s.id);
              setSelectedKind('shape');
              // Update the shape in the state to be unlocked
              const nextShapes = shapes.map(shape => shape.id === s.id ? unlockedNode : shape);
              setShapes(nextShapes);
              // Initialize live render array at drag start from the latest computed state
              renderShapesRef.current = [...nextShapes];
              return; // Stop after first hit
            }
          }
        }
      }
    } catch {}

    // Text tool: open inline input at click position
    if (tool === 'text') {
      ghostCheckRef.current = false;
      userInteractedRef.current = true;
      setTextInput({ x: p.x, y: p.y, value: '' });
      // focus after mount
      setTimeout(() => { textInputRef.current?.focus(); }, 0);
      return;
    }

    // Eraser: begin erasing immediately at pointer location
    if (tool === 'eraser') {
      ghostCheckRef.current = false;
      userInteractedRef.current = true;
      recordBeforeChange();
      setIsDrawing(true);
      const erased = eraseAt(p.x, p.y);
      if (erased) { dragDirtyRef.current = true; erasedThisDragRef.current = true; redraw(); }
      return;
    }

    // If clicking on already selected item, start drag even if current tool is not 'select'
    // Lines
    if (selectedKind === 'line' && selectedId) {
      const l = lines.find(x => x.id === selectedId);
      if (l) {
        // endpoints
        const hs = 12, half = hs/2;
        if (p.x >= l.x1 - half && p.x <= l.x1 + half && p.y >= l.y1 - half && p.y <= l.y1 + half) {
          recordBeforeChange();
          selectionDragLineRef.current = { mode: 'endpoint', handle: 0, start: p, orig: { ...l } };
          setTool('select');
          return;
        }
        if (p.x >= l.x2 - half && p.x <= l.x2 + half && p.y >= l.y2 - half && p.y <= l.y2 + half) {
          recordBeforeChange();
          selectionDragLineRef.current = { mode: 'endpoint', handle: 1, start: p, orig: { ...l } };
          setTool('select');
          return;
        }
        // bbox
        const x0 = Math.min(l.x1,l.x2), y0 = Math.min(l.y1,l.y2);
        const w = Math.abs(l.x2-l.x1), h = Math.abs(l.y2-l.y1);
        if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
          recordBeforeChange();
          selectionDragLineRef.current = { mode: 'move', handle: null, start: p, orig: { ...l } };
          setTool('select');
          return;
        }
      }
    }
    // Shapes
    if (selectedKind === 'shape' && selectedId) {
      const idx = shapes.findIndex(s => s.id === selectedId);
      if (idx >= 0) {
        const s = shapes[idx];
        const x0 = s.x, y0 = s.y, w = s.w, h = s.h;
        const hs = 8, half = hs/2;
        // corners
        const corners = [
          {x:x0,y:y0,handle:0}, {x:x0+w,y:y0,handle:1}, {x:x0+w,y:y0+h,handle:2}, {x:x0,y:y0+h,handle:3}
        ];
        for (const c of corners) {
          if (p.x >= c.x - half && p.x <= c.x + half && p.y >= c.y - half && p.y <= c.y + half) {
            recordBeforeChange();
            selectionDragRef.current = { mode: 'resize', handle: c.handle as any, start: p, orig: { ...s } };
            setTool('select');
            // Initialize live render array at drag start
            renderShapesRef.current = [...shapes];
            return;
          }
        }
        if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
          recordBeforeChange();
          selectionDragRef.current = { mode: 'move', handle: null, start: p, orig: { ...s } } as any;
          setTool('select');
          // Initialize live render array at drag start
          renderShapesRef.current = [...shapes];
          // Will push history on end if changed
          return;
        }
      }
    }


    // Pen tool: start drawing path
    if (tool === 'pen') {
      ghostCheckRef.current = false;
      userInteractedRef.current = true;
      recordBeforeChange();
      setIsDrawing(true);
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      currentPathRef.current = { id, color, size, points: [p] };
      return;
    }

    if (tool === 'rect' || tool === 'ellipse' || tool === 'triangle') {
      ghostCheckRef.current = false;
      userInteractedRef.current = true;
      recordBeforeChange();
      // For shape tools: don't create on down; show ghost and wait for up
      setIsDrawing(true);
      return;
    }

    if (tool === 'line') {
      ghostCheckRef.current = false;
      userInteractedRef.current = true;
      recordBeforeChange();
      setIsDrawing(true);
      const id = `l_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const style = lineStyle;
      const dashed = style === 'dashed';
      const arrowStart = style === 'arrow' ? false : (style === 'doubleArrow');
      const arrowEnd = style === 'arrow' || style === 'doubleArrow';
      draftLineRef.current = { id, x1:p.x, y1:p.y, x2:p.x, y2:p.y, stroke: color, strokeWidth: size, dashed, arrowStart, arrowEnd };
      return;
    }

    // select tool: start selection/move/resize
    if (tool === 'select') {
      const hit = hitTest(p.x, p.y);
      if (hit) {
        setSelectedId(hit.id);
        if (hit.shape) {
          setSelectedKind('shape');
          const handle = hit.handle; // -1 means inside
          const orig = { ...hit.shape } as Shape;
          const mode = handle === -1 ? 'move' : 'resize';
          selectionDragRef.current = { mode, handle: handle === -1 ? null : handle, start: p, orig };
          // reflect selected style to controls
          setColor(orig.stroke);
          setSize(orig.strokeWidth);
        } else if (hit.path) {
          setSelectedKind('path');
          selectionDragRef.current = null;
          setColor(hit.path.color);
          setSize(hit.path.size);
        } else if (hit.line) {
          setSelectedKind('line');
          selectionDragRef.current = null;
          setColor(hit.line.stroke);
          setSize(hit.line.strokeWidth);
          // setup line drag: endpoint or move
          const mode = hit.handle === -1 ? 'move' : 'endpoint';
          const handle = (hit.handle === 0 || hit.handle === 1) ? hit.handle : null;
          selectionDragLineRef.current = { mode, handle: handle as any, start: p, orig: { ...hit.line } };
        }
      } else {
        // Fallback: if a line is already selected, allow dragging by clicking inside its selection bbox
        if (selectedKind === 'line' && selectedId) {
          const l = lines.find(x => x.id === selectedId);
          if (l) {
            const x0 = Math.min(l.x1,l.x2), y0 = Math.min(l.y1,l.y2);
            const w = Math.abs(l.x2-l.x1), h = Math.abs(l.y2-l.y1);
            if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
              selectionDragLineRef.current = { mode: 'move', handle: null, start: p, orig: { ...l } };
              redraw();
              return;
            }
          }
        }
        // Fallback 2: if not selected yet, but within any line's bbox (with margin), select and start move
        const M = 12;
        for (let i = lines.length - 1; i >= 0; i--) {
          const l = lines[i];
          const x0 = Math.min(l.x1,l.x2) - M, y0 = Math.min(l.y1,l.y2) - M;
          const w = Math.abs(l.x2-l.x1) + 2*M, h = Math.abs(l.y2-l.y1) + 2*M;
          if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
            setSelectedId(l.id);
            setSelectedKind('line');
            selectionDragLineRef.current = { mode: 'move', handle: null, start: p, orig: { ...l } };
            redraw();
            return;
          }
        }
        setSelectedId(null);
        setSelectedKind(null);
        selectionDragLineRef.current = null;
      }
      redraw();
    }
  };

  const drawMove = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const p = pointerPos(e);
    setCursorPos(p); setCursorVisible(true);

    // pen
    if (isDrawing && tool === 'pen' && currentPathRef.current) {
      // Hide number hint when user starts drawing
      if (showNumberHint) {
        setShowNumberHint(false);
      }
      const path = currentPathRef.current;
      const last = path.points[path.points.length - 1];
      const dx = p.x - last.x, dy = p.y - last.y;
      if (dx*dx + dy*dy < 0.5) return;
      path.points.push(p);
      drawLastStrokeSegment();
      return;
    }

    // drafting shape
    if (isDrawing && draftShapeRef.current) {
      const s = draftShapeRef.current;
      s.w = p.x - s.x;
      s.h = p.y - s.y;
      redraw();
      return;
    }

    // drafting line
    if (isDrawing && draftLineRef.current) {
      draftLineRef.current.x2 = p.x;
      draftLineRef.current.y2 = p.y;
      redraw();
      return;
    }

    // moving/resizing selection (shapes) — allow regardless of current tool if drag started
    // Use ref's orig id if selectedId state hasn't flushed yet, so drag starts immediately.
    if (selectionDragRef.current) {
      const info = selectionDragRef.current; const orig = info.orig;
      const dx = p.x - info.start.x; const dy = p.y - info.start.y;
      const activeId = selectedId ?? orig.id;
      const base = renderShapesRef.current || shapes;
      const idx = base.findIndex(s => s.id === activeId);
      if (idx >= 0) {
        const next = [...base];
        const s = { ...next[idx] };
        if (info.mode === 'move') {
          s.x = orig.x + dx; s.y = orig.y + dy;
        } else {
          // Resize behavior
          if (s.type === 'text' && s.label) {
            // For text: change font size only based on vertical drag; width auto from text.
            const padding = 6;
            // compute new height from vertical drag depending on handle (top vs bottom)
            const fromTop = info.handle === 0 || info.handle === 1;
            const newH = Math.max(16, fromTop ? (orig.h - dy) : (orig.h + dy));
            const newFont = Math.max(10, Math.round(newH - padding*2));
            const textW = measureTextWidth(s.label, newFont);
            const newW = Math.max(textW + padding*2, 20);
            s.w = newW;
            s.h = newFont + padding*2;
            s.labelSize = newFont;
            // keep opposite sides anchored
            switch (info.handle) {
              case 0: // top-left -> anchor bottom-right
                s.x = orig.x + orig.w - s.w;
                s.y = orig.y + orig.h - s.h;
                break;
              case 1: // top-right -> anchor bottom-left
                s.x = orig.x;
                s.y = orig.y + orig.h - s.h;
                break;
              case 2: // bottom-right -> anchor top-left
                s.x = orig.x;
                s.y = orig.y;
                break;
              case 3: // bottom-left -> anchor top-right
                s.x = orig.x + orig.w - s.w;
                s.y = orig.y;
                break;
            }
          } else {
            // Default rectangular resize for non-text
            switch (info.handle) {
              case 0: s.x = orig.x + dx; s.y = orig.y + dy; s.w = orig.w - dx; s.h = orig.h - dy; break;
              case 1: s.y = orig.y + dy; s.w = orig.w + dx; s.h = orig.h - dy; break;
              case 2: s.w = orig.w + dx; s.h = orig.h + dy; break;
              case 3: s.x = orig.x + dx; s.w = orig.w - dx; s.h = orig.h + dy; break;
            }
          }
        }
        next[idx] = s;
        // Update render ref for immediate visual feedback and repaint
        renderShapesRef.current = next;
        redraw();
        dragDirtyRef.current = true;
      }
    }
  };

  const endDrawing = (_e: React.PointerEvent) => {
    _e.preventDefault();
    if (!canvasRef.current) return;
    // finalize any in-progress drawing; selection drags don't depend on isDrawing
    if (isDrawing) setIsDrawing(false);
    // For shape tools: create at cursor on release if no draft shape in progress
    if ((tool === 'rect' || tool === 'ellipse' || tool === 'triangle') && !draftShapeRef.current) {
      const id = `s_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      // Use guide rect size if guide animation is active and tool is rect, otherwise use default
      const w = (tool === 'rect' && guideAnimationRef.current) ? GUIDE_RECT_WIDTH : DEFAULT_SHAPE_SIZE;
      const h = (tool === 'rect' && guideAnimationRef.current) ? GUIDE_RECT_HEIGHT : DEFAULT_SHAPE_SIZE;
      const x = cursorPos.x - w/2, y = cursorPos.y - h/2;
      const newShape = { id, type: tool as any, x, y, w, h, stroke: color, strokeWidth: size } as const;
      setShapes(prev => [...prev, newShape as any]);
      setSelectedId(id);
      setSelectedKind('shape');
      setTool('select');
      // Mark that user created a rect during guide animation
      if (tool === 'rect' && guideAnimationRef.current && !userCreatedRectRef.current) {
        userCreatedRectRef.current = true;
        finalCycleStartTimeRef.current = animTimeRef.current;
        userCreatedRectIdRef.current = id; // Store the created rect ID
        
        // Check if this is for the second merge step
        if (mergeStepRef.current === 1) {
          // User created rect for second merge, will show number hint after guide finishes
          console.log('User created rect for second merge step');
        }
      }
    }
    // finalize pen
    if (currentPathRef.current) {
      const finished = currentPathRef.current; // capture before clearing
      currentPathRef.current = null;
      // Only add path if it has at least 2 points
      if (finished && finished.points && finished.points.length > 0) {
        setPaths(prev => [...prev, finished]);
        
        // Check if user drew inside the created rect
        if (userCreatedRectIdRef.current && !numberRecognizedRef.current) {
          const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
          if (createdRect && isDrawnInsideRect(finished, createdRect)) {
            // Add to pending paths (keep the stroke visible)
            pendingPathsForRecognitionRef.current.push(finished);
            userDrawnPathsRef.current.push(finished.id);
            
            // Clear any existing timer
            if (numberRecognitionTimerRef.current) {
              clearTimeout(numberRecognitionTimerRef.current);
            }
            
            // Check which number is expected based on merge step
            let expectedNumber = 1;
            if (mergeStepRef.current === 0 || mergeStepRef.current === 1) {
              expectedNumber = 1;
            } else if (mergeStepRef.current === 2) {
              expectedNumber = 2;
            } else if (mergeStepRef.current === 3) {
              expectedNumber = 3;
            } else if (mergeStepRef.current === 4) {
              expectedNumber = 4;
            } else if (mergeStepRef.current === 5) {
              expectedNumber = 4;
            }
            
            // For number 4, wait 1.5 seconds for potential second stroke
            const delayMs = expectedNumber === 4 ? 1500 : 0;
            
            numberRecognitionTimerRef.current = setTimeout(() => {
              // Combine all pending paths for recognition
              const combinedPath: Path = {
                id: 'combined_' + Date.now(),
                color: finished.color,
                size: finished.size,
                points: pendingPathsForRecognitionRef.current.flatMap(p => p.points)
              };
              
              console.log(`Recognizing with ${pendingPathsForRecognitionRef.current.length} stroke(s), total ${combinedPath.points.length} points`);
              
              // Use appropriate recognizer based on expected number
              const isCorrectNumber = (expectedNumber === 1 && looksLikeNumberOne(combinedPath)) ||
                                      (expectedNumber === 2 && looksLikeNumberTwo(combinedPath)) ||
                                      (expectedNumber === 3 && looksLikeNumberThree(combinedPath)) ||
                                      (expectedNumber === 4 && looksLikeNumberFour(combinedPath)) ||
                                      (expectedNumber === 5 && looksLikeNumberFive(combinedPath));
              
              if (isCorrectNumber) {
                numberRecognizedRef.current = true;
                setShowNumberHint(false);
                // Show color selection prompt
                setShowColorSelection(true);
                // Select the rect and the drawn path
                setSelectedId(userCreatedRectIdRef.current);
                setSelectedKind('shape');
                // Stop highlighting t2
                highlightStartRef.current = null;
                
                // Clear pending paths
                pendingPathsForRecognitionRef.current = [];
              } else {
                // Wrong number - show error and allow retry
                setShowErrorHighlight(true);
                errorHighlightStartRef.current = animTimeRef.current;
                
                // Highlight the correct formula based on step
                if (mergeStepRef.current === 0) {
                  // Step 0: should write "1", highlight t2
                  highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
                } else if (mergeStepRef.current === 1 || mergeStepRef.current === 2) {
                  // Step 1 or 2: should write "1" or "2", highlight t1
                  highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
                } else if (mergeStepRef.current === 3 || mergeStepRef.current === 4) {
                  // Step 3 or 4: should write "3" or "4", highlight t2
                  highlightedLabelRef.current = 'list2[0] + merge(list1, list2[1:])   list1[0] >= list2[0]';
                } else if (mergeStepRef.current === 5) {
                  // Step 5: should write "4", highlight t1
                  highlightedLabelRef.current = 'list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]';
                }
                highlightStartRef.current = animTimeRef.current;
                
                // Remove all incorrect paths immediately
                const pathIdsToRemove = pendingPathsForRecognitionRef.current.map(p => p.id);
                setPaths(prev => prev.filter(p => !pathIdsToRemove.includes(p.id)));
                userDrawnPathsRef.current = userDrawnPathsRef.current.filter(id => !pathIdsToRemove.includes(id));
                
                // Show number hint immediately for retry
                setShowNumberHint(true);
                numberHintStartTimeRef.current = animTimeRef.current;
                
                // Clear pending paths
                pendingPathsForRecognitionRef.current = [];
                
                // After showing error for 1 second, stop error highlight
                setTimeout(() => {
                  setShowErrorHighlight(false);
                }, 1000);
              }
            }, delayMs);
          }
        }
      }
    }
    // finalize shape
    if (draftShapeRef.current) {
      const s = draftShapeRef.current;
      // normalize negative width/height to top-left origin
      let { x, y, w, h } = s;
      if (w < 0) { x = x + w; w = -w; }
      if (h < 0) { y = y + h; h = -h; }
      const finalS: Shape = { id: s.id, type: s.type, x, y, w, h, stroke: s.stroke, strokeWidth: s.strokeWidth };
      setShapes(prev => [...prev, finalS]);
      draftShapeRef.current = null;
      setSelectedId(finalS.id);
      setSelectedKind('shape');
      setTool('select');
    }
    // finalize line
    if (draftLineRef.current) {
      const l = draftLineRef.current;
      draftLineRef.current = null;
      setLines(prev => [...prev, l]);
      setSelectedId(l.id);
      setSelectedKind('line');
      setTool('select');
    }
    // end selection drag
    selectionDragRef.current = null;
    selectionDragLineRef.current = null;
    // Commit any live-drag render state to React state.
    // Keep the render ref active until React has fully processed the state update.
    if (renderShapesRef.current) {
      const finalSnapshot = [...renderShapesRef.current];
      setShapes(finalSnapshot);
      // Use a longer delay to ensure React state has fully updated before clearing the ref
      setTimeout(() => {
        renderShapesRef.current = null;
        redraw(); // Final redraw using the committed React state
      }, 16); // One frame delay to ensure state is committed
    }
    if (dragDirtyRef.current) { /* history already recorded at drag start */ dragDirtyRef.current = false; }
  };

  // Remove the top-most hit object at x,y. Returns true if anything erased.
  const eraseAt = (x: number, y: number): boolean => {
    const hit = hitTest(x, y);
    if (!hit) return false;
    if (hit.shape) {
      setShapes(prev => prev.filter(s => s.id !== hit.id));
    } else if (hit.path) {
      setPaths(prev => prev.filter(p => p.id !== hit.id));
    } else if (hit.line) {
      setLines(prev => prev.filter(l => l.id !== hit.id));
    } else {
      return false;
    }
    if (selectedId === hit.id) { setSelectedId(null); setSelectedKind(null); }
    return true;
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // 1) Clear in device pixels with identity transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2) Draw in CSS pixel space, but scale once by DPR
    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // draw shapes (prefer live render ref during drag for instant feedback)
    const drawShapes = renderShapesRef.current || shapes;
    for (const s of drawShapes) drawShape(ctx, s);
    if (draftShapeRef.current) drawShape(ctx, draftShapeRef.current, true);
    // draw lines
    for (const l of lines) drawLine(ctx, l);
    if (draftLineRef.current) drawLine(ctx, draftLineRef.current);
    // Draw all saved paths
    for (const path of paths) {
      if (!path) continue;
      drawPath(ctx, path as any);
    }
    if (currentPathRef.current) drawPath(ctx, currentPathRef.current);
    
    // Draw guide animation: moving highlighter dot to guide user
    if (guideAnimationRef.current) {
      const guideShape = (window as any).__guideTargetShape;
      if (guideShape) {
        drawGuideHighlighter(ctx, guideShape, guideAnimationProgress);
      }
    }
    
    // Draw number hint animation inside the created rect
    if (showNumberHint && userCreatedRectIdRef.current) {
      const createdRect = drawShapes.find(s => s.id === userCreatedRectIdRef.current);
      if (createdRect) {
        drawNumberHint(ctx, createdRect, animTimeRef.current - numberHintStartTimeRef.current);
      }
    }
    
    // Draw arrow animation after number recognition
    if (showArrowAnimation && userCreatedRectIdRef.current) {
      const createdRect = drawShapes.find(s => s.id === userCreatedRectIdRef.current);
      if (createdRect) {
        drawArrowAnimation(ctx, createdRect, arrowAnimationProgressRef.current);
      }
    }
    
    // Draw fireworks celebration
    if (showFireworks) {
      for (const fw of fireworksRef.current) {
        for (const p of fw.particles) {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    
    // selection overlay
    if (selectedId) {
      if (selectedKind === 'shape') {
        const s = drawShapes.find(x => x.id === selectedId);
        if (s) drawSelection(ctx, s);
      } else if (selectedKind === 'path') {
        const p = paths.find(x => x.id === selectedId);
        if (p) drawPathSelection(ctx, p);
      } else if (selectedKind === 'line') {
        const l = lines.find(x => x.id === selectedId);
        if (l) drawLineSelection(ctx, l);
      }
    }
  };

  const drawPath = (ctx: CanvasRenderingContext2D, path: {color:string;size:number;points:Array<{x:number;y:number}>} | Path | null | undefined) => {
    if (!path || !path.points || path.points.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.size;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
  };

  const isDrawnInsideRect = (path: Path, rect: Shape): boolean => {
    // Check if most points of the path are inside the rectangle
    let insideCount = 0;
    for (const point of path.points) {
      if (point.x >= rect.x && point.x <= rect.x + rect.w &&
          point.y >= rect.y && point.y <= rect.y + rect.h) {
        insideCount++;
      }
    }
    return insideCount > path.points.length * 0.5; // More than 50% inside
  };

  const looksLikeNumberOne = (path: Path): boolean => {
    if (path.points.length < 3) return false;
    
    // Calculate bounding box
    let minX = path.points[0].x, maxX = path.points[0].x;
    let minY = path.points[0].y, maxY = path.points[0].y;
    for (const p of path.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Number "1" is typically tall and narrow (height > width * 2)
    if (height < width * 1.5) return false;
    
    // Check if the path is mostly vertical (low horizontal variance)
    let totalHorizontalMovement = 0;
    for (let i = 1; i < path.points.length; i++) {
      totalHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
    }
    
    let totalVerticalMovement = 0;
    for (let i = 1; i < path.points.length; i++) {
      totalVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
    }
    
    // Vertical movement should dominate
    return totalVerticalMovement > totalHorizontalMovement * 1.5;
  };

  const looksLikeNumberTwo = (path: Path): boolean => {
    if (path.points.length < 8) return false;
    
    // Calculate bounding box
    let minX = path.points[0].x, maxX = path.points[0].x;
    let minY = path.points[0].y, maxY = path.points[0].y;
    for (const p of path.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Number "2" should be roughly square or slightly taller
    if (height > width * 2 || width < height * 0.6) return false;
    
    // Divide path into three sections: top, middle, bottom
    const third = Math.floor(path.points.length / 3);
    
    // Check top section: should have some horizontal movement (curve at top)
    let topHorizontalMovement = 0;
    for (let i = 1; i < third; i++) {
      topHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
    }
    
    // Check middle section: should have diagonal movement (slant of "2")
    let middleVerticalMovement = 0;
    let middleHorizontalMovement = 0;
    for (let i = third; i < third * 2; i++) {
      if (i > 0) {
        middleVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
        middleHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
      }
    }
    
    // Check bottom section: should have strong horizontal movement (base line)
    let bottomHorizontalMovement = 0;
    let bottomVerticalMovement = 0;
    for (let i = third * 2; i < path.points.length; i++) {
      if (i > 0) {
        bottomHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
        bottomVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
      }
    }
    
    // Number "2" characteristics:
    // 1. Bottom should have strong horizontal movement (the base)
    // 2. Bottom horizontal movement should be much greater than vertical
    // 3. Middle should have both vertical and horizontal movement (diagonal)
    // 4. Overall path should end near the bottom right
    
    const hasStrongBottomLine = bottomHorizontalMovement > width * 0.5;
    const bottomIsHorizontal = bottomHorizontalMovement > bottomVerticalMovement * 2;
    const hasMiddleDiagonal = middleVerticalMovement > 0 && middleHorizontalMovement > 0;
    
    // Check if path ends in bottom portion (not middle like "3")
    const lastPoint = path.points[path.points.length - 1];
    const endsAtBottom = (lastPoint.y - minY) > height * 0.6;
    
    return hasStrongBottomLine && bottomIsHorizontal && hasMiddleDiagonal && endsAtBottom;
  };

  // $1 Unistroke Recognizer - Template matching for handwritten digit 3
  type Point2D = { x: number; y: number };
  
  // Resample path to N points
  const resample = (points: Point2D[], n: number): Point2D[] => {
    const I = pathLength(points) / (n - 1);
    let D = 0.0;
    const newPoints: Point2D[] = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
      const d = distance(points[i - 1], points[i]);
      if (D + d >= I) {
        const qx = points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
        const qy = points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
        const q = { x: qx, y: qy };
        newPoints.push(q);
        points.splice(i, 0, q);
        D = 0.0;
      } else {
        D += d;
      }
    }
    
    if (newPoints.length === n - 1) {
      newPoints.push(points[points.length - 1]);
    }
    return newPoints;
  };
  
  const pathLength = (points: Point2D[]): number => {
    let d = 0.0;
    for (let i = 1; i < points.length; i++) {
      d += distance(points[i - 1], points[i]);
    }
    return d;
  };
  
  const distance = (p1: Point2D, p2: Point2D): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Scale to square
  const scaleToSquare = (points: Point2D[], size: number): Point2D[] => {
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const w = maxX - minX;
    const h = maxY - minY;
    
    return points.map(p => ({
      x: (p.x - minX) * (size / w),
      y: (p.y - minY) * (size / h)
    }));
  };
  
  // Translate to origin
  const translateToOrigin = (points: Point2D[]): Point2D[] => {
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return points.map(p => ({ x: p.x - cx, y: p.y - cy }));
  };
  
  // Calculate distance between two point arrays
  const pathDistance = (pts1: Point2D[], pts2: Point2D[]): number => {
    let d = 0.0;
    for (let i = 0; i < pts1.length; i++) {
      d += distance(pts1[i], pts2[i]);
    }
    return d / pts1.length;
  };
  
  const looksLikeNumberFive = (path: Path): boolean => {
    if (path.points.length < 8) return false;
    
    // Calculate bounding box
    let minX = path.points[0].x, maxX = path.points[0].x;
    let minY = path.points[0].y, maxY = path.points[0].y;
    for (const p of path.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    console.log('Number 5 check: width=', width, 'height=', height, 'ratio=', width/height);
    
    // "5" should be roughly as tall as wide or taller
    const ratio = width / height;
    if (ratio < 0.4 || ratio > 1.3) {
      console.log('Number 5 check: wrong aspect ratio, rejected');
      return false;
    }
    
    // Check for horizontal line at the top (characteristic of "5")
    const topY = minY + height * 0.3;
    let topHorizontalMovement = 0;
    let topVerticalMovement = 0;
    
    for (let i = 1; i < path.points.length; i++) {
      const y = path.points[i].y;
      if (y < topY) {
        topHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
        topVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
      }
    }
    
    console.log('Number 5 check: top horizontal=', topHorizontalMovement, 'top vertical=', topVerticalMovement);
    
    // "5" should have a horizontal line at the top
    const hasTopHorizontalLine = topHorizontalMovement > width * 0.4;
    
    if (!hasTopHorizontalLine) {
      console.log('Number 5 check: no top horizontal line, rejected');
      return false;
    }
    
    // Check for curve at the bottom (characteristic of "5")
    const bottomY = minY + height * 0.6;
    let bottomHorizontalMovement = 0;
    let bottomVerticalMovement = 0;
    
    for (let i = 1; i < path.points.length; i++) {
      const y = path.points[i].y;
      if (y > bottomY) {
        bottomHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
        bottomVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
      }
    }
    
    console.log('Number 5 check: bottom horizontal=', bottomHorizontalMovement, 'bottom vertical=', bottomVerticalMovement);
    
    // "5" should have a curve at the bottom (both horizontal and vertical movement)
    const hasBottomCurve = bottomHorizontalMovement > width * 0.3 && bottomVerticalMovement > 0;
    
    if (!hasBottomCurve) {
      console.log('Number 5 check: no bottom curve, rejected');
      return false;
    }
    
    console.log('Number 5 check: ACCEPTED as 5!');
    return true;
  };

  const looksLikeNumberFour = (path: Path): boolean => {
    if (path.points.length < 8) return false;
    
    // Calculate bounding box
    let minX = path.points[0].x, maxX = path.points[0].x;
    let minY = path.points[0].y, maxY = path.points[0].y;
    for (const p of path.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    console.log('Number 4 check: width=', width, 'height=', height, 'ratio=', width/height);
    
    // "4" should be roughly as tall as wide or taller (0.5 to 1.3 ratio)
    const ratio = width / height;
    if (ratio < 0.4 || ratio > 1.3) {
      console.log('Number 4 check: wrong aspect ratio, rejected');
      return false;
    }
    
    // Check for horizontal line in the middle (characteristic of "4")
    const midY = minY + height / 2;
    let middleHorizontalMovement = 0;
    let middleVerticalMovement = 0;
    
    // Check middle third for horizontal line
    for (let i = 1; i < path.points.length; i++) {
      const y = path.points[i].y;
      if (y > midY - height * 0.2 && y < midY + height * 0.2) {
        middleHorizontalMovement += Math.abs(path.points[i].x - path.points[i-1].x);
        middleVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
      }
    }
    
    console.log('Number 4 check: middle horizontal=', middleHorizontalMovement, 'middle vertical=', middleVerticalMovement);
    
    // "4" should have a horizontal line in the middle
    const hasMiddleHorizontalLine = middleHorizontalMovement > width * 0.4;
    
    if (!hasMiddleHorizontalLine) {
      console.log('Number 4 check: no middle horizontal line, rejected');
      return false;
    }
    
    // Check for vertical line on the right (characteristic of "4")
    let rightVerticalMovement = 0;
    const rightX = minX + width * 0.6;
    
    for (let i = 1; i < path.points.length; i++) {
      const x = path.points[i].x;
      if (x > rightX) {
        rightVerticalMovement += Math.abs(path.points[i].y - path.points[i-1].y);
      }
    }
    
    console.log('Number 4 check: right vertical movement=', rightVerticalMovement);
    
    // "4" should have a vertical line on the right side
    const hasRightVerticalLine = rightVerticalMovement > height * 0.5;
    
    if (!hasRightVerticalLine) {
      console.log('Number 4 check: no right vertical line, rejected');
      return false;
    }
    
    console.log('Number 4 check: ACCEPTED as 4!');
    return true;
  };

  // Recognize digit 3 using $1 algorithm
  const looksLikeNumberThree = (path: Path): boolean => {
    if (path.points.length < 5) return false;
    
    // Preprocess the input
    const numPoints = 64;
    let points = resample(path.points, numPoints);
    points = scaleToSquare(points, 250);
    points = translateToOrigin(points);
    
    // Templates for digit 3 with variations
    const templates: { [key: string]: number[][] } = {
      '3a': [[-60, -80], [-40, -90], [-20, -95], [0, -100], [20, -95], [40, -90], [60, -80], [40, -60], [20, -40], [0, -20], [20, 0], [40, 20], [60, 40], [60, 60], [40, 80], [20, 90], [0, 95], [-20, 100], [-40, 100], [-60, 95]],
      '3b': [[-50, -90], [-30, -95], [0, -100], [30, -95], [50, -85], [30, -60], [10, -40], [0, -20], [10, 0], [30, 20], [50, 40], [50, 70], [30, 90], [0, 100], [-30, 100], [-50, 90]]
    };
    
    // Preprocess templates
    const processedTemplates: Point2D[][] = [];
    for (const template of Object.values(templates)) {
      let tPoints = template.map(([x, y]) => ({ x, y }));
      tPoints = resample(tPoints, numPoints);
      tPoints = scaleToSquare(tPoints, 250);
      tPoints = translateToOrigin(tPoints);
      processedTemplates.push(tPoints);
    }
    
    // Find best match
    let bestDistance = Infinity;
    
    for (const template of processedTemplates) {
      const d = pathDistance(points, template);
      console.log(`Digit 3 template distance: ${d}`);
      if (d < bestDistance) {
        bestDistance = d;
      }
    }
    
    // Threshold for recognition (lower is better match)
    const threshold = 70;
    
    if (bestDistance < threshold) {
      console.log(`Recognized as digit 3 (distance: ${bestDistance})`);
      return true;
    } else {
      console.log(`Not recognized as digit 3 (distance: ${bestDistance}, threshold: ${threshold})`);
      return false;
    }
  };

  const drawArrowAnimation = (ctx: CanvasRenderingContext2D, rect: Shape, progress: number) => {
    // Draw animated arrow from the rect to the right (matching the list arrows style)
    const startX = rect.x + rect.w;
    const startY = rect.y + rect.h / 2;
    const arrowLength = 32; // Same gap as between nodes (gapX)
    const endX = startX + arrowLength * progress;
    const endY = startY;
    
    ctx.save();
    
    // Arrow color depends on merge step: red for step 0, 3, 4; blue for step 1, 2, 5
    const arrowColor = (mergeStepRef.current === 0 || mergeStepRef.current === 3 || mergeStepRef.current === 4) ? '#ef4444' : '#3b82f6';
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Draw arrow line with hand-drawn effect
    const drawArrowLine = () => {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    };
    handStroke(ctx, drawArrowLine);
    
    // Draw arrowhead if progress > 0.5 (matching the style from mkArrow)
    if (progress > 0.5) {
      const len = Math.max(10, 4 + 2*2); // Same calculation as in drawLine
      const angle = 0; // pointing right
      
      const drawHead = () => {
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - len*Math.cos(angle - Math.PI/6), endY - len*Math.sin(angle - Math.PI/6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - len*Math.cos(angle + Math.PI/6), endY - len*Math.sin(angle + Math.PI/6));
      };
      handStroke(ctx, drawHead);
    }
    
    ctx.restore();
  };

  const drawNumberHint = (ctx: CanvasRenderingContext2D, rect: Shape, elapsed: number) => {
    // Animated hint showing "?" to prompt user to write a number
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    
    // Fade in over 500ms
    const fadeIn = Math.min(1, elapsed / 500);
    // Pulsing effect
    const pulse = 0.8 + 0.2 * Math.sin(elapsed / 300);
    
    ctx.save();
    ctx.globalAlpha = fadeIn * pulse;
    
    // Draw question mark
    ctx.font = 'bold 24px "Comic Sans MS", "Segoe UI", ui-sans-serif';
    ctx.fillStyle = '#3b82f6'; // Blue color
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    
    // Draw subtle glow
    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText('?', cx, cy);
    
    ctx.restore();
  };

  const drawGuideHighlighter = (ctx: CanvasRenderingContext2D, node: Shape, progress: number) => {
    // Draw a moving highlighter dot around the rectangle perimeter to guide user
    const padding = 0; // No padding - same size as the node
    const x = node.x - padding;
    const y = node.y - padding;
    const w = node.w + padding * 2;
    const h = node.h + padding * 2;
    
    // Calculate perimeter and position along it
    const perimeter = 2 * (w + h);
    const distance = progress * perimeter;
    
    let px, py;
    if (distance < w) {
      // Top edge (left to right)
      px = x + distance;
      py = y;
    } else if (distance < w + h) {
      // Right edge (top to bottom)
      px = x + w;
      py = y + (distance - w);
    } else if (distance < 2 * w + h) {
      // Bottom edge (right to left)
      px = x + w - (distance - w - h);
      py = y + h;
    } else {
      // Left edge (bottom to top)
      px = x;
      py = y + h - (distance - 2 * w - h);
    }
    
    // Update trail points
    const currentTime = animTimeRef.current;
    guideTrailPoints.current.push({ x: px, y: py, age: currentTime });
    
    // Remove old trail points (older than 800ms)
    const maxAge = 800;
    guideTrailPoints.current = guideTrailPoints.current.filter(
      point => currentTime - point.age < maxAge
    );
    
    ctx.save();
    
    // Draw trail (older points first, fading out)
    for (let i = 0; i < guideTrailPoints.current.length; i++) {
      const point = guideTrailPoints.current[i];
      const age = currentTime - point.age;
      const fadeProgress = 1 - (age / maxAge); // 1 = newest, 0 = oldest
      
      // Trail gets smaller and more transparent as it ages
      const trailRadius = 15 * fadeProgress;
      const trailAlpha = 0.4 * fadeProgress;
      
      const trailGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, trailRadius);
      trailGradient.addColorStop(0, `rgba(255, 255, 0, ${trailAlpha * 0.8})`);
      trailGradient.addColorStop(0.5, `rgba(255, 255, 0, ${trailAlpha * 0.4})`);
      trailGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      
      ctx.fillStyle = trailGradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw main glowing highlighter dot (on top of trail)
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, 20);
    gradient.addColorStop(0, 'rgba(255, 255, 0, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bright center
    ctx.fillStyle = 'rgba(255, 255, 0, 1)';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Add pulsing effect
    const pulse = 0.7 + 0.3 * Math.sin(animTimeRef.current / 200);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const drawLastStrokeSegment = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentPathRef.current) return;

    const dpr = dprRef.current;
    // redraw minimal: draw only the last segment on top of existing
    // For simplicity and correctness, we redraw everything (still fast enough)
    redraw();
  };

  const undo = () => { undoAll(); };
  const redo = () => { redoAll(); };

  const clearAll = () => {
    recordBeforeChange();
    setPaths([]);
    setShapes([]);
    setLines([]);
    setSelectedId(null);
    setSelectedKind(null);
    setTimeout(redraw, 0);
  };

  // When color or size changes and an item is selected, update that item's style
  useEffect(() => {
    if (!selectedId || !selectedKind) return;
    recordBeforeChange();
    if (selectedKind === 'shape') {
      setShapes(prev => prev.map(s => s.id === selectedId ? { ...s, stroke: color, strokeWidth: size } : s));
    } else if (selectedKind === 'path') {
      setPaths(prev => prev.map(p => p.id === selectedId ? { ...p, color, size } : p));
    } else if (selectedKind === 'line') {
      setLines(prev => prev.map(l => l.id === selectedId ? { ...l, stroke: color, strokeWidth: size } : l));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, size]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `canvas_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Shared style for icon buttons to keep sizes identical
  const iconBtnStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  };
  // Shared style for submenu option buttons (same size)
  const menuBtnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  };

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Inject keyframes for guide baton animation */}
      <style>{`
        @keyframes glowSweep {
          0%   { left: 0; top: 0; }
          24%  { left: calc(100% - 8px); top: 0; }
          25%  { left: calc(100% - 8px); top: 0; }
          49%  { left: calc(100% - 8px); top: calc(100% - 8px); }
          50%  { left: calc(100% - 8px); top: calc(100% - 8px); }
          74%  { left: 0; top: calc(100% - 8px); }
          75%  { left: 0; top: calc(100% - 8px); }
          100% { left: 0; top: 0; }
        }
      `}</style>
      {/* Top toolbar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
        {/* Tools: select, pen icon, shapes icon, line icon */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setTool('select'); setShapesMenuOpen(false); }}
            title="选择"
            style={{ ...iconBtnStyle, background: tool==='select'? '#e0f2ff': undefined }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 3 L4 17 L8.2 14.8 L10 20 L12.4 19.1 L10.6 13.9 L15 14 Z" />
            </svg>
          </button>
          <button onClick={() => { setTool('pen'); setShapesMenuOpen(false); }}
            title="画笔"
            style={{ ...iconBtnStyle, background: tool==='pen'? '#e0f2ff': undefined }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setTool(tool==='rect'||tool==='ellipse'||tool==='triangle'? tool : 'rect'); setShapesMenuOpen(v=>!v);} }
              title="图形"
              style={{ ...iconBtnStyle, background: (tool==='rect'||tool==='ellipse'||tool==='triangle')? '#e0f2ff': undefined }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="12" width="7" height="7"/>
                <circle cx="17" cy="7" r="3.5"/>
                <path d="M12 20 L20 20 L16 14 Z"/>
              </svg>
            </button>
            {shapesMenuOpen && (
              <div style={{ position: 'absolute', top: '36px', left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 18px rgba(0,0,0,0.08)', padding: 6, display: 'flex', gap: 8, zIndex: 10 }}>
                <button onClick={() => { setTool('rect'); setShapesMenuOpen(false); }} title="矩形" style={{ ...menuBtnStyle, background: tool==='rect'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="12" rx="2"/></svg>
                </button>
                <button onClick={() => { setTool('ellipse'); setShapesMenuOpen(false); }} title="圆形" style={{ ...menuBtnStyle, background: tool==='ellipse'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7"/></svg>
                </button>
                <button onClick={() => { setTool('triangle'); setShapesMenuOpen(false); }} title="三角形" style={{ ...menuBtnStyle, background: tool==='triangle'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4l8 14H4z"/></svg>
                </button>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => { setTool('line'); setLinesMenuOpen(v=>!v); }}
              title="线段"
              style={{ ...iconBtnStyle, background: tool==='line'? '#e0f2ff': undefined }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 18 L20 6" />
              </svg>
            </button>
            {linesMenuOpen && (
              <div style={{ position: 'absolute', top: '36px', left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 18px rgba(0,0,0,0.08)', padding: 6, display: 'flex', gap: 8, zIndex: 10 }}>
                <button onClick={() => { setLineStyle('solid'); setTool('line'); setLinesMenuOpen(false); }} title="实线" style={{ ...menuBtnStyle, background: lineStyle==='solid'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12 L20 12"/></svg>
                </button>
                <button onClick={() => { setLineStyle('dashed'); setTool('line'); setLinesMenuOpen(false); }} title="虚线" style={{ ...menuBtnStyle, background: lineStyle==='dashed'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeDasharray="6 4" d="M4 12 L20 12"/></svg>
                </button>
                <button onClick={() => { setLineStyle('arrow'); setTool('line'); setLinesMenuOpen(false); }} title="箭头" style={{ ...menuBtnStyle, background: lineStyle==='arrow'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12 L18 12"/><path d="M14 8 L18 12 L14 16"/></svg>
                </button>
                <button onClick={() => { setLineStyle('doubleArrow'); setTool('line'); setLinesMenuOpen(false); }} title="双箭头" style={{ ...menuBtnStyle, background: lineStyle==='doubleArrow'? '#e0f2ff': undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12 L18 12"/><path d="M6 12 L10 8 M6 12 L10 16"/><path d="M18 12 L14 8 M18 12 L14 16"/></svg>
                </button>
              </div>
            )}
          </div>
          {/* Text tool */}
          <button onClick={() => { setTool('text'); setShapesMenuOpen(false); setLinesMenuOpen(false); }}
            title="文字"
            style={{ ...iconBtnStyle, background: tool==='text'? '#e0f2ff': undefined }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16"/>
              <path d="M12 6v12"/>
              <path d="M6 18h12" strokeDasharray="3 3"/>
            </svg>
          </button>
          {/* Eraser tool */}
          <button onClick={() => { setTool('eraser'); setShapesMenuOpen(false); setLinesMenuOpen(false); }}
            title="橡皮擦（删除整块）"
            style={{ ...iconBtnStyle, background: tool==='eraser'? '#e0f2ff': undefined }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* tilted eraser body */}
              <path d="M16 3l5 5-9 9H7l-3-3 9-9z"/>
              {/* erase trail */}
              <path d="M3 20h12"/>
            </svg>
          </button>
        </div>

        {/* Actions (icon-only) */}
        <button onClick={undo} disabled={history.length === 0} title="撤销 (Ctrl/Cmd+Z)" style={{ ...iconBtnStyle, opacity: (history.length===0)? 0.5:1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6"/>
            <path d="M23 20a11 11 0 0 0-11-11H7"/>
          </svg>
        </button>
        <button onClick={redo} disabled={future.length === 0} title="重做 (Ctrl+Shift+Z / Cmd+Shift+Z)" style={{ ...iconBtnStyle, opacity: (future.length===0)? 0.5:1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/>
            <path d="M1 20a11 11 0 0 1 11-11h6"/>
          </svg>
        </button>
        <div style={{ width: 1, height: 24, background: '#eee', margin: '0 6px' }} />
        {/* Color (icon + input, shows current color swatch) */}
        <div title="颜色" style={{ ...iconBtnStyle, position: 'relative' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-3a2 2 0 1 1 0-4h1"/>
          </svg>
          {/* colored swatch overlay */}
          <div style={{ position: 'absolute', right: 6, bottom: 6, width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: '0 0 0 2px #fff' }} />
          <input aria-label="color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </div>
        {/* Stroke width (icon + range) */}
        <div title="粗细" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ ...iconBtnStyle }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h16"/>
            </svg>
          </div>
          <input
            aria-label="size"
            type="range"
            min={1}
            max={10}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </div>
        {/* <div style={{ marginLeft: 'auto', opacity: 0.6 }}>轻量白板（不依赖 Excalidraw）</div> */}
      </div>

      {/* Canvas area */}
      <div ref={drawingRef} style={{ position: 'relative', flex: 1 }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            touchAction: 'none',
            background: '#fff',
            cursor: selectionDragRef.current
              ? 'grabbing'
              : (showNumberHint && tool === 'pen'
                ? 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMjBoOSIgc3Ryb2tlPSIjM2I4MmY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNi41IDMuNWEyLjEyMSAyLjEyMSAwIDAgMSAzIDNMNyAxOWwtNCAxIDEtNCAxMi41LTEyLjV6IiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+") 0 24, auto'
                : (tool === 'pen' || tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'triangle'
                  ? 'crosshair'
                  : (tool === 'text'
                    ? 'text'
                    : (tool === 'eraser'
                      ? 'not-allowed'
                      : (selectedKind ? 'grab' : 'default')))))
          }}
          onPointerDown={startDrawing}
          onPointerMove={drawMove}
          onPointerUp={endDrawing}
          onPointerCancel={endDrawing}
          onDoubleClick={(e) => {
            const p = pointerPos(e as any);
            const hit = hitTest(p.x, p.y);
            if (hit && hit.shape && hit.shape.type === 'text') {
              const s = hit.shape;
              setSelectedId(s.id); setSelectedKind('shape');
              setTextInput({ x: s.x, y: s.y, value: s.label ?? '' });
              setTimeout(() => textInputRef.current?.focus(), 0);
            }
          }}
          onPointerEnter={() => showCursor()}
          onPointerLeave={(e) => {
            setCursorVisible(false);
            // If dragging, end the drag to commit the position when pointer leaves canvas
            if (selectionDragRef.current) {
              endDrawing(e as any);
            }
          }}
        />
        {/* Inline text input for Text tool */}
        {textInput && (
          <input
            ref={textInputRef}
            value={textInput.value}
            onChange={(e) => setTextInput(prev => prev ? { ...prev, value: e.target.value } : prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (textCommittingRef.current) return;
                textCommittingRef.current = true;
                const v = textInput.value.trim();
                if (v) {
                  recordBeforeChange();
                  const fontSize = 16;
                  const padding = 6;
                  const textW = measureTextWidth(v, fontSize);
                  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const newShape: Shape = { id, type: 'text', x: textInput.x, y: textInput.y, w: textW + padding*2, h: fontSize + padding*2, stroke: color, strokeWidth: 1.5, label: v, labelSize: fontSize };
                  setShapes(prev => [...prev, newShape]);
                  setSelectedId(id); setSelectedKind('shape');
                }
                setTextInput(null);
                setTool('select');
                setTimeout(() => { textCommittingRef.current = false; }, 0);
              } else if (e.key === 'Escape') {
                setTextInput(null);
                setTool('select');
              }
            }}
            onBlur={() => {
              if (textCommittingRef.current) { textCommittingRef.current = false; setTextInput(null); setTool('select'); return; }
              const v = textInput.value.trim();
              if (v) {
                recordBeforeChange();
                const fontSize = 16;
                const padding = 6;
                const textW = measureTextWidth(v, fontSize);
                const id = `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                const newShape: Shape = { id, type: 'text', x: textInput.x, y: textInput.y, w: textW + padding*2, h: fontSize + padding*2, stroke: color, strokeWidth: 1.5, label: v, labelSize: fontSize };
                setShapes(prev => [...prev, newShape]);
                setSelectedId(id); setSelectedKind('shape');
              }
              setTextInput(null);
              setTool('select');
            }}
            style={{
              position: 'absolute',
              left: textInput.x,
              top: textInput.y,
              minWidth: 80,
              padding: '4px 6px',
              fontSize: 16,
              fontFamily: '"Comic Sans MS", "Segoe UI", ui-sans-serif',
              color: color,
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              outline: 'none',
              background: '#fff',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
            }}
          />
        )}
        {/* Color selection in toolbar style */}
        {showColorSelection && userCreatedRectIdRef.current && (() => {
          const createdRect = shapes.find(s => s.id === userCreatedRectIdRef.current);
          if (!createdRect) return null;
          const toolbarX = createdRect.x + createdRect.w / 2;
          const toolbarY = createdRect.y + createdRect.h + 20;
          return (
            <div style={{
              position: 'absolute',
              left: toolbarX,
              top: toolbarY,
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '8px 12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backdropFilter: 'blur(8px)'
            }}>
              <div style={{ fontSize: 12, fontWeight: '500', color: '#9ca3af' }}>
                选择颜色
              </div>
              <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {/* Blue color option */}
                <button
                  onClick={() => handleColorSelect('blue')}
                  title="list 1 (蓝色)"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    border: '2px solid #3b82f6',
                    borderRadius: 4,
                    background: '#3b82f6',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: '0 1px 3px rgba(59,130,246,0.4)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(59,130,246,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(59,130,246,0.4)';
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    bottom: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: '#9ca3af',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                  }}>list 1</div>
                </button>
                {/* Red color option */}
                <button
                  onClick={() => handleColorSelect('red')}
                  title="list 2 (红色)"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    border: '2px solid #ef4444',
                    borderRadius: 4,
                    background: '#ef4444',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: '0 1px 3px rgba(239,68,68,0.4)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(239,68,68,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(239,68,68,0.4)';
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    bottom: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: '#9ca3af',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                  }}>list 2</div>
                </button>
              </div>
            </div>
          );
        })()}
        {/* Visible pointer overlay */}
        {cursorVisible && (
          <div
            style={{
              position: 'absolute',
              left: Math.round(cursorPos.x) - Math.max(6, size/2),
              top: Math.round(cursorPos.y) - Math.max(6, size/2),
              width: Math.max(12, size),
              height: Math.max(12, size),
              borderRadius: '50%',
              border: `2px solid ${color}`,
              background: 'transparent',
              pointerEvents: 'none',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.1)'
            }}
          />
        )}
        {/* Shape ghost preview near cursor for shape tools */}
        {cursorVisible && (tool === 'rect' || tool === 'ellipse' || tool === 'triangle') && (
          <div
            style={{
              position: 'absolute',
              left: Math.round(cursorPos.x) - (tool === 'rect' && guideAnimationRef.current ? GUIDE_RECT_WIDTH/2 : DEFAULT_SHAPE_SIZE/2),
              top: Math.round(cursorPos.y) - (tool === 'rect' && guideAnimationRef.current ? GUIDE_RECT_HEIGHT/2 : DEFAULT_SHAPE_SIZE/2),
              width: tool === 'rect' && guideAnimationRef.current ? GUIDE_RECT_WIDTH : DEFAULT_SHAPE_SIZE,
              height: tool === 'rect' && guideAnimationRef.current ? GUIDE_RECT_HEIGHT : DEFAULT_SHAPE_SIZE,
              border: '2px dashed rgba(0,0,0,0.35)',
              borderRadius: tool === 'ellipse' ? '50%' : '6px',
              pointerEvents: 'none',
              background: 'transparent',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)'
            }}
          />
        )}
      </div>
    </div>
  );
}
