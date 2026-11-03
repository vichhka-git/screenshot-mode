<script setup lang="ts">
import Select from "primevue/select";

import { ColorInput } from "@/components/ColorInput";
import {
  ANNOTATION_COLORS,
  ANNOTATION_FONT_SIZES,
  ANNOTATION_WIDTHS,
  AnnotationTool,
  type AnnotationTool as AnnotationToolType,
} from "@/utils/annotations";

const { tool, color, strokeWidth, fontSize, canUndo, canRedo, hasAnnotations } =
  defineProps<{
    tool: AnnotationToolType;
    color: string;
    strokeWidth: number;
    fontSize: number;
    canUndo: boolean;
    canRedo: boolean;
    hasAnnotations: boolean;
  }>();

const emit = defineEmits<{
  "update:tool": [tool: AnnotationToolType];
  "update:color": [color: string];
  "update:strokeWidth": [width: number];
  "update:fontSize": [size: number];
  undo: [];
  redo: [];
  clear: [];
}>();

const tools: {
  value: AnnotationToolType;
  icon: string;
  label: string;
  rotation?: number;
}[] = [
  {
    value: AnnotationTool.Select,
    icon: "fas fa-arrow-pointer",
    label: "Select",
  },
  { value: AnnotationTool.Pen, icon: "fas fa-pen", label: "Pen" },
  {
    value: AnnotationTool.Highlighter,
    icon: "fas fa-highlighter",
    label: "Highlighter",
  },
  {
    value: AnnotationTool.Arrow,
    icon: "fas fa-arrow-right",
    label: "Arrow",
    rotation: -45,
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

function widthLabel(value: number): string {
  return (
    ANNOTATION_WIDTHS.find((item) => item.value === value)?.label ?? "Size"
  );
}
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
      <i
        :class="item.icon"
        :style="
          item.rotation === undefined
            ? undefined
            : { transform: `rotate(${item.rotation}deg)` }
        "
      />
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

    <span class="ml-1 flex items-center" title="Custom color">
      <ColorInput
        :color="color"
        append-to="body"
        @update="emit('update:color', $event)"
      />
    </span>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <Select
      :model-value="strokeWidth"
      :options="ANNOTATION_WIDTHS"
      option-label="label"
      option-value="value"
      class="w-28"
      title="Annotation size"
      aria-label="Annotation size"
      @update:model-value="emit('update:strokeWidth', $event)"
    >
      <template #value="{ value }">
        <span class="flex items-center gap-2">
          <span
            class="block w-4 rounded-full bg-current"
            :style="{ height: `${value}px` }"
          />
          <span>{{ widthLabel(value) }}</span>
        </span>
      </template>
      <template #option="{ option }">
        <span class="flex items-center gap-2">
          <span
            class="block w-4 rounded-full bg-current"
            :style="{ height: `${option.value}px` }"
          />
          <span>{{ option.label }}</span>
        </span>
      </template>
    </Select>

    <Select
      :model-value="fontSize"
      :options="ANNOTATION_FONT_SIZES"
      option-label="label"
      option-value="value"
      class="w-32"
      title="Text size"
      aria-label="Text size"
      @update:model-value="emit('update:fontSize', $event)"
    >
      <template #value="{ value }">
        <span class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase">Aa</span>
          <span>{{ value }} px</span>
        </span>
      </template>
    </Select>

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
