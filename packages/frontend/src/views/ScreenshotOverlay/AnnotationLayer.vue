<script setup lang="ts">
import {
  computed,
  type CSSProperties,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";

import {
  type Annotation,
  type AnnotationCapture,
  type AnnotationPoint,
  AnnotationTool,
  type AnnotationTool as AnnotationToolType,
  drawAnnotations,
  getRect,
  getStepRadius,
  getTextFont,
  getTextPadding,
  isShapeAnnotation,
  nextStepNumber,
  type TextAnnotation,
} from "@/utils/annotations";

const {
  annotations,
  tool,
  color,
  strokeWidth,
  fontSize,
  fontFamily,
  fontWeight,
  fontStyle,
  underline,
  indent,
  boxed,
} = defineProps<{
  annotations: Annotation[];
  tool: AnnotationToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  underline: boolean;
  indent: number;
  boxed: boolean;
}>();

const emit = defineEmits<{
  add: [annotation: Annotation];
  update: [annotations: Annotation[]];
  remove: [ids: string[]];
  cancel: [];
}>();

const containerRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const textInputRef = ref<HTMLInputElement>();
const draft = ref<Annotation>();

type TextDraft = {
  id?: string;
  x: number;
  y: number;
  text: string;
  color: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  underline: boolean;
  indent: number;
  boxed: boolean;
};

const textDraft = ref<TextDraft>();
const drawing = ref(false);
const selectedIds = ref<string[]>([]);
const drag = ref<DragState>();
const marquee = ref<MarqueeState>();
let lastTextClick: { id: string; at: number } | undefined;

let resizeObserver: ResizeObserver | undefined;

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type DragState = {
  kind: "move" | "resize";
  start: AnnotationPoint;
  originals: Annotation[];
  currents: Annotation[];
  handle?: ResizeHandle;
  moved: boolean;
};

type MarqueeState = {
  start: AnnotationPoint;
  end: AnnotationPoint;
  additive: boolean;
  moved: boolean;
};

type Bounds = { x: number; y: number; width: number; height: number };

function cloneAnnotation(annotation: Annotation): Annotation {
  return JSON.parse(JSON.stringify(annotation)) as Annotation;
}

const isDrawingTool = computed(() => tool !== AnnotationTool.Select);

const textInputStyle = computed<CSSProperties>(() => {
  const input = textDraft.value;
  if (input === undefined) {
    return {};
  }

  return {
    left: `calc(${input.x * 100}% + ${input.indent}px)`,
    top: `${input.y * 100}%`,
    color: input.color,
    borderColor: input.color,
    fontSize: `${input.fontSize}px`,
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight,
    fontStyle: input.fontStyle,
    textDecoration: input.underline ? "underline" : "none",
    borderRadius: input.boxed ? "0.35rem" : undefined,
  };
});

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getPoint(event: PointerEvent): AnnotationPoint {
  const canvas = canvasRef.value;
  if (canvas === undefined) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  };
}

function getScale(): { canvas: HTMLCanvasElement; scale: number } | undefined {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (canvas === undefined || container === undefined) {
    return undefined;
  }

  return {
    canvas,
    scale:
      container.clientWidth === 0 ? 1 : canvas.width / container.clientWidth,
  };
}

