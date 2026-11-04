<script setup lang="ts">
import type { ShapeKind } from "@/utils/annotations";

const { shape } = defineProps<{
  shape: ShapeKind;
}>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line v-if="shape === 'line'" x1="4" y1="20" x2="20" y2="4" />
    <template v-else-if="shape === 'arrow'">
      <line x1="4" y1="20" x2="20" y2="4" />
      <polyline points="12,4 20,4 20,12" />
    </template>
    <template v-else-if="shape === 'outline-arrow'">
      <polygon points="3,9 12,9 12,5 21,12 12,19 12,15 3,15" />
    </template>
    <rect
      v-else-if="shape === 'rectangle'"
      x="3"
      y="5"
      width="18"
      height="14"
    />
    <rect
      v-else-if="shape === 'rounded-rectangle'"
      x="3"
      y="5"
      width="18"
      height="14"
      rx="3"
    />
    <ellipse v-else-if="shape === 'ellipse'" cx="12" cy="12" rx="9" ry="6.5" />
    <polygon v-else-if="shape === 'triangle'" points="12,4 21,20 3,20" />
    <polygon
      v-else-if="shape === 'star'"
      points="12,3 14.7,9 21,9.7 16.4,14 17.7,20.3 12,17 6.3,20.3 7.6,14 3,9.7 9.3,9"
    />
    <polygon
      v-else-if="shape === 'polygon'"
      points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"
    />
    <path
      v-else-if="shape === 'heart'"
      d="M12 20.5C6.5 16.5 3 13.2 3 9.4 3 6.4 5.2 4.5 7.7 4.5c1.8 0 3.3 1 4.3 2.6 1-1.6 2.5-2.6 4.3-2.6 2.5 0 4.7 1.9 4.7 4.9 0 3.8-3.5 7.1-9 11.1Z"
    />
    <path v-else-if="shape === 'speech-bubble'" d="M4 5h16v11H9l-5 4V5Z" />
    <template v-else-if="shape === 'thought-bubble'">
      <ellipse cx="13" cy="9" rx="7.5" ry="5.2" />
      <circle cx="7" cy="16" r="2.2" />
      <circle cx="4.5" cy="20" r="1.2" />
    </template>
    <rect
      v-else-if="shape === 'redact'"
      x="3"
      y="6"
      width="18"
      height="12"
      fill="currentColor"
      stroke="none"
    />
  </svg>
</template>
