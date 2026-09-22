<script setup lang="ts">
import { computed } from "vue";

import type { FormEngine, FormField } from "../types";
import { useFormControls } from "./context";
import type { ArrayItemScope, ArrayScope, ControlProps, FieldScope, ObjectScope } from "./types";

defineOptions({ name: "FormRenderer" });

/**
 * 结构层：路径推导、显隐、递归、增删和写值。
 * 外观层：全部交给 field / object / array / missing 四个插槽，渲染层不写样式、不 import 控件。
 */
const props = defineProps<{
  engine: FormEngine;
  /** 不传时渲染 engine.schema；递归渲染数组项时传 itemSchema。 */
  fields?: FormField[] | undefined;
  /** 数组项递归时传入的父路径，例如 contacts[0]。 */
  parentPath?: string | undefined;
}>();

defineSlots<{
  /** 叶子字段；scope.control 来自注入的控件注册表。 */
  field(scope: FieldScope): unknown;
  /** 对象分组；scope.children 交回业务侧递归。 */
  object(scope: ObjectScope): unknown;
  /** repeatable 容器；scope.items / append / remove 交回业务侧。 */
  array(scope: ArrayScope): unknown;
  /** component 没有注册时的兜底。 */
  missing(scope: FieldScope): unknown;
}>();

const controls = useFormControls();

const fields = computed(() => props.fields ?? props.engine.schema.value);
const parentPath = computed(() => props.parentPath ?? "");

/** 静态字段直接用引擎补好的 path；itemSchema 里的字段按父路径拼出来。 */
function pathOf(field: FormField): string {
  if (field.path) return field.path;
  if (!field.field) return parentPath.value;
  return parentPath.value ? `${parentPath.value}.${field.field}` : field.field;
}

function runtimeOf(path: string): FormField | undefined {
  return props.engine.runtimeFieldMap.value[path];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRequired(field: FormField | undefined): boolean {
  const rule = field?.rules?.[0];
  return Boolean(rule && typeof rule === "object" && rule.required === true);
}

function readOptions(field: FormField | undefined): unknown[] {
  const options = field?.custom?.options;
  return Array.isArray(options) ? options : [];
}

function labelOf(field: FormField, runtime: FormField | undefined): string {
  return readString(runtime?.props?.label) ?? field.field ?? "";
}

/** 行为层：表达式算出 props.visible === false 的字段不渲染。 */
function isVisible(field: FormField): boolean {
  const runtime = runtimeOf(pathOf(field)) ?? field;
  return runtime.props?.visible !== false;
}

/** 只渲染可见字段，但顺序保持 schema 顺序。 */
const nodes = computed(() => fields.value.filter((field) => isVisible(field)));

function fieldScope(field: FormField): FieldScope {
  const path = pathOf(field);
  const runtime = runtimeOf(path);
  const value = props.engine.getValue(path);
  const setValue = (next: unknown): void => props.engine.setValue(path, next);

  const label = labelOf(field, runtime);
  const placeholder = readString(runtime?.props?.placeholder);
  const disabled = runtime?.props?.disabled === true;
  const required = readRequired(runtime);
  const hint = readString(runtime?.custom?.hint);
  const options = readOptions(runtime);

  const controlProps: ControlProps = {
    modelValue: value,
    "onUpdate:modelValue": setValue,
    label,
    placeholder,
    disabled,
    required,
    hint,
    options,
  };

  return {
    field,
    path,
    runtime,
    control: controls[field.component ?? ""],
    value,
    setValue,
    label,
    placeholder,
    disabled,
    required,
    hint,
    options,
    controlProps,
  };
}

function objectScope(field: FormField): ObjectScope {
  const path = pathOf(field);
  const runtime = runtimeOf(path);

  return {
    field,
    path,
    runtime,
    label: labelOf(field, runtime),
    children: field.children ?? [],
  };
}

function arrayScope(field: FormField): ArrayScope {
  const path = pathOf(field);
  const runtime = runtimeOf(path);
  const list = props.engine.getValue(path);

  const items: ArrayItemScope[] = (Array.isArray(list) ? list : []).map((value, index) => ({
    index,
    key: `${path}[${index}]`,
    path: `${path}[${index}]`,
    value,
  }));

  return {
    field,
    path,
    runtime,
    label: labelOf(field, runtime),
    itemSchema: field.itemSchema ?? [],
    items,
    append: () => props.engine.append(path),
    remove: (index: number) => props.engine.remove(path, index),
  };
}

function fieldKey(field: FormField): string {
  return `${parentPath.value}|${field.path ?? field.field ?? ""}`;
}
</script>

<template>
  <template v-for="field in nodes" :key="fieldKey(field)">
    <slot v-if="field.children?.length" name="object" v-bind="objectScope(field)">
      <FormRenderer :engine="engine" :fields="field.children" :parent-path="pathOf(field)" />
    </slot>

    <slot v-else-if="field.repeatable" name="array" v-bind="arrayScope(field)">
      <div v-for="item in arrayScope(field).items" :key="item.key">
        <FormRenderer :engine="engine" :fields="field.itemSchema" :parent-path="item.path" />
        <button type="button" @click="engine.remove(pathOf(field), item.index)">remove</button>
      </div>
      <button type="button" @click="engine.append(pathOf(field))">add</button>
    </slot>

    <slot v-else name="field" v-bind="fieldScope(field)">
      <component
        :is="fieldScope(field).control"
        v-if="fieldScope(field).control"
        v-bind="fieldScope(field).controlProps"
      />
      <slot v-else name="missing" v-bind="fieldScope(field)">
        未注册的组件：{{ field.component ?? "(empty)" }}
      </slot>
    </slot>
  </template>
</template>