function getAnnotationBounds(annotation: Annotation): Bounds | undefined {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  const ctx = canvas?.getContext("2d");
  if (
    canvas === undefined ||
    container === undefined ||
    ctx === null ||
    ctx === undefined
  ) {
    return undefined;
  }

  const scale =
    container.clientWidth === 0 ? 1 : canvas.width / container.clientWidth;
  const width = canvas.width;
  const height = canvas.height;
  const pad = Math.max(1, (annotation.width * scale) / 2);

  if (annotation.type === "pen" || annotation.type === "highlighter") {
    const first = annotation.points[0];
    if (first === undefined) {
      return undefined;
    }

    let minX = first.x;
    let minY = first.y;
    let maxX = first.x;
    let maxY = first.y;

    for (const point of annotation.points.slice(1)) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX * width - pad,
      y: minY * height - pad,
      width: (maxX - minX) * width + pad * 2,
      height: (maxY - minY) * height + pad * 2,
    };
  }

  if (isShapeAnnotation(annotation)) {
    const rect = getRect(annotation.start, annotation.end);
    return {
      x: rect.x * width - pad,
      y: rect.y * height - pad,
      width: rect.width * width + pad * 2,
      height: rect.height * height + pad * 2,
    };
  }

  if (annotation.type === "text") {
    const fontSize = annotation.fontSize * scale;
    ctx.font = getTextFont(annotation, scale);
    const textWidth = ctx.measureText(annotation.text).width;
    const indent = (annotation.indent ?? 0) * scale;
    const padding = getTextPadding(annotation.fontSize) * scale;

    if (annotation.boxed === true) {
      return {
        x: annotation.position.x * width - padding,
        y: annotation.position.y * height - padding,
        width: textWidth + indent + padding * 2,
        height: fontSize * 1.25 + padding * 2,
      };
    }

    return {
      x: annotation.position.x * width + indent,
      y: annotation.position.y * height,
      width: Math.max(textWidth, fontSize),
      height: fontSize * 1.25,
    };
  }

  if (annotation.type === "step") {
    const radius = getStepRadius(annotation.fontSize, annotation.number, scale);
    return {
      x: annotation.position.x * width - radius,
      y: annotation.position.y * height - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  return undefined;
}

function getNormalizedBounds(annotation: Annotation): Bounds | undefined {
  const bounds = getAnnotationBounds(annotation);
  const canvas = canvasRef.value;
  if (bounds === undefined || canvas === undefined) {
    return undefined;
  }

  return {
    x: bounds.x / canvas.width,
    y: bounds.y / canvas.height,
    width: bounds.width / canvas.width,
    height: bounds.height / canvas.height,
  };
}

function getHandleAt(
  bounds: Bounds,
  point: AnnotationPoint,
): ResizeHandle | undefined {
  const canvas = canvasRef.value;
  if (canvas === undefined) {
    return undefined;
  }

  const scale = getScale()?.scale ?? 1;
  const px = point.x * canvas.width;
  const py = point.y * canvas.height;
  const radius = 10 * scale;
  const corners: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: "nw", x: bounds.x, y: bounds.y },
    { handle: "ne", x: bounds.x + bounds.width, y: bounds.y },
    { handle: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { handle: "sw", x: bounds.x, y: bounds.y + bounds.height },
  ];

  return corners.find(
    (corner) => Math.hypot(px - corner.x, py - corner.y) <= radius,
  )?.handle;
}

function isPointInAnnotation(
  annotation: Annotation,
  point: AnnotationPoint,
): boolean {
  const bounds = getAnnotationBounds(annotation);
  const canvas = canvasRef.value;
  if (bounds === undefined || canvas === undefined) {
    return false;
  }

  const px = point.x * canvas.width;
  const py = point.y * canvas.height;
  const pad = 5 * (getScale()?.scale ?? 1);

  return (
    px >= bounds.x - pad &&
    px <= bounds.x + bounds.width + pad &&
    py >= bounds.y - pad &&
    py <= bounds.y + bounds.height + pad
  );
}

function translateAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
): Annotation {
  const bounds = getNormalizedBounds(annotation);
  if (bounds === undefined) {
    return annotation;
  }

  const nextX = Math.min(
    Math.max(-bounds.x, dx),
    Math.max(0, 1 - bounds.x - bounds.width),
  );
  const nextY = Math.min(
    Math.max(-bounds.y, dy),
    Math.max(0, 1 - bounds.y - bounds.height),
  );
  const move = (point: AnnotationPoint): AnnotationPoint => ({
    x: clamp(point.x + nextX),
    y: clamp(point.y + nextY),
  });

  if (annotation.type === "pen" || annotation.type === "highlighter") {
    return { ...annotation, points: annotation.points.map(move) };
  }

  if (isShapeAnnotation(annotation)) {
    return {
      ...annotation,
      start: move(annotation.start),
      end: move(annotation.end),
    };
  }

  if (annotation.type === "text" || annotation.type === "step") {
    return { ...annotation, position: move(annotation.position) };
  }

  return annotation;
}

