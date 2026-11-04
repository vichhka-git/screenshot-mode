<script setup lang="ts">
import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import SelectButton from "primevue/selectbutton";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import ResponsePreview from "./ResponsePreview.vue";

import { SelectionContextMenu } from "@/components/SelectionContextMenu";
import { useSDK } from "@/plugins/sdk";
import {
  Disposition,
  type ResponseMeta,
  RuleTarget,
  type ScreenshotSettings,
  ViewMode,
} from "@/types";
import { applyDecorations } from "@/utils/decorations";
import { mountEditor } from "@/utils/editor";
import { formatHttpMessage } from "@/utils/format";
import { filterHeaders } from "@/utils/headers";
import { getContentType, splitHttpMessage } from "@/utils/http";
import { isPresent } from "@/utils/optional";

const {
  requestRaw,
  responseRaw,
  settings,
  splitterSizes,
  selectedRequestId = undefined,
  selectedResponseId = undefined,
  responseInfo = undefined,
  timestamp = undefined,
} = defineProps<{
  requestRaw: string;
  responseRaw: string;
  settings: ScreenshotSettings;
  splitterSizes: [number, number];
  selectedRequestId?: string;
  selectedResponseId?: string;
  responseInfo?: ResponseMeta;
  timestamp?: string;
}>();

const emit = defineEmits<{
  addHighlight: [regex: string, target: RuleTarget];
  addRedaction: [regex: string, target: RuleTarget];
  addHiddenHeader: [headerName: string];
  updateSplitterSizes: [sizes: [number, number]];
}>();

const requestView = defineModel<ViewMode>("requestView", { required: true });
const responseView = defineModel<ViewMode>("responseView", { required: true });

const requestViewOptions = [
  { label: "Pretty", value: ViewMode.Pretty },
  { label: "Raw", value: ViewMode.Raw },
];

const responseViewOptions = [
  { label: "Pretty", value: ViewMode.Pretty },
  { label: "Raw", value: ViewMode.Raw },
  { label: "Preview", value: ViewMode.Preview },
];

const responseContentType = computed(() =>
  getContentType(splitHttpMessage(responseRaw).head),
);
const requestContentType = computed(() =>
  getContentType(splitHttpMessage(requestRaw).head),
);

const sdk = useSDK();

const requestEditorContainer = ref<HTMLElement | undefined>(undefined);
const responseEditorContainer = ref<HTMLElement | undefined>(undefined);

const splitterKey = ref(0);

const requestEditor = sdk.ui.httpRequestEditor();
const responseEditor = sdk.ui.httpResponseEditor();

const splitterLayout = computed(() => {
  return settings.disposition === Disposition.Horizontal
    ? "horizontal"
    : "vertical";
});

const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedText = ref("");
const selectionTarget = ref<RuleTarget>(RuleTarget.Request);

function updateEditors(): void {
  const requestHeaderRules = [
    ...settings.headersToHide.both,
    ...settings.headersToHide.request,
  ];
  const responseHeaderRules = [
    ...settings.headersToHide.both,
    ...settings.headersToHide.response,
  ];
  const filteredRequest = filterHeaders(requestRaw, requestHeaderRules);
  const filteredResponse = filterHeaders(responseRaw, responseHeaderRules);
  const formattedRequest = formatHttpMessage(
    filteredRequest,
    requestView.value,
    requestContentType.value,
  );
  const formattedResponse = formatHttpMessage(
    filteredResponse,
    responseView.value,
    responseContentType.value,
  );

  const requestViewInstance = requestEditor.getEditorView();
  const responseViewInstance = responseEditor.getEditorView();

  requestViewInstance.dispatch({
    changes: {
      from: 0,
      to: requestViewInstance.state.doc.length,
      insert: formattedRequest,
    },
  });

  responseViewInstance.dispatch({
    changes: {
      from: 0,
      to: responseViewInstance.state.doc.length,
      insert: formattedResponse,
    },
  });

  applyDecorations(
    requestViewInstance,
    settings.highlights.filter((h) => h.target === RuleTarget.Request),
    settings.redactions.filter((r) => r.target === RuleTarget.Request),
  );

  applyDecorations(
    responseViewInstance,
    settings.highlights.filter((h) => h.target === RuleTarget.Response),
    settings.redactions.filter((r) => r.target === RuleTarget.Response),
  );
}

watch(
  () => [
    requestRaw,
    responseRaw,
    settings.headersToHide,
    settings.highlights,
    settings.redactions,
    requestView.value,
    responseView.value,
  ],
  () => {
    updateEditors();
  },
  { deep: true },
);

watch([requestView, responseView], async () => {
  await nextTick();
  requestEditor.getEditorView().requestMeasure();
  responseEditor.getEditorView().requestMeasure();
});

watch(
  () => settings.width,
  async () => {
    emit("updateSplitterSizes", [50, 50]);
    splitterKey.value++;
    await nextTick();
    mountEditors();
  },
);

function mountEditors(): void {
  if (isPresent(requestEditorContainer.value)) {
    mountEditor(requestEditorContainer.value, requestEditor.getElement());
  }

  if (isPresent(responseEditorContainer.value)) {
    mountEditor(responseEditorContainer.value, responseEditor.getElement());
  }

  updateEditors();
}

function handleGlobalClick(): void {
  contextMenuVisible.value = false;
}

