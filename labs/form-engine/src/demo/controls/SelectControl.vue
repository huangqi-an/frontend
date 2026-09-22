<script setup lang="ts">
import { computed } from "vue";

interface SelectOption {
  label: string;
  value: string;
}

const props = defineProps<{
  label?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  hint?: string | undefined;
  /** 对应 schema 里的 custom.options，形状由业务侧决定，控件自己归一化。 */
  options?: unknown[] | undefined;
  modelValue?: unknown;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function toOption(value: unknown): SelectOption | null {
  if (value === null || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.label !== "string") return null;

  return { label: record.label, value: String(record.value ?? "") };
}

const normalizedOptions = computed(() =>
  (props.options ?? []).map(toOption).filter((option): option is SelectOption => option !== null),
);

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
      <option v-for="option in normalizedOptions" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <small v-if="hint" class="fe-hint">{{ hint }}</small>
  </label>
</template>