function getSelectionBounds(selected: Annotation[]): Bounds | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const annotation of selected) {
    const bounds = getNormalizedBounds(annotation);
    if (bounds === undefined) {
      continue;
    }
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  if (minX === Number.POSITIVE_INFINITY) {
    return undefined;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function toCanvasBounds(bounds: Bounds): Bounds | undefined {
  const canvas = canvasRef.value;
  if (canvas === undefined) {
    return undefined;
  }

  return {
    x: bounds.x * canvas.width,
    y: bounds.y * canvas.height,
    width: bounds.width * canvas.width,
    height: bounds.height * canvas.height,
  };
}

function translateSelection(
  originals: Annotation[],
  dx: number,
  dy: number,
): Annotation[] {
  const bounds = getSelectionBounds(originals);
  if (bounds === undefined) {
    return originals;
  }

  const nextX = Math.min(
    Math.max(-bounds.x, dx),
    Math.max(0, 1 - bounds.x - bounds.width),
  );
  const nextY = Math.min(
    Math.max(-bounds.y, dy),
    Math.max(0, 1 - bounds.y - bounds.height),
  );

  return originals.map((annotation) =>
    translateAnnotation(annotation, nextX, nextY),
  );
}

function scaleAnnotation(
  annotation: Annotation,
  anchorX: number,
  anchorY: number,
  sx: number,
  sy: number,
): Annotation {
  if (annotation.type === "text" || annotation.type === "step") {
    const factor = Math.max(sx, sy);
    return {
      ...annotation,
      position: {
        x: clamp(anchorX + (annotation.position.x - anchorX) * factor),
        y: clamp(anchorY + (annotation.position.y - anchorY) * factor),
      },
      fontSize: Math.min(200, Math.max(6, annotation.fontSize * factor)),
    };
  }

  const scalePoint = (point: AnnotationPoint): AnnotationPoint => ({
    x: clamp(anchorX + (point.x - anchorX) * sx),
    y: clamp(anchorY + (point.y - anchorY) * sy),
  });

  if (annotation.type === "pen" || annotation.type === "highlighter") {
    return { ...annotation, points: annotation.points.map(scalePoint) };
  }

  if (isShapeAnnotation(annotation)) {
    return {
      ...annotation,
      start: scalePoint(annotation.start),
      end: scalePoint(annotation.end),
    };
  }

  return annotation;
}

function resizeSelection(
  originals: Annotation[],
  handle: ResizeHandle,
  point: AnnotationPoint,
): Annotation[] {
  const bounds = getSelectionBounds(originals);
  if (bounds === undefined) {
    return originals;
  }

  const anchorX = handle.includes("w") ? bounds.x + bounds.width : bounds.x;
  const anchorY = handle.includes("n") ? bounds.y + bounds.height : bounds.y;
  const cornerX = handle.includes("w") ? bounds.x : bounds.x + bounds.width;
  const cornerY = handle.includes("n") ? bounds.y : bounds.y + bounds.height;
  const safeScale = (value: number): number =>
    Math.min(20, Math.max(0.05, value));
  const sx = safeScale(
    Math.abs(cornerX - anchorX) < 0.0001
      ? 1
      : (point.x - anchorX) / (cornerX - anchorX),
  );
  const sy = safeScale(
    Math.abs(cornerY - anchorY) < 0.0001
      ? 1
      : (point.y - anchorY) / (cornerY - anchorY),
  );

  return originals.map((annotation) =>
    scaleAnnotation(annotation, anchorX, anchorY, sx, sy),
  );
}

function drawSelectionBounds(
  bounds: Bounds,
  handles: boolean,
  subtle = false,
): void {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (canvas === undefined || ctx === null || ctx === undefined) {
    return;
  }

  const scale = getScale()?.scale ?? 1;
  const handleSize = 8 * scale;
  const half = handleSize / 2;
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];

  ctx.save();
  ctx.strokeStyle = subtle ? "rgba(56, 189, 248, 0.65)" : "#38bdf8";
  ctx.lineWidth = (subtle ? 1 : 1.5) * scale;
  ctx.setLineDash(subtle ? [3 * scale, 3 * scale] : [5 * scale, 3 * scale]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

  if (handles) {
    ctx.setLineDash([]);
    for (const corner of corners) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(corner.x - half, corner.y - half, handleSize, handleSize);
      ctx.strokeStyle = "#0ea5e9";
      ctx.strokeRect(corner.x - half, corner.y - half, handleSize, handleSize);
    }
  }

  ctx.restore();
}

function getDisplayedAnnotation(id: string): Annotation | undefined {
  const dragged = drag.value?.currents.find(
    (annotation) => annotation.id === id,
  );
  if (dragged !== undefined) {
    return dragged;
  }

  return annotations.find((annotation) => annotation.id === id);
}

function getDisplayedSelection(): Annotation[] {
  return selectedIds.value.flatMap((id) => {
    const annotation = getDisplayedAnnotation(id);
    return annotation === undefined ? [] : [annotation];
  });
}

function drawSelection(): void {
  const selected = getDisplayedSelection();
  if (selected.length === 0) {
    return;
  }

  if (selected.length === 1) {
    const bounds = getAnnotationBounds(selected[0]!);
    if (bounds !== undefined) {
      drawSelectionBounds(bounds, true);
    }
    return;
  }

  for (const annotation of selected) {
    const bounds = getAnnotationBounds(annotation);
    if (bounds !== undefined) {
      drawSelectionBounds(bounds, false, true);
    }
  }

  const groupBounds = getSelectionBounds(selected);
  const canvasBounds =
    groupBounds === undefined ? undefined : toCanvasBounds(groupBounds);
  if (canvasBounds !== undefined) {
    drawSelectionBounds(canvasBounds, true);
  }
}

function drawMarquee(): void {
  const state = marquee.value;
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (
    state === undefined ||
    canvas === undefined ||
    ctx === null ||
    ctx === undefined
  ) {
    return;
  }

  const rect = getRect(state.start, state.end);
  const scale = getScale()?.scale ?? 1;

  ctx.save();
  ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([5 * scale, 3 * scale]);
  ctx.fillRect(
    rect.x * canvas.width,
    rect.y * canvas.height,
    rect.width * canvas.width,
    rect.height * canvas.height,
  );
  ctx.strokeRect(
    rect.x * canvas.width,
    rect.y * canvas.height,
    rect.width * canvas.width,
    rect.height * canvas.height,
  );
  ctx.restore();
}

function draw(): void {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (canvas === undefined || container === undefined) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const visibleAnnotations = annotations.map(
    (annotation) => getDisplayedAnnotation(annotation.id) ?? annotation,
  );
  const allAnnotations =
    draft.value === undefined
      ? visibleAnnotations
      : [...visibleAnnotations, draft.value];
  const scale =
    container.clientWidth === 0 ? 1 : canvas.width / container.clientWidth;

  drawAnnotations(ctx, allAnnotations, canvas.width, canvas.height, scale);

  if (draft.value !== undefined) {
    return;
  }

  drawSelection();
  drawMarquee();
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (canvas === undefined || container === undefined) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(container.clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(container.clientHeight * dpr));
  draw();
}

function commitText(): void {
  const input = textDraft.value;
  if (input === undefined) {
    return;
  }

  textDraft.value = undefined;
  const text = input.text.trim();

  if (input.id !== undefined) {
    const original = annotations.find(
      (annotation): annotation is TextAnnotation =>
        annotation.id === input.id && annotation.type === "text",
    );
    if (original === undefined) {
      return;
    }
    if (text === "") {
      emit("remove", [input.id]);
      return;
    }
    if (
      original.text === text &&
      (original.indent ?? 0) === input.indent &&
      (original.boxed ?? false) === input.boxed
    ) {
      return;
    }
    emit("update", [
      { ...original, text, indent: input.indent, boxed: input.boxed },
    ]);
    return;
  }

  if (text === "") {
    return;
  }

  emit("add", {
    id: crypto.randomUUID(),
    type: "text",
    position: { x: input.x, y: input.y },
    text,
    color: input.color,
    width: input.width,
    fontSize: input.fontSize,
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight,
    fontStyle: input.fontStyle,
    underline: input.underline,
    indent: input.indent,
    boxed: input.boxed,
  });
}

function cancelText(): void {
  textDraft.value = undefined;
}

function openTextInput(
  point: AnnotationPoint,
  annotation?: TextAnnotation,
): void {
  textDraft.value = {
    id: annotation?.id,
    x: annotation?.position.x ?? point.x,
    y: annotation?.position.y ?? point.y,
    text: annotation?.text ?? "",
    color: annotation?.color ?? color,
    width: annotation?.width ?? strokeWidth,
    fontSize: annotation?.fontSize ?? fontSize,
    fontFamily: annotation?.fontFamily ?? fontFamily,
    fontWeight: annotation?.fontWeight ?? fontWeight,
    fontStyle: annotation?.fontStyle ?? fontStyle,
    underline: annotation?.underline ?? underline,
    indent: annotation?.indent ?? indent,
    boxed: annotation?.boxed ?? boxed,
  };
  void nextTick(() => {
    const input = textInputRef.value;
    input?.focus();
    if (annotation !== undefined) {
      input?.select();
    }
  });
}

function addStep(point: AnnotationPoint): void {
  emit("add", {
    id: crypto.randomUUID(),
    type: "step",
    position: point,
    number: nextStepNumber(annotations),
    color,
    width: strokeWidth,
    fontSize,
    fontFamily,
  });
}

function startDrawing(event: PointerEvent, point: AnnotationPoint): void {
  const id = crypto.randomUUID();

  if (tool === AnnotationTool.Pen || tool === AnnotationTool.Highlighter) {
    draft.value = {
      id,
      type: tool,
      points: [point],
      color,
      width:
        tool === AnnotationTool.Highlighter ? strokeWidth * 4 : strokeWidth,
    };
  } else if (
    tool === AnnotationTool.Arrow ||
    tool === AnnotationTool.Rectangle ||
    tool === AnnotationTool.Ellipse ||
    tool === AnnotationTool.Redact
  ) {
    draft.value = {
      id,
      type: tool,
      start: point,
      end: point,
      color,
      width: strokeWidth,
    };
  } else {
    return;
  }

  drawing.value = true;
  canvasRef.value?.setPointerCapture(event.pointerId);
  draw();
}

function beginDrag(
  event: PointerEvent,
  annotationsToDrag: Annotation[],
  point: AnnotationPoint,
  kind: "move" | "resize",
  handle?: ResizeHandle,
): void {
  selectedIds.value = annotationsToDrag.map((annotation) => annotation.id);
  const originals = annotationsToDrag.map(cloneAnnotation);
  drag.value = {
    kind,
    start: point,
    originals,
    currents: originals.map(cloneAnnotation),
    handle,
    moved: false,
  };
  canvasRef.value?.setPointerCapture(event.pointerId);
  draw();
}

function startSelection(
  event: PointerEvent,
  point: AnnotationPoint,
  additive: boolean,
): void {
  const selected = getSelectionBounds(getDisplayedSelection());
  const selectedBounds =
    selected === undefined ? undefined : toCanvasBounds(selected);
  const selectedHandle =
    selectedBounds === undefined
      ? undefined
      : getHandleAt(selectedBounds, point);

  if (selectedHandle !== undefined) {
    beginDrag(event, getDisplayedSelection(), point, "resize", selectedHandle);
    return;
  }

  const hit = [...annotations]
    .reverse()
    .find((annotation) => isPointInAnnotation(annotation, point));

  if (hit !== undefined) {
    if (hit.type === "text" && !additive) {
      const now = performance.now();
      if (
        lastTextClick !== undefined &&
        lastTextClick.id === hit.id &&
        now - lastTextClick.at < 400
      ) {
        lastTextClick = undefined;
        selectedIds.value = [hit.id];
        openTextInput(hit.position, hit);
        draw();
        return;
      }
      lastTextClick = { id: hit.id, at: now };
    } else if (!additive) {
      lastTextClick = undefined;
    }

    if (additive) {
      selectedIds.value = selectedIds.value.includes(hit.id)
        ? selectedIds.value.filter((id) => id !== hit.id)
        : [...selectedIds.value, hit.id];
      draw();
      return;
    }

    const targets = selectedIds.value.includes(hit.id)
      ? getDisplayedSelection()
      : [hit];
    beginDrag(event, targets, point, "move");
    return;
  }

  if (!additive) {
    selectedIds.value = [];
  }
  lastTextClick = undefined;
  marquee.value = {
    start: point,
    end: point,
    additive,
    moved: false,
  };
  canvasRef.value?.setPointerCapture(event.pointerId);
  draw();
}

function updateCursor(event: PointerEvent): void {
  const canvas = canvasRef.value;
  if (canvas === undefined || tool !== AnnotationTool.Select) {
    return;
  }

  const point = getPoint(event);
  const selected = getDisplayedSelection();
  let cursor = "crosshair";

  if (selected.length > 0) {
    const groupBounds = getSelectionBounds(selected);
    const canvasBounds =
      groupBounds === undefined ? undefined : toCanvasBounds(groupBounds);
    const handle =
      canvasBounds === undefined ? undefined : getHandleAt(canvasBounds, point);

    if (handle !== undefined) {
      cursor =
        handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
    } else if (
      selected.some((annotation) => isPointInAnnotation(annotation, point))
    ) {
      cursor = "move";
    }
  }

  if (cursor === "crosshair") {
    const hit = annotations.some((annotation) =>
      isPointInAnnotation(annotation, point),
    );
    if (hit) {
      cursor = "move";
    }
  }

  canvas.style.cursor = cursor;
}

function handlePointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) {
    return;
  }

  if (textDraft.value !== undefined) {
    commitText();
  }

  const point = getPoint(event);

  if (tool === AnnotationTool.Select) {
    event.preventDefault();
    event.stopPropagation();
    startSelection(
      event,
      point,
      event.shiftKey || event.metaKey || event.ctrlKey,
    );
    return;
  }

  if (!isDrawingTool.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (tool === AnnotationTool.Text) {
    openTextInput(point);
    return;
  }

  if (tool === AnnotationTool.Step) {
    addStep(point);
    return;
  }

  startDrawing(event, point);
}

