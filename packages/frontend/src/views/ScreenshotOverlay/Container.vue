<script setup lang="ts">
import { storeToRefs } from "pinia";
import Button from "primevue/button";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import AnnotationLayer from "./AnnotationLayer.vue";
import AnnotationToolbar from "./AnnotationToolbar.vue";
import { ContentPanel } from "./ContentPanel";
import SettingsPanel from "./SettingsPanel.vue";
import { useCrop } from "./useCrop";
import { type ContentPanelExposed, useForm } from "./useForm";
import { useRequestData } from "./useRequestData";
import VariantSelect from "./VariantSelect.vue";

import { useSDK } from "@/plugins/sdk";
import { closeOverlay, getOverlayState } from "@/stores/overlay";
import { useTabsStore } from "@/stores/tabs";
import { useTemplatesStore } from "@/stores/templates";
import {
  HighlightMode,
  type HighlightRule,
  MatchMode,
  RedactionMode,
  type RedactionRule,
  type RuleTarget,
  type ScreenshotSettings,
  ViewMode,
} from "@/types";
import {
  type Annotation,
  type AnnotationCapture,
  AnnotationTool,
  type AnnotationTool as AnnotationToolType,
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_WIDTH,
} from "@/utils/annotations";
import { delay } from "@/utils/async";
import { isPresent } from "@/utils/optional";
import {
  captureAndCopyToClipboard,
  captureAndDownload,
} from "@/utils/screenshot";

const DEFAULT_HIGHLIGHT_COLOR = "#ffff00";
const DEFAULT_REDACTION_TEXT = "[REDACTED]";

const sdk = useSDK();
const {
  requestRaw,
  responseRaw,
  urlInfo,
  responseInfo,
  requestVariants,
  responseVariants,
  selectedRequestId,
  selectedResponseId,
  loadFromSession,
  loadFromRequest,
  selectRequestVariant,
  selectResponseVariant,
} = useRequestData();
const {
  getTabSettings,
  setTabSettingsFromTemplate,
  updateTabSettings,
  getSplitterSizes,
  setSplitterSizes,
  getSelectedTemplateId,
  setSelectedTemplateId,
  getRequestView,
  setRequestView,
  getResponseView,
  setResponseView,
} = useTabsStore();
const templatesStore = useTemplatesStore();
const { defaultTemplateId } = storeToRefs(templatesStore);
const overlayState = getOverlayState();

const settings = ref<ScreenshotSettings | undefined>(undefined);
const selectedTemplateId = ref<string>("");

const contentPanelComponentRef = ref<ContentPanelExposed | undefined>(
  undefined,
);

interface AnnotationLayerExposed {
  commitPendingText: () => void;
  getCapture: () => AnnotationCapture | undefined;
}

const annotationLayerRef = ref<AnnotationLayerExposed | undefined>(undefined);
const annotations = ref<Annotation[]>([]);
const annotationPast = ref<Annotation[][]>([]);
const annotationFuture = ref<Annotation[][]>([]);
const annotationTool = ref<AnnotationToolType>(AnnotationTool.Select);
const annotationColor = ref(DEFAULT_ANNOTATION_COLOR);
const annotationWidth = ref<number>(DEFAULT_ANNOTATION_WIDTH);
const annotationFontSize = ref<number>(DEFAULT_ANNOTATION_FONT_SIZE);

const canUndoAnnotations = computed(() => annotationPast.value.length > 0);
const canRedoAnnotations = computed(() => annotationFuture.value.length > 0);
const hasAnnotations = computed(() => annotations.value.length > 0);