function handleHighlight(): void {
  emit("addHighlight", selectedText.value, selectionTarget.value);
  contextMenuVisible.value = false;
}

function handleRedact(): void {
  emit("addRedaction", selectedText.value, selectionTarget.value);
  contextMenuVisible.value = false;
}

function handleHideHeader(): void {
  const colonIndex = selectedText.value.indexOf(":");
  const headerName =
    colonIndex > 0
      ? selectedText.value.substring(0, colonIndex).trim()
      : selectedText.value.trim();
  emit("addHiddenHeader", headerName);
  contextMenuVisible.value = false;
}

function handleResizeEnd(e: { sizes: number[] }): void {
  emit("updateSplitterSizes", [e.sizes[0], e.sizes[1]] as [number, number]);
}

function handleRequestContextMenu(e: MouseEvent): void {
  setTimeout(() => {
    const view = requestEditor.getEditorView();
    const sel = view.state.selection.main;
    const text = view.state.sliceDoc(sel.from, sel.to);
    if (text.length > 0) {
      selectedText.value = text;
      selectionTarget.value = RuleTarget.Request;
      contextMenuPosition.value = { x: e.clientX, y: e.clientY };
      contextMenuVisible.value = true;
    }
  }, 0);
}

function handleResponseContextMenu(e: MouseEvent): void {
  setTimeout(() => {
    const view = responseEditor.getEditorView();
    const sel = view.state.selection.main;
    const text = view.state.sliceDoc(sel.from, sel.to);
    if (text.length > 0) {
      selectedText.value = text;
      selectionTarget.value = RuleTarget.Response;
      contextMenuPosition.value = { x: e.clientX, y: e.clientY };
      contextMenuVisible.value = true;
    }
  }, 0);
}

onMounted(() => {
  document.addEventListener("click", handleGlobalClick);

  requestEditor
    .getElement()
    .addEventListener("contextmenu", handleRequestContextMenu);

  responseEditor
    .getElement()
    .addEventListener("contextmenu", handleResponseContextMenu);

  mountEditors();

  for (const view of [
    requestEditor.getEditorView(),
    responseEditor.getEditorView(),
  ]) {
    view.dispatch({
      effects: StateEffect.appendConfig.of(EditorView.lineWrapping),
    });
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick);
  if (isPresent(requestEditorContainer.value)) {
    requestEditorContainer.value.innerHTML = "";
  }
  if (isPresent(responseEditorContainer.value)) {
    responseEditorContainer.value.innerHTML = "";
  }
});

function clearSelectionsForCapture(): void {
  const requestViewInstance = requestEditor.getEditorView();
  const responseViewInstance = responseEditor.getEditorView();

  requestViewInstance.dispatch({ selection: { anchor: 0 } });
  responseViewInstance.dispatch({ selection: { anchor: 0 } });

  requestViewInstance.contentDOM.blur();
  responseViewInstance.contentDOM.blur();
}

defineExpose({
  clearSelectionsForCapture,
});
</script>

<template>
  <Splitter
    :key="splitterKey"
    :layout="splitterLayout"
    class="flex-1 overflow-hidden"
    @resizeend="handleResizeEnd"
  >
    <SplitterPanel
      :size="splitterSizes[0]"
      :min-size="10"
      class="overflow-hidden p-0"
    >
      <div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-surface-600 bg-surface-800 px-3 py-1.5"
        >
          <span class="text-sm font-medium text-surface-100">Request</span>
          <SelectButton
            v-model="requestView"
            :options="requestViewOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
            class="relative z-30"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-hidden">
          <div ref="requestEditorContainer" class="h-full w-full" />
        </div>
      </div>
    </SplitterPanel>
    <SplitterPanel
      :size="splitterSizes[1]"
      :min-size="10"
      class="overflow-hidden p-0"
    >
      <div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-surface-600 bg-surface-800 px-3 py-1.5"
        >
          <span class="text-sm font-medium text-surface-100">Response</span>
          <SelectButton
            v-model="responseView"
            :options="responseViewOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
            class="relative z-30"
          />
        </div>
        <div class="relative min-h-0 flex-1 overflow-hidden">
          <div
            v-show="responseView !== ViewMode.Preview"
            ref="responseEditorContainer"
            class="h-full w-full"
          />
          <ResponsePreview
            v-if="responseView === ViewMode.Preview"
            :request-id="selectedRequestId"
            :response-id="selectedResponseId"
            :response-raw="responseRaw"
            class="h-full w-full"
          />
        </div>
      </div>
    </SplitterPanel>
  </Splitter>

  <div
    v-if="isPresent(responseInfo) || isPresent(timestamp)"
    class="flex shrink-0 items-center justify-between border-t border-surface-600 px-3 py-1 text-xs text-surface-400"
  >
    <span v-if="isPresent(timestamp)">{{ timestamp }}</span>
    <span v-else />
    <span v-if="isPresent(responseInfo)">
      {{ responseInfo.length.toLocaleString() }} bytes |
      {{ responseInfo.roundtripTime }}ms
    </span>
  </div>

  <SelectionContextMenu
    :x="contextMenuPosition.x"
    :y="contextMenuPosition.y"
    :visible="contextMenuVisible"
    @highlight="handleHighlight"
    @redact="handleRedact"
    @hide-header="handleHideHeader"
    @close="contextMenuVisible = false"
  />
</template>