function handlePointerMove(event: PointerEvent): void {
  const state = marquee.value;
  if (state !== undefined) {
    event.preventDefault();
    const point = getPoint(event);
    state.end = point;
    if (Math.hypot(point.x - state.start.x, point.y - state.start.y) > 0.001) {
      state.moved = true;
    }
    draw();
    return;
  }

  const dragState = drag.value;
  if (dragState !== undefined) {
    event.preventDefault();
    const point = getPoint(event);
    const distance = Math.hypot(
      point.x - dragState.start.x,
      point.y - dragState.start.y,
    );
    if (distance > 0.001) {
      dragState.moved = true;
    }

    if (dragState.kind === "move") {
      dragState.currents = translateSelection(
        dragState.originals,
        point.x - dragState.start.x,
        point.y - dragState.start.y,
      );
    } else if (dragState.handle !== undefined) {
      dragState.currents = resizeSelection(
        dragState.originals,
        dragState.handle,
        point,
      );
    }

    draw();
    return;
  }

  const annotation = draft.value;
  if (!drawing.value || annotation === undefined) {
    updateCursor(event);
    return;
  }

  event.preventDefault();
  const point = getPoint(event);

  if (annotation.type === "pen" || annotation.type === "highlighter") {
    const last = annotation.points[annotation.points.length - 1];
    if (
      last !== undefined &&
      Math.hypot(point.x - last.x, point.y - last.y) < 0.001
    ) {
      return;
    }

    annotation.points.push(point);
  } else if (isShapeAnnotation(annotation)) {
    annotation.end = point;
  }

  draw();
}