const isVisible = computed(() => overlayState.value.isOpen);
const sessionId = computed(() => overlayState.value.sessionId);
const target = computed(() => overlayState.value.target);
const tabKey = computed(() => sessionId.value ?? target.value?.requestId);
const { handleSaveAsNewTemplate, handleUpdateCurrentTemplate } = useForm(
  settings,
  tabKey,
  selectedTemplateId,
);
const splitterSizes = computed(() => {
  const key = tabKey.value;
  if (key === undefined) return [50, 50] as [number, number];
  return getSplitterSizes(key);
});
const requestView = computed<ViewMode>({
  get: () => {
    const key = tabKey.value;
    if (key === undefined) return ViewMode.Pretty;
    return getRequestView(key);
  },
  set: (mode) => {
    const key = tabKey.value;
    if (key === undefined) return;
    setRequestView(key, mode);
  },
});
const responseView = computed<ViewMode>({
  get: () => {
    const key = tabKey.value;
    if (key === undefined) return ViewMode.Pretty;
    return getResponseView(key);
  },
  set: (mode) => {
    const key = tabKey.value;
    if (key === undefined) return;
    setResponseView(key, mode);
  },
});

const {
  cropMaxHeight,
  restoreCropHeight,
  handleCropDragStart,
  handleCropReset,
} = useCrop(tabKey, () =>
  contentPanelComponentRef.value?.getCaptureRootElement(),
);

async function loadOverlayData(): Promise<void> {
  const key = tabKey.value;
  if (key === undefined) {
    return;
  }

  settings.value = getTabSettings(key);
  selectedTemplateId.value =
    getSelectedTemplateId(key) ?? defaultTemplateId.value;
  restoreCropHeight();

  if (isPresent(sessionId.value)) {
    await loadFromSession();
    return;
  }

  if (isPresent(target.value)) {
    await loadFromRequest(target.value);
  }
}

function handleSettingsChange(newSettings: ScreenshotSettings): void {
  const key = tabKey.value;
  if (key === undefined) {
    return;
  }

  settings.value = updateTabSettings(key, newSettings);
}

function handleTemplateChange(templateId: string): void {
  const key = tabKey.value;
  if (key === undefined) {
    return;
  }

  selectedTemplateId.value = templateId;
  settings.value = setTabSettingsFromTemplate(key, templateId);
  setSelectedTemplateId(key, templateId);
}

function handleResetToTemplate(): void {
  const key = tabKey.value;
  if (key === undefined) {
    return;
  }

  settings.value = setTabSettingsFromTemplate(key, selectedTemplateId.value);
}

function isEditableTarget(target: unknown): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isVisible.value) {
    return;
  }

  if (event.key === "Escape") {
    closeOverlay();
    return;
  }

  if (isEditableTarget(event.target)) {
    return;
  }

  const modifier = event.metaKey || event.ctrlKey;
  if (!modifier || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      handleRedoAnnotation();
    } else {
      handleUndoAnnotation();
    }
    return;
  }

  if (event.ctrlKey && !event.metaKey && key === "y") {
    event.preventDefault();
    handleRedoAnnotation();
  }
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    closeOverlay();
  }
}

function resetAnnotations(): void {
  annotations.value = [];
  annotationPast.value = [];
  annotationFuture.value = [];
  annotationTool.value = AnnotationTool.Select;
}

function commitAnnotations(next: Annotation[]): void {
  annotationPast.value.push(annotations.value);
  if (annotationPast.value.length > 100) {
    annotationPast.value.shift();
  }
  annotationFuture.value = [];
  annotations.value = next;
}

function handleAddAnnotation(annotation: Annotation): void {
  commitAnnotations([...annotations.value, annotation]);

  if (annotation.type !== "pen" && annotation.type !== "highlighter") {
    annotationTool.value = AnnotationTool.Select;
  }
}

function handleUpdateAnnotations(updated: Annotation[]): void {
  if (updated.length === 0) {
    return;
  }

  const byId = new Map(
    updated.map((annotation) => [annotation.id, annotation]),
  );
  commitAnnotations(
    annotations.value.map(
      (annotation) => byId.get(annotation.id) ?? annotation,
    ),
  );
}

