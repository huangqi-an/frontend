<script setup lang="ts">
import type { ButtonProps } from "./Button.types";

const { disabled = false, label, tone = "accent" } = defineProps<ButtonProps>();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :class="['fl-button', `fl-button--${tone}`]"
    :disabled="disabled"
    type="button"
    @click="emit('click', $event)"
  >
    {{ label }}
    <slot />
  </button>
</template>

<style scoped>
.fl-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--fl-space-2);
  min-height: 38px;
  padding: var(--fl-space-2) var(--fl-space-4);
  border: 1px solid transparent;
  border-radius: var(--fl-radius-md);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.fl-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.fl-button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--fl-color-accent) 35%, transparent);
  outline-offset: 2px;
}

.fl-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.fl-button--accent {
  background: var(--fl-color-accent);
  color: var(--fl-color-on-accent);
}

.fl-button--accent:hover:not(:disabled) {
  background: var(--fl-color-accent-strong);
}

.fl-button--neutral {
  background: var(--fl-color-surface);
  border-color: var(--fl-color-border);
  color: var(--fl-color-text);
}

.fl-button--danger {
  background: var(--fl-color-danger);
  color: #ffffff;
}
</style>