function finishDrawing(event: PointerEvent): void {
  const canvas = canvasRef.value;
  const selection = marquee.value;
  if (selection !== undefined) {
    if (canvas?.hasPointerCapture(event.pointerId) === true) {
      canvas.releasePointerCapture(event.pointerId);
    }
    marquee.value = undefined;

    if (selection.moved) {
      const rect = getRect(selection.start, selection.end);
      const hits = annotations
        .filter((annotation) => {
          const bounds = getNormalizedBounds(annotation);
          if (bounds === undefined) {
            return false;
          }
          return (
            bounds.x <= rect.x + rect.width &&
            bounds.x + bounds.width >= rect.x &&
            bounds.y <= rect.y + rect.height &&
            bounds.y + bounds.height >= rect.y
          );
        })
        .map((annotation) => annotation.id);

      selectedIds.value = selection.additive
        ? [...new Set([...selectedIds.value, ...hits])]
        : hits;
    }

    draw();
    return;
  }

  const state = drag.value;
  if (state !== undefined) {
    if (canvas?.hasPointerCapture(event.pointerId) === true) {
      canvas.releasePointerCapture(event.pointerId);
    }

    drag.value = undefined;
    if (state.moved) {
      lastTextClick = undefined;
      emit("update", state.currents);
    }
    draw();
    return;
  }

  const annotation = draft.value;
  if (!drawing.value || annotation === undefined) {
    return;
  }

  if (canvas?.hasPointerCapture(event.pointerId) === true) {
    canvas.releasePointerCapture(event.pointerId);
  }

  drawing.value = false;
  draft.value = undefined;

  if (annotation.type === "arrow") {
    if (
      Math.hypot(
        annotation.end.x - annotation.start.x,
        annotation.end.y - annotation.start.y,
      ) < 0.004
    ) {
      draw();
      return;
    }
  } else if (
    annotation.type === "rectangle" ||
    annotation.type === "ellipse" ||
    annotation.type === "redact"
  ) {
    const rect = getRect(annotation.start, annotation.end);
    if (rect.width < 0.004 && rect.height < 0.004) {
      draw();
      return;
    }
  }

  emit("add", annotation);
  draw();
}

