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
  getAnnotationFontSize,
  getRect,
  isShapeAnnotation,
  nextStepNumber,
} from "@/utils/annotations";

const { annotations, tool, color, strokeWidth } = defineProps<{
  annotations: Annotation[];
  tool: AnnotationToolType;
  color: string;
  strokeWidth: number;
}>();

const emit = defineEmits<{
  add: [annotation: Annotation];
}>();

const containerRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const textInputRef = ref<HTMLInputElement>();
const draft = ref<Annotation>();
const textDraft = ref<{ x: number; y: number; text: string }>();
const drawing = ref(false);

let resizeObserver: ResizeObserver | undefined;

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
    fontSize: `${getAnnotationFontSize(strokeWidth)}px`,
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
  const visibleAnnotations =
    draft.value === undefined ? annotations : [...annotations, draft.value];
  const scale =
    container.clientWidth === 0 ? 1 : canvas.width / container.clientWidth;

  drawAnnotations(ctx, visibleAnnotations, canvas.width, canvas.height, scale);
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
    fontSize: getAnnotationFontSize(strokeWidth),
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
    fontSize: getAnnotationFontSize(strokeWidth),
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

function handlePointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0 || !isDrawingTool.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (textDraft.value !== undefined) {
    commitText();
  }

  const point = getPoint(event);

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
  const annotation = draft.value;
  if (!drawing.value || annotation === undefined) {
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
  () => draw(),
);

watch(
  () => tool,
  (tool) => {
    if (tool === AnnotationTool.Select) {
      draft.value = undefined;
      textDraft.value = undefined;
      drawing.value = false;
      draw();
    }
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