function handleRemoveAnnotations(ids: string[]): void {
  if (ids.length === 0) {
    return;
  }

  const removed = new Set(ids);
  commitAnnotations(
    annotations.value.filter((annotation) => !removed.has(annotation.id)),
  );
}

function handleUndoAnnotation(): void {
  const previous = annotationPast.value.pop();
  if (previous === undefined) {
    return;
  }

  annotationFuture.value.unshift(annotations.value);
  annotations.value = previous;
}

function handleRedoAnnotation(): void {
  const next = annotationFuture.value.shift();
  if (next === undefined) {
    return;
  }

  annotationPast.value.push(annotations.value);
  annotations.value = next;
}

function handleClearAnnotations(): void {
  if (annotations.value.length === 0) {
    return;
  }

  commitAnnotations([]);
}

function formatTimestamp(): string {
  return new Date().toLocaleString();
}

async function handleScreenshot(action: "disk" | "clipboard"): Promise<void> {
  const contentEl = contentPanelComponentRef.value?.getCaptureRootElement();
  if (contentEl === undefined) {
    sdk.window.showToast("Content panel not ready", { variant: "error" });
    return;
  }

  annotationLayerRef.value?.commitPendingText();
  await nextTick();
  contentPanelComponentRef.value?.clearSelectionsForCapture();
  await delay(50);

  const annotationCapture = annotationLayerRef.value?.getCapture();

  let result;
  if (action === "disk") {
    result = await captureAndDownload(contentEl, annotationCapture);
  } else {
    result = await captureAndCopyToClipboard(contentEl, annotationCapture);
  }

  if (result.success) {
    const message =
      action === "disk"
        ? "Screenshot saved!"
        : "Screenshot copied to clipboard!";
    sdk.window.showToast(message, { variant: "success" });
  } else {
    sdk.window.showToast(`Failed: ${result.error}`, { variant: "error" });
  }
}

function handleAddHighlight(regex: string, target: RuleTarget): void {
  if (!isPresent(settings.value)) return;

  const newRule: HighlightRule = {
    id: crypto.randomUUID(),
    regex,
    target,
    mode: HighlightMode.Highlight,
    color: DEFAULT_HIGHLIGHT_COLOR,
    matchMode: MatchMode.String,
  };

  handleSettingsChange({
    ...settings.value,
    highlights: [...settings.value.highlights, newRule],
  });
}

function handleAddRedaction(regex: string, target: RuleTarget): void {
  if (!isPresent(settings.value)) return;

  const newRule: RedactionRule = {
    id: crypto.randomUUID(),
    regex,
    target,
    mode: RedactionMode.Replace,
    replacementText: DEFAULT_REDACTION_TEXT,
    useCaptureGroups: false,
    selectedGroups: [],
    matchMode: MatchMode.String,
  };

  handleSettingsChange({
    ...settings.value,
    redactions: [...settings.value.redactions, newRule],
  });
}

function handleAddHiddenHeader(headerName: string): void {
  if (!isPresent(settings.value)) return;
  if (settings.value.headersToHide.both.includes(headerName)) return;

  handleSettingsChange({
    ...settings.value,
    headersToHide: {
      ...settings.value.headersToHide,
      both: [...settings.value.headersToHide.both, headerName],
    },
  });
}

watch([isVisible, tabKey], () => {
  if (isVisible.value) {
    resetAnnotations();
    loadOverlayData();
  }
});