function handlePointerCancel(event: PointerEvent): void {
  const canvas = canvasRef.value;
  if (canvas?.hasPointerCapture(event.pointerId) === true) {
    canvas.releasePointerCapture(event.pointerId);
  }

  drag.value = undefined;
  marquee.value = undefined;
  draft.value = undefined;
  drawing.value = false;
  draw();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }

  if (tool !== AnnotationTool.Select || selectedIds.value.length === 0) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }

  event.preventDefault();
  emit("remove", [...selectedIds.value]);
  selectedIds.value = [];
  drag.value = undefined;
  marquee.value = undefined;
  draw();
}

function cancelCurrentTool(): void {
  textDraft.value = undefined;
  draft.value = undefined;
  drawing.value = false;
  drag.value = undefined;
  marquee.value = undefined;
  selectedIds.value = [];
  lastTextClick = undefined;
  emit("cancel");
  draw();
}

function handleContextMenu(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();

  if (tool === AnnotationTool.Select) {
    textDraft.value = undefined;
    selectedIds.value = [];
    draw();
    return;
  }

  cancelCurrentTool();
}

function commitPendingText(): void {
  commitText();
}

function getCapture(): AnnotationCapture | undefined {
  if (annotations.length === 0) {
    return undefined;
  }

  const container = containerRef.value;
  if (
    container === undefined ||
    container.clientWidth === 0 ||
    container.clientHeight === 0
  ) {
    return undefined;
  }

  return {
    annotations,
    sourceWidth: container.clientWidth,
    sourceHeight: container.clientHeight,
  };
}

