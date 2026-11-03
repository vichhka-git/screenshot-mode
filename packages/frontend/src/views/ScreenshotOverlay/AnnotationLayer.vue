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
  isShapeAnnotation,
  nextStepNumber,
} from "@/utils/annotations";

const { annotations, tool, color, strokeWidth, fontSize } = defineProps<{
  annotations: Annotation[];
  tool: AnnotationToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
}>();

const emit = defineEmits<{
  add: [annotation: Annotation];
  update: [annotation: Annotation];
}>();

const containerRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const textInputRef = ref<HTMLInputElement>();
const draft = ref<Annotation>();
const textDraft = ref<{ x: number; y: number; text: string }>();
const drawing = ref(false);
const selectedId = ref<string>();
const drag = ref<DragState>();

let resizeObserver: ResizeObserver | undefined;

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type DragState = {
  kind: "move" | "resize";
  start: AnnotationPoint;
  original: Annotation;
  current: Annotation;
  handle?: ResizeHandle;
  moved: boolean;
};

type Bounds = { x: number; y: number; width: number; height: number };

const isDrawingTool = computed(() => tool !== AnnotationTool.Select);

const textInputStyle = computed<CSSProperties>(() => {
  const input = textDraft.value;
  if (input === undefined) {
    return {};
  }

  return {
    left: `${input.x * 100}%`,
    top: `${input.y * 100}%`,
    color,
    borderColor: color,
    fontSize: `${fontSize}px`,
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
    ctx.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
    const textWidth = ctx.measureText(annotation.text).width;

    return {
      x: annotation.position.x * width,
      y: annotation.position.y * height,
      width: Math.max(textWidth, fontSize),
      height: fontSize * 1.2,
    };
  }

  if (annotation.type === "step") {
    const radius = Math.max(10, annotation.fontSize * 0.7) * scale;
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

function resizeAnnotation(
  annotation: Annotation,
  handle: ResizeHandle,
  point: AnnotationPoint,
): Annotation {
  const bounds = getNormalizedBounds(annotation);
  if (bounds === undefined) {
    return annotation;
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

  if (annotation.type === "text" || annotation.type === "step") {
    const factor = Math.max(sx, sy);
    const position = {
      x: clamp(anchorX + (annotation.position.x - anchorX) * factor),
      y: clamp(anchorY + (annotation.position.y - anchorY) * factor),
    };

    return {
      ...annotation,
      position,
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

function drawSelection(annotation: Annotation): void {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  const bounds = getAnnotationBounds(annotation);
  if (
    canvas === undefined ||
    ctx === null ||
    ctx === undefined ||
    bounds === undefined
  ) {
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
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([5 * scale, 3 * scale]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);

  for (const corner of corners) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(corner.x - half, corner.y - half, handleSize, handleSize);
    ctx.strokeStyle = "#0ea5e9";
    ctx.strokeRect(corner.x - half, corner.y - half, handleSize, handleSize);
  }

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
  const visibleAnnotations = annotations.map((annotation) =>
    drag.value?.current.id === annotation.id ? drag.value.current : annotation,
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

  const selected =
    drag.value?.current ??
    annotations.find((annotation) => annotation.id === selectedId.value);
  if (selected !== undefined) {
    drawSelection(selected);
  }
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
  if (text === "") {
    return;
  }

  emit("add", {
    id: crypto.randomUUID(),
    type: "text",
    position: { x: input.x, y: input.y },
    text,
    color,
    width: strokeWidth,
    fontSize,
  });
}

function cancelText(): void {
  textDraft.value = undefined;
}

function openTextInput(point: AnnotationPoint): void {
  textDraft.value = { x: point.x, y: point.y, text: "" };
  void nextTick(() => textInputRef.value?.focus());
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
  annotation: Annotation,
  point: AnnotationPoint,
  kind: "move" | "resize",
  handle?: ResizeHandle,
): void {
  selectedId.value = annotation.id;
  const original = JSON.parse(JSON.stringify(annotation)) as Annotation;
  drag.value = {
    kind,
    start: point,
    original,
    current: JSON.parse(JSON.stringify(original)) as Annotation,
    handle,
    moved: false,
  };
  canvasRef.value?.setPointerCapture(event.pointerId);
  draw();
}

function startSelection(event: PointerEvent, point: AnnotationPoint): void {
  const selected = annotations.find(
    (annotation) => annotation.id === selectedId.value,
  );

  if (selected !== undefined) {
    const bounds = getAnnotationBounds(selected);
    const handle =
      bounds === undefined ? undefined : getHandleAt(bounds, point);

    if (handle !== undefined) {
      beginDrag(event, selected, point, "resize", handle);
      return;
    }
  }

  const hit = [...annotations]
    .reverse()
    .find((annotation) => isPointInAnnotation(annotation, point));

  if (hit !== undefined) {
    beginDrag(event, hit, point, "move");
    return;
  }

  selectedId.value = undefined;
  draw();
}

function updateCursor(event: PointerEvent): void {
  const canvas = canvasRef.value;
  if (canvas === undefined || tool !== AnnotationTool.Select) {
    return;
  }

  const point = getPoint(event);
  const selected = annotations.find(
    (annotation) => annotation.id === selectedId.value,
  );
  let cursor = "default";

  if (selected !== undefined) {
    const bounds = getAnnotationBounds(selected);
    const handle =
      bounds === undefined ? undefined : getHandleAt(bounds, point);

    if (handle !== undefined) {
      cursor =
        handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
    } else if (isPointInAnnotation(selected, point)) {
      cursor = "move";
    }
  }

  if (cursor === "default") {
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
    startSelection(event, point);
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
  const state = drag.value;
  if (state !== undefined) {
    event.preventDefault();
    const point = getPoint(event);
    const distance = Math.hypot(
      point.x - state.start.x,
      point.y - state.start.y,
    );
    if (distance > 0.001) {
      state.moved = true;
    }

    if (state.kind === "move") {
      state.current = translateAnnotation(
        state.original,
        point.x - state.start.x,
        point.y - state.start.y,
      );
    } else if (state.handle !== undefined) {
      state.current = resizeAnnotation(state.original, state.handle, point);
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
  const state = drag.value;
  if (state !== undefined) {
    const canvas = canvasRef.value;
    if (canvas?.hasPointerCapture(event.pointerId) === true) {
      canvas.releasePointerCapture(event.pointerId);
    }

    drag.value = undefined;
    if (state.moved) {
      emit("update", state.current);
    }
    draw();
    return;
  }

  const annotation = draft.value;
  if (!drawing.value || annotation === undefined) {
    return;
  }

  const canvas = canvasRef.value;
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
  draft.value = undefined;
  drawing.value = false;
  draw();
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
    if (
      selectedId.value !== undefined &&
      !next.some((annotation) => annotation.id === selectedId.value)
    ) {
      selectedId.value = undefined;
    }
    draw();
  },
);

watch(
  () => tool,
  () => {
    selectedId.value = undefined;
    drag.value = undefined;
    draft.value = undefined;
    textDraft.value = undefined;
    drawing.value = false;
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
  resizeCanvas();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resizeCanvas);
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
    />
    <input
      v-if="textDraft !== undefined"
      ref="textInputRef"
      v-model="textDraft.text"
      type="text"
      placeholder="Label"
      spellcheck="false"
      aria-label="Annotation text"
      class="screenshot-annotation-ui pointer-events-auto absolute z-30 min-w-32 rounded border-2 bg-surface-900/95 px-1 py-0.5 font-semibold shadow-lg outline-none"
      :style="textInputStyle"
      @pointerdown.stop
      @click.stop
      @keydown.enter.prevent.stop="commitText"
      @keydown.esc.prevent.stop="cancelText"
      @blur="commitText"
    />
  </div>
</template>
