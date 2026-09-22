<script setup lang="ts">
import { computed } from "vue";

import type { FormEngine, FormField } from "../../form-engine";
import InputControl from "./InputControl.vue";
import SelectControl from "./SelectControl.vue";
import type { SelectOption } from "./types";

defineOptions({ name: "FormRenderer" });

const props = defineProps<{
  engine: FormEngine;
  /** 不传时渲染引擎的静态 schema。 */
  fields?: FormField[] | undefined;
  /** repeatable 数组项渲染时传入的父路径，例如 contacts[0]。 */
  parentPath?: string | undefined;
}>();

const fields = computed(() => props.fields ?? props.engine.schema.value);
const parentPath = computed(() => props.parentPath ?? "");

/** 静态字段直接用引擎补好的 path；itemSchema 里的字段按父路径拼出来。 */
function resolvePath(field: FormField): string {
  if (field.path) return field.path;
  if (!field.field) return parentPath.value;
  return parentPath.value ? `${parentPath.value}.${field.field}` : field.field;
}

/** 渲染时读运行时字段，才能看到表达式算出的 props / rules / custom。 */
function runtimeField(path: string): FormField | undefined {
  return props.engine.runtimeFieldMap.value[path];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRequired(field: FormField | undefined): boolean {
  const rule = field?.rules?.[0];
  return Boolean(rule && typeof rule === "object" && rule.required === true);
}

function readOptions(field: FormField | undefined): SelectOption[] {
  const options = field?.custom?.options;
  if (!Array.isArray(options)) return [];

  return options.map((option) => ({
    label: readString(option?.label) ?? "",
    value: readString(option?.value) ?? "",
  }));
}

function isVisible(field: FormField): boolean {
  const runtime = runtimeField(resolvePath(field)) ?? field;
  return runtime.props?.visible !== false;
}

function labelOf(field: FormField): string {
  const runtime = runtimeField(resolvePath(field)) ?? field;
  return readString(runtime.props?.label) ?? field.field ?? "";
}

function fieldKey(field: FormField): string {
  return `${parentPath.value}|${field.path ?? field.field ?? ""}`;
}

function listValue(path: string): any[] {
  const value = props.engine.getValue(path);
  return Array.isArray(value) ? value : [];
}

function inputProps(path: string, field: FormField) {
  const runtime = runtimeField(path) ?? field;

  return {
    label: readString(runtime.props?.label),
    placeholder: readString(runtime.props?.placeholder),
    disabled: runtime.props?.disabled === true,
    required: readRequired(runtime),
  };
}

function selectProps(path: string, field: FormField) {
  const runtime = runtimeField(path) ?? field;

  return {
    label: readString(runtime.props?.label),
    placeholder: readString(runtime.props?.placeholder),
    disabled: runtime.props?.disabled === true,
    required: readRequired(runtime),
    options: readOptions(runtime),
  };
}

function onControlValue(path: string, value: unknown): void {
  props.engine.setValue(path, value);
}
</script>

<template>
  <div class="fe-fields">
    <template v-for="field in fields" :key="fieldKey(field)">
      <div v-if="isVisible(field)" class="fe-field">
        <div v-if="field.children?.length" class="fe-object-group">
          <p class="fe-group-title">{{ labelOf(field) }}</p>
          <FormRenderer
            :engine="engine"
            :fields="field.children"
            :parent-path="resolvePath(field)"
          />
        </div>

        <div v-else-if="field.repeatable" class="fe-array">
          <div class="fe-array-header">
            <span class="fe-label">{{ labelOf(field) }}</span>
            <button type="button" @click="engine.append(resolvePath(field))">新增</button>
          </div>

          <p v-if="listValue(resolvePath(field)).length === 0" class="fe-empty">暂无数据</p>

          <div
            v-for="(_item, index) in listValue(resolvePath(field))"
            :key="index"
            class="fe-array-item"
          >
            <FormRenderer
              :engine="engine"
              :fields="field.itemSchema"
              :parent-path="`${resolvePath(field)}[${index}]`"
            />
            <button
              type="button"
              class="fe-remove"
              @click="engine.remove(resolvePath(field), index)"
            >
              删除
            </button>
          </div>
        </div>

        <InputControl
          v-else-if="field.component === 'input'"
          v-bind="inputProps(resolvePath(field), field)"
          :model-value="engine.getValue(resolvePath(field))"
          @update:model-value="onControlValue(resolvePath(field), $event)"
        />

        <SelectControl
          v-else-if="field.component === 'select'"
          v-bind="selectProps(resolvePath(field), field)"
          :model-value="engine.getValue(resolvePath(field))"
          @update:model-value="onControlValue(resolvePath(field), $event)"
        />

        <p v-else class="fe-error">未注册的组件：{{ field.component }}</p>
      </div>
    </template>
  </div>
</template>