defineExpose({ commitPendingText, getCapture });

watch(
  () => annotations,
  (next) => {
    const ids = new Set(next.map((annotation) => annotation.id));
    selectedIds.value = selectedIds.value.filter((id) => ids.has(id));
    draw();
  },
);

watch(
  () => tool,
  () => {
    selectedIds.value = [];
    drag.value = undefined;
    marquee.value = undefined;
    draft.value = undefined;
    textDraft.value = undefined;
    drawing.value = false;
    lastTextClick = undefined;
    draw();
  },
);

onMounted(() => {
  const container = containerRef.value;
  if (container !== undefined) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  resizeCanvas();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resizeCanvas);
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div
    ref="containerRef"
    class="screenshot-annotation-ui pointer-events-none absolute inset-0 z-20"
  >
    <canvas
      ref="canvasRef"
      class="screenshot-annotation-ui block h-full w-full touch-none select-none"
      :class="
        isDrawingTool
          ? 'pointer-events-auto cursor-crosshair'
          : annotations.length > 0
            ? 'pointer-events-auto cursor-default'
            : 'pointer-events-none'
      "
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="finishDrawing"
      @pointercancel="handlePointerCancel"
      @contextmenu="handleContextMenu"
    />
    <input
      v-if="textDraft !== undefined"
      ref="textInputRef"
      v-model="textDraft.text"
      type="text"
      placeholder="Label"
      spellcheck="false"
      aria-label="Annotation text"
      class="screenshot-annotation-ui pointer-events-auto absolute z-30 min-w-32 rounded border-2 bg-surface-900/95 px-1 py-0.5 shadow-lg outline-none"
      :style="textInputStyle"
      @pointerdown.stop
      @click.stop
      @contextmenu.prevent.stop="cancelCurrentTool"
      @keydown.enter.prevent.stop="commitText"
      @keydown.esc.prevent.stop="cancelText"
      @blur="commitText"
    />
  </div>
</template>
