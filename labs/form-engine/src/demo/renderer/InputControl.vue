<script setup lang="ts">
defineProps<{
  label?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  modelValue?: unknown;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <label class="fe-control">
    <span class="fe-label">
      {{ label }}
      <em v-if="required" class="fe-required">*</em>
    </span>
    <input
      :value="String(modelValue ?? '')"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
    />
  </label>
</template>
