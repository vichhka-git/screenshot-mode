<script setup lang="ts">
import {
  ANNOTATION_COLORS,
  ANNOTATION_WIDTHS,
  AnnotationTool,
  type AnnotationTool as AnnotationToolType,
} from "@/utils/annotations";

const { tool, color, strokeWidth, canUndo, canRedo, hasAnnotations } =
  defineProps<{
    tool: AnnotationToolType;
    color: string;
    strokeWidth: number;
    canUndo: boolean;
    canRedo: boolean;
    hasAnnotations: boolean;
  }>();

const emit = defineEmits<{
  "update:tool": [tool: AnnotationToolType];
  "update:color": [color: string];
  "update:strokeWidth": [width: number];
  undo: [];
  redo: [];
  clear: [];
}>();

const tools: { value: AnnotationToolType; icon: string; label: string }[] = [
  {
    value: AnnotationTool.Select,
    icon: "fas fa-arrow-pointer",
    label: "Cursor",
  },
  { value: AnnotationTool.Pen, icon: "fas fa-pen", label: "Pen" },
  {
    value: AnnotationTool.Highlighter,
    icon: "fas fa-highlighter",
    label: "Highlighter",
  },
  {
    value: AnnotationTool.Arrow,
    icon: "fas fa-arrow-up-right",
    label: "Arrow",
  },
  {
    value: AnnotationTool.Rectangle,
    icon: "far fa-square",
    label: "Rectangle",
  },
  { value: AnnotationTool.Ellipse, icon: "far fa-circle", label: "Ellipse" },
  { value: AnnotationTool.Text, icon: "fas fa-font", label: "Text" },
  {
    value: AnnotationTool.Step,
    icon: "fas fa-list-ol",
    label: "Numbered step",
  },
  {
    value: AnnotationTool.Redact,
    icon: "fas fa-eye-slash",
    label: "Black box redaction",
  },
];
</script>

<template>
  <div
    class="flex shrink-0 flex-wrap items-center gap-1 border-b border-surface-600 bg-surface-800 px-3 py-1.5"
  >
    <span
      class="mr-1 text-[10px] font-semibold uppercase tracking-widest text-surface-500"
    >
      Annotate
    </span>

    <button
      v-for="item in tools"
      :key="item.value"
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-50"
      :class="{ 'bg-surface-600 text-surface-50': tool === item.value }"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="tool === item.value"
      @click="emit('update:tool', item.value)"
    >
      <i :class="item.icon" />
    </button>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      v-for="item in ANNOTATION_COLORS"
      :key="item.value"
      type="button"
      class="h-4 w-4 rounded-full border border-surface-500"
      :class="
        color === item.value
          ? 'ring-2 ring-surface-50 ring-offset-1 ring-offset-surface-800'
          : ''
      "
      :style="{ backgroundColor: item.value }"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="color === item.value"
      @click="emit('update:color', item.value)"
    />

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      v-for="item in ANNOTATION_WIDTHS"
      :key="item.value"
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50"
      :class="{ 'bg-surface-600 text-surface-50': strokeWidth === item.value }"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="strokeWidth === item.value"
      @click="emit('update:strokeWidth', item.value)"
    >
      <span
        class="block w-4 rounded-full bg-current"
        :style="{ height: `${item.value}px` }"
      />
    </button>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
      title="Undo"
      aria-label="Undo"
      :disabled="!canUndo"
      @click="emit('undo')"
    >
      <i class="fas fa-rotate-left" />
    </button>
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
      title="Redo"
      aria-label="Redo"
      :disabled="!canRedo"
      @click="emit('redo')"
    >
      <i class="fas fa-rotate-right" />
    </button>
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
      title="Clear annotations"
      aria-label="Clear annotations"
      :disabled="!hasAnnotations"
      @click="emit('clear')"
    >
      <i class="fas fa-trash" />
    </button>
  </div>
</template>
