<script setup lang="ts">
defineProps<{
  label?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  rows?: number | undefined;
  hint?: string | undefined;
  modelValue?: unknown;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <label class="fe-control">
    <span class="fe-label">
      {{ label }}
      <em v-if="required" class="fe-required">*</em>
    </span>
    <textarea
      :value="String(modelValue ?? '')"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      @input="onInput"
    ></textarea>
    <small v-if="hint" class="fe-hint">{{ hint }}</small>
  </label>
</template>
