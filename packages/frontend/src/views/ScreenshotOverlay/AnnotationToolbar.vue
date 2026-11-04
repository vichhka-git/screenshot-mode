<script setup lang="ts">
import InputNumber from "primevue/inputnumber";
import Popover from "primevue/popover";
import Select from "primevue/select";
import { computed, ref } from "vue";

import { ColorInput } from "@/components/ColorInput";
import {
  ANNOTATION_COLORS,
  ANNOTATION_FONT_FAMILIES,
  ANNOTATION_WIDTHS,
  AnnotationTool,
  type AnnotationTool as AnnotationToolType,
  isShapeTool,
  type ShapeKind,
} from "@/utils/annotations";
import ShapeIcon from "@/views/ScreenshotOverlay/ShapeIcon.vue";

const {
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
  filled,
  dashed,
  arrowStart,
  arrowEnd,
  canUndo,
  canRedo,
  hasAnnotations,
} = defineProps<{
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
  filled: boolean;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasAnnotations: boolean;
}>();

const emit = defineEmits<{
  "update:tool": [tool: AnnotationToolType];
  "update:color": [color: string];
  "update:strokeWidth": [width: number];
  "update:fontSize": [size: number];
  "update:fontFamily": [family: string];
  "update:fontWeight": [weight: number];
  "update:fontStyle": [style: "normal" | "italic"];
  "update:underline": [underline: boolean];
  "update:indent": [indent: number];
  "update:boxed": [boxed: boolean];
  "update:filled": [filled: boolean];
  "update:dashed": [dashed: boolean];
  "update:arrowStart": [arrowStart: boolean];
  "update:arrowEnd": [arrowEnd: boolean];
  undo: [];
  redo: [];
  clear: [];
}>();

const fontPopover = ref<InstanceType<typeof Popover> | undefined>(undefined);
const shapePopover = ref<InstanceType<typeof Popover> | undefined>(undefined);
const stylePopover = ref<InstanceType<typeof Popover> | undefined>(undefined);

const shapeOptions: { value: ShapeKind; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "outline-arrow", label: "Outline arrow" },
  { value: "rectangle", label: "Rectangle" },
  { value: "rounded-rectangle", label: "Rounded rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "triangle", label: "Triangle" },
  { value: "star", label: "Star" },
  { value: "polygon", label: "Hexagon" },
  { value: "heart", label: "Heart" },
  { value: "speech-bubble", label: "Speech bubble" },
  { value: "thought-bubble", label: "Thought bubble" },
];

const activeShape = computed<ShapeKind>(() =>
  isShapeTool(tool) ? tool : "rectangle",
);

const tools: {
  value: AnnotationToolType;
  icon: string;
  label: string;
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

function handleFontSize(value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }

  emit("update:fontSize", Math.min(300, Math.max(1, Math.round(value))));
}

function changeIndent(delta: number): void {
  emit("update:indent", Math.min(200, Math.max(0, indent + delta)));
}

function fontFamilyLabel(value: string): string {
  return (
    ANNOTATION_FONT_FAMILIES.find((family) => family.value === value)?.label ??
    "Custom"
  );
}

function toggleFontPopover(event: Event): void {
  fontPopover.value?.toggle(event);
}

function toolIcon(item: (typeof tools)[number]): string {
  return item.value === AnnotationTool.Select && hasAnnotations
    ? "fas fa-vector-square"
    : item.icon;
}

function toggleShapePopover(event: Event): void {
  shapePopover.value?.toggle(event);
}

function chooseShape(shape: ShapeKind): void {
  emit("update:tool", shape);
  shapePopover.value?.hide();
}

function toggleStylePopover(event: Event): void {
  stylePopover.value?.toggle(event);
}

