<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

import { useSDK } from "@/plugins/sdk";
import { formatRenderError, RENDER_HEIGHT, RENDER_WIDTH } from "@/utils/render";

const {
  requestId,
  responseId = undefined,
  responseRaw,
} = defineProps<{
  requestId: string | undefined;
  responseId?: string | undefined;
  responseRaw: string;
}>();

const sdk = useSDK();

const image = ref<string | undefined>(undefined);
const error = ref<string | undefined>(undefined);
const isLoading = ref(false);

let renderToken = 0;

async function renderPreview(): Promise<void> {
  const id = requestId;
  const token = ++renderToken;

  image.value = undefined;
  error.value = undefined;

  if (id === undefined) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;

  try {
    const { renderRequest } = await sdk.graphql.renderRequest({
      id,
      input: { width: RENDER_WIDTH, height: RENDER_HEIGHT },
    });

    if (token !== renderToken) {
      return;
    }

    if (renderRequest.error !== undefined && renderRequest.error !== null) {
      error.value = formatRenderError(renderRequest.error);
      return;
    }

    if (renderRequest.render === undefined || renderRequest.render === null) {
      error.value = "The rendering engine returned an empty preview.";
      return;
    }

    image.value = renderRequest.render;
  } catch (cause) {
    if (token !== renderToken) {
      return;
    }

    error.value =
      cause instanceof Error
        ? cause.message
        : "Unable to render this response.";
  } finally {
    if (token === renderToken) {
      isLoading.value = false;
    }
  }
}

function handleImageError(): void {
  image.value = undefined;
  error.value = "The preview image could not be loaded.";
}

watch(
  () => [requestId, responseId, responseRaw],
  () => {
    void renderPreview();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  renderToken++;
});
</script>

<template>
  <div class="h-full w-full overflow-auto bg-white">
    <div
      v-if="isLoading"
      class="flex h-full w-full flex-col items-center justify-center gap-2 text-surface-500"
    >
      <i class="fas fa-spinner fa-spin text-2xl" />
      <span class="text-sm">Rendering preview…</span>
    </div>
    <div
      v-else-if="error !== undefined"
      class="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-600"
    >
      <i class="fas fa-triangle-exclamation text-2xl" />
      <p>{{ error }}</p>
    </div>
    <img
      v-else-if="image !== undefined"
      :src="image"
      alt="Response preview"
      class="block w-full"
      @error="handleImageError"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center text-sm italic text-surface-500"
    >
      No response selected.
    </div>
  </div>
</template>
