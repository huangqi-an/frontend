<script setup lang="ts">
import type { SelectOption } from "./types";

defineProps<{
  label?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  options?: SelectOption[] | undefined;
  modelValue?: unknown;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function onChange(event: Event): void {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <label class="fe-control">
    <span class="fe-label">
      {{ label }}
      <em v-if="required" class="fe-required">*</em>
    </span>
    <select :value="String(modelValue ?? '')" :disabled="disabled" @change="onChange">
      <option value="">{{ placeholder ?? "请选择" }}</option>
      <option v-for="option in options ?? []" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