function activeClass(active: boolean): string {
  return active
    ? "bg-surface-600 text-surface-50 ring-2 ring-inset ring-surface-400"
    : "bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50";
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
      class="relative flex h-8 w-8 items-center justify-center rounded-md border-0 text-sm"
      :class="activeClass(tool === item.value)"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="tool === item.value"
      @click="emit('update:tool', item.value)"
    >
      <i :class="toolIcon(item)" />
      <span
        v-if="tool === item.value"
        class="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-surface-50"
      />
    </button>

    <button
      type="button"
      class="flex h-8 items-center justify-center gap-0.5 rounded-md border-0 px-2"
      :class="activeClass(isShapeTool(tool))"
      title="Shapes"
      aria-label="Shapes"
      @click="toggleShapePopover"
    >
      <ShapeIcon :shape="activeShape" class="h-4 w-4" />
      <i class="fas fa-chevron-down text-[8px]" />
    </button>
    <Popover ref="shapePopover" append-to="body" :base-z-index="600">
      <div class="grid w-64 grid-cols-4 gap-1 p-2" data-annotation-style-ui>
        <button
          v-for="shapeOption in shapeOptions"
          :key="shapeOption.value"
          type="button"
          class="flex h-12 flex-col items-center justify-center gap-1 rounded-md border-0 text-[9px]"
          :class="activeClass(tool === shapeOption.value)"
          :title="shapeOption.label"
          :aria-label="shapeOption.label"
          @click="chooseShape(shapeOption.value)"
        >
          <ShapeIcon :shape="shapeOption.value" class="h-5 w-5" />
          <span class="leading-none">{{ shapeOption.label }}</span>
        </button>
      </div>
    </Popover>

    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0"
      :class="activeClass(filled || dashed || arrowStart || arrowEnd)"
      title="Shape style"
      aria-label="Shape style"
      @click="toggleStylePopover"
    >
      <i class="fas fa-fill-drip" />
    </button>
    <Popover ref="stylePopover" append-to="body" :base-z-index="600">
      <div class="flex w-56 flex-col gap-2 p-3" data-annotation-style-ui>
        <span
          class="text-[10px] font-semibold uppercase tracking-widest text-surface-500"
        >
          Shape style
        </span>
        <div class="grid grid-cols-2 gap-1">
          <button
            type="button"
            class="flex h-8 items-center justify-center gap-1 rounded-md border-0 text-xs"
            :class="activeClass(filled)"
            title="Fill shape"
            aria-label="Fill shape"
            :aria-pressed="filled"
            @click="emit('update:filled', !filled)"
          >
            <i class="fas fa-fill-drip" />
            Fill
          </button>
          <button
            type="button"
            class="flex h-8 items-center justify-center gap-1 rounded-md border-0 text-xs"
            :class="activeClass(dashed)"
            title="Dashed line"
            aria-label="Dashed line"
            :aria-pressed="dashed"
            @click="emit('update:dashed', !dashed)"
          >
            <i class="fas fa-border-style" />
            Dashed
          </button>
          <template v-if="activeShape === 'line'">
            <button
              type="button"
              class="flex h-8 items-center justify-center gap-1 rounded-md border-0 text-xs"
              :class="activeClass(arrowStart)"
              title="Arrowhead at start"
              aria-label="Arrowhead at start"
              :aria-pressed="arrowStart"
              @click="emit('update:arrowStart', !arrowStart)"
            >
              <i class="fas fa-arrow-left" />
              Start
            </button>
            <button
              type="button"
              class="flex h-8 items-center justify-center gap-1 rounded-md border-0 text-xs"
              :class="activeClass(arrowEnd)"
              title="Arrowhead at end"
              aria-label="Arrowhead at end"
              :aria-pressed="arrowEnd"
              @click="emit('update:arrowEnd', !arrowEnd)"
            >
              <i class="fas fa-arrow-right" />
              End
            </button>
          </template>
        </div>
        <p class="m-0 text-[10px] leading-snug text-surface-400">
          Fill uses the stroke color at 20% opacity.
        </p>
      </div>
    </Popover>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:text-surface-500 disabled:opacity-100"
      title="Undo (Cmd/Ctrl+Z)"
      aria-label="Undo"
      :disabled="!canUndo"
      @click="emit('undo')"
    >
      <i class="fas fa-undo" />
    </button>
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:text-surface-500 disabled:opacity-100"
      title="Redo (Cmd/Ctrl+Shift+Z)"
      aria-label="Redo"
      :disabled="!canRedo"
      @click="emit('redo')"
    >
      <i class="fas fa-redo" />
    </button>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      v-for="item in ANNOTATION_COLORS"
      :key="item.value"
      type="button"
      class="h-4 w-4 rounded-full border border-surface-500"
      data-annotation-style-ui
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

    <span
      class="ml-1 flex items-center"
      title="Custom color"
      data-annotation-style-ui
    >
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
      panel-class="annotation-style-ui"
      title="Annotation size"
      aria-label="Annotation size"
      data-annotation-style-ui
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

    <span class="flex items-center gap-1" data-annotation-style-ui>
      <button
        type="button"
        class="flex h-8 items-center gap-1 rounded-md border-0 bg-transparent px-2 text-surface-300 hover:bg-surface-700 hover:text-surface-50"
        title="Text style"
        aria-label="Text style"
        @click="toggleFontPopover"
      >
        <span class="text-sm font-semibold" :style="{ fontFamily }">Aa</span>
        <span class="text-[10px] text-surface-400">{{ fontSize }} px</span>
        <i class="fas fa-chevron-down text-[9px]" />
      </button>
      <Popover ref="fontPopover" append-to="body" :base-z-index="600">
        <div class="flex w-64 flex-col gap-3 p-3" data-annotation-style-ui>
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-surface-500"
            >
              Font
            </span>
            <Select
              :model-value="fontFamily"
              :options="ANNOTATION_FONT_FAMILIES"
              option-label="label"
              option-value="value"
              class="w-full"
              panel-class="annotation-style-ui"
              aria-label="Font family"
              @update:model-value="emit('update:fontFamily', $event)"
            >
              <template #value="{ value }">
                <span :style="{ fontFamily: String(value) }">
                  {{ fontFamilyLabel(String(value)) }}
                </span>
              </template>
              <template #option="{ option }">
                <span :style="{ fontFamily: option.value }">
                  {{ option.label }}
                </span>
              </template>
            </Select>
          </div>

          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-surface-500"
            >
              Size
            </span>
            <div class="annotation-size relative">
              <InputNumber
                :model-value="fontSize"
                :min="1"
                :max="300"
                :step="1"
                class="w-full"
                title="Text size"
                aria-label="Text size"
                @update:model-value="handleFontSize"
              />
              <span
                class="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-xs text-surface-400"
              >
                px
              </span>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-surface-500"
            >
              Style
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md border-0 text-sm"
                :class="activeClass(fontWeight >= 700)"
                title="Bold"
                aria-label="Bold"
                :aria-pressed="fontWeight >= 700"
                @click="
                  emit('update:fontWeight', fontWeight >= 700 ? 400 : 700)
                "
              >
                <span class="font-bold">B</span>
              </button>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md border-0 text-sm"
                :class="activeClass(fontStyle === 'italic')"
                title="Italic"
                aria-label="Italic"
                :aria-pressed="fontStyle === 'italic'"
                @click="
                  emit(
                    'update:fontStyle',
                    fontStyle === 'italic' ? 'normal' : 'italic',
                  )
                "
              >
                <span class="italic">I</span>
              </button>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md border-0 text-sm"
                :class="activeClass(underline)"
                title="Underline"
                aria-label="Underline"
                :aria-pressed="underline"
                @click="emit('update:underline', !underline)"
              >
                <span class="underline">U</span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-surface-500"
            >
              Label
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:text-surface-500"
                title="Decrease indent"
                aria-label="Decrease indent"
                :disabled="indent <= 0"
                @click="changeIndent(-8)"
              >
                <i class="fas fa-outdent" />
              </button>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:text-surface-500"
                title="Increase indent"
                aria-label="Increase indent"
                :disabled="indent >= 200"
                @click="changeIndent(8)"
              >
                <i class="fas fa-indent" />
              </button>
              <span class="w-14 text-center text-[10px] text-surface-400">
                {{ indent }} px
              </span>
              <span class="mx-1 h-5 w-px bg-surface-600" />
              <button
                type="button"
                class="flex h-8 items-center gap-1 rounded-md border-0 px-2 text-xs"
                :class="activeClass(boxed)"
                title="Rounded box"
                aria-label="Rounded box"
                :aria-pressed="boxed"
                @click="emit('update:boxed', !boxed)"
              >
                <i class="far fa-square" />
                <span>Box</span>
              </button>
            </div>
          </div>
        </div>
      </Popover>
    </span>

    <span class="mx-1.5 h-5 w-px bg-surface-600" />

    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-surface-300 hover:bg-surface-700 hover:text-surface-50 disabled:cursor-not-allowed disabled:opacity-60"
      title="Clear annotations"
      aria-label="Clear annotations"
      :disabled="!hasAnnotations"
      @click="emit('clear')"
    >
      <i class="fas fa-trash" />
    </button>
  </div>
</template>

<style scoped>
.annotation-size :deep(input) {
  padding-right: 2.9rem;
}
</style>