watch([selectedRequestId, selectedResponseId], () => {
  if (isVisible.value) {
    resetAnnotations();
  }
});

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  if (isVisible.value) {
    resetAnnotations();
    loadOverlayData();
  }
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
      @click="handleBackdropClick"
    >
      <div
        class="flex h-[90vh] w-[95vw] flex-col overflow-hidden rounded-lg border border-surface-600 bg-surface-800 shadow-2xl"
      >
        <div
          class="flex items-center justify-between border-b border-surface-600 px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-surface-50">
              Screenshot Mode++
            </h2>
            <Button
              label="Save Screenshot"
              icon="fas fa-download"
              size="small"
              @click="handleScreenshot('disk')"
            />
            <Button
              label="Copy To Clipboard"
              icon="fas fa-copy"
              size="small"
              @click="handleScreenshot('clipboard')"
            />
          </div>
          <div class="flex items-center gap-3">
            <VariantSelect
              label="Request"
              :variants="requestVariants"
              :selected-id="selectedRequestId"
              @select="selectRequestVariant"
            />
            <VariantSelect
              label="Response"
              :variants="responseVariants"
              :selected-id="selectedResponseId"
              @select="selectResponseVariant"
            />
            <button
              class="rounded p-1 text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
              @click="closeOverlay"
            >
              <i class="fas fa-times text-lg" />
            </button>
          </div>
        </div>

        <AnnotationToolbar
          :tool="annotationTool"
          :color="annotationColor"
          :stroke-width="annotationWidth"
          :font-size="annotationFontSize"
          :can-undo="canUndoAnnotations"
          :can-redo="canRedoAnnotations"
          :has-annotations="hasAnnotations"
          @update:tool="annotationTool = $event"
          @update:color="annotationColor = $event"
          @update:stroke-width="annotationWidth = $event"
          @update:font-size="annotationFontSize = $event"
          @undo="handleUndoAnnotation"
          @redo="handleRedoAnnotation"
          @clear="handleClearAnnotations"
        />

        <div class="flex flex-1 overflow-hidden">
          <div
            class="w-1/4 min-w-64 overflow-y-auto border-r border-surface-600 p-4"
          >
            <SettingsPanel
              v-if="isPresent(settings)"
              :settings="settings"
              :selected-template-id="selectedTemplateId"
              @update="handleSettingsChange"
              @template-change="handleTemplateChange"
              @reset-to-template="handleResetToTemplate"
              @save-as-new-template="handleSaveAsNewTemplate"
              @update-current-template="handleUpdateCurrentTemplate"
            />
          </div>

          <div class="flex flex-1 flex-col overflow-hidden bg-surface-900">
            <div class="flex flex-1 justify-center overflow-auto">
              <ContentPanel
                v-if="isPresent(settings)"
                ref="contentPanelComponentRef"
                v-model:request-view="requestView"
                v-model:response-view="responseView"
                :settings="settings"
                :request-raw="requestRaw"
                :response-raw="responseRaw"
                :url="urlInfo.url"
                :sni="urlInfo.sni"
                :splitter-sizes="splitterSizes"
                :selected-request-id="selectedRequestId"
                :selected-response-id="selectedResponseId"
                :crop-max-height="cropMaxHeight"
                :response-info="
                  settings.showResponseInfo ? responseInfo : undefined
                "
                :timestamp="
                  settings.showTimestamp ? formatTimestamp() : undefined
                "
                @add-highlight="handleAddHighlight"
                @add-redaction="handleAddRedaction"
                @add-hidden-header="handleAddHiddenHeader"
                @update-splitter-sizes="
                  (sizes) => {
                    const key = tabKey;
                    if (key !== undefined) setSplitterSizes(key, sizes);
                  }
                "
                @crop-drag-start="handleCropDragStart"
              >
                <template #annotation>
                  <AnnotationLayer
                    ref="annotationLayerRef"
                    :annotations="annotations"
                    :tool="annotationTool"
                    :color="annotationColor"
                    :stroke-width="annotationWidth"
                    :font-size="annotationFontSize"
                    @add="handleAddAnnotation"
                    @update="handleUpdateAnnotations"
                    @remove="handleRemoveAnnotations"
                  />
                </template>
              </ContentPanel>
            </div>
            <button
              v-if="isPresent(cropMaxHeight)"
              class="shrink-0 border-t border-surface-600 bg-surface-800 px-2 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
              @click="handleCropReset"
            >
              Reset Height
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
