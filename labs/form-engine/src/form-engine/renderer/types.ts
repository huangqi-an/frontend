import type { Component } from "vue";

import type { FormField } from "../types";

/** 控件注册表：schema 里的 component 字符串 -> 具体控件组件。 */
export type ControlRegistry = Record<string, Component>;

/**
 * 默认控件约定。
 *
 * 不写 `field` 插槽时，渲染层按这套 props 绑定控件；写了插槽就以插槽里的写法为准。
 */
export interface ControlProps {
  modelValue: unknown;
  "onUpdate:modelValue": (value: unknown) => void;
  label: string;
  placeholder: string | undefined;
  disabled: boolean;
  required: boolean;
  hint: string | undefined;
  options: unknown[];
}

/** `field` 插槽作用域：叶子字段。 */
export interface FieldScope {
  field: FormField;
  /** 完整路径，例如 contact.address.city、contacts[0].phone。 */
  path: string;
  /** 表达式算过的运行时字段，可以自己读 props / rules / custom。 */
  runtime: FormField | undefined;
  /** 从注入的注册表里解析出来的控件；未注册时为 undefined。 */
  control: Component | undefined;
  value: unknown;
  setValue: (value: unknown) => void;
  /** 常用约定的便利读取，用不用都行。 */
  label: string;
  placeholder: string | undefined;
  disabled: boolean;
  required: boolean;
  hint: string | undefined;
  options: unknown[];
  /** 按默认约定拼好的控件 props，可以直接 v-bind。 */
  controlProps: ControlProps;
}

/** `object` 插槽作用域：带 children 的对象分组。 */
export interface ObjectScope {
  field: FormField;
  path: string;
  runtime: FormField | undefined;
  label: string;
  /** 子字段定义，交回业务侧递归渲染。 */
  children: FormField[];
}

export interface ArrayItemScope {
  index: number;
  key: string;
  /** 数组项路径，例如 contacts[0]。 */
  path: string;
  value: unknown;
}

/** `array` 插槽作用域：repeatable 容器。 */
export interface ArrayScope {
  field: FormField;
  path: string;
  runtime: FormField | undefined;
  label: string;
  /** 数组项模板，交回业务侧递归渲染。 */
  itemSchema: FormField[];
  items: ArrayItemScope[];
  append: () => void;
  remove: (index: number) => void;
}
