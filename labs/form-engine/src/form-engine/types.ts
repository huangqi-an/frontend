import type { ComputedRef, ShallowRef } from "vue";

/**
 * 动态表单引擎的类型定义。
 *
 * 三层概念：
 * - schema：业务侧编写的字段结构，只描述“有什么”。
 * - model：业务数据，唯一需要提交/持久化的部分。
 * - runtime field：schema 的运行时副本，表达式的结果写回这里（props/rules/custom）。
 */

/** 表达式映射：目标路径 -> 表达式源码，例如 "props.disabled": "!$model.name"。 */
export type ExpressionMap = Record<string, string>;

/** 表单业务数据。 */
export type FormModel = Record<string, any>;

/** 注入表达式使用的函数表，例如 $functions.getDeptOptions($model.userType)。 */
export type FunctionRegistry = Record<string, (...args: any[]) => any>;

/** 副作用声明，v1 只实现 clear。 */
export interface FieldEffect {
  type: "clear";
  /** 满足条件时才执行；缺省表示源字段一变化就执行。 */
  when?: string | undefined;
  /** 要影响的目标路径；在 repeatable 项中支持相对路径。 */
  targets: string[];
}

/** 业务侧编写的字段定义。 */
export interface FormField {
  /** 字段名，例如 name、contact、phone。 */
  field?: string | undefined;
  /** 初始化或运行时生成的完整路径，例如 contact.phone、contacts[0].name。 */
  path?: string | undefined;
  /** 渲染组件标识，例如 input / select / 自定义组件。 */
  component?: string | undefined;
  /** 透传给 UI 组件的属性。 */
  props?: Record<string, any> | undefined;
  /** 业务自定义数据，例如 options / remoteMethod。 */
  custom?: Record<string, any> | undefined;
  /** 校验规则；引擎只负责联动修改，不负责执行校验。 */
  rules?: any[] | undefined;
  /** 表达式联动：targetPath -> expression。 */
  expressions?: ExpressionMap | undefined;
  /** 副作用配置。 */
  effects?: FieldEffect[] | undefined;
  /** 对象嵌套字段。 */
  children?: FormField[] | undefined;
  /** repeatable 容器的数组项模板。 */
  itemSchema?: FormField[] | undefined;
  /** 是否为可增删数组容器。 */
  repeatable?: boolean | undefined;
}

/** 从表达式中解析出来的依赖。 */
export interface ParsedDep {
  type: "model" | "item";
  path: string;
}

/** 一条已编译的表达式规则。 */
export interface ExpressionEffect {
  /** 表达式所属字段的完整路径。 */
  fieldPath: string;
  /** 表达式写入字段内部的目标路径，例如 props.disabled。 */
  targetPath: string;
  /** 表达式源码。 */
  expression: string;
  /** 依赖的 model 路径。 */
  deps: string[];
}

/** 一条已编译的副作用规则。 */
export interface SideEffect {
  /** 源字段路径，变化时触发。 */
  sourcePath: string;
  type: "clear";
  when?: string | undefined;
  targets: string[];
}

export type FieldMap = Record<string, FormField>;
export type DependencyGraph = Record<string, ExpressionEffect[]>;
export type SideEffectGraph = Record<string, SideEffect[]>;

/** 单个 repeatable 容器展开后的运行时缓存。 */
export interface RepeatableRuntime {
  itemFieldMap: FieldMap;
  itemExpressionEffects: ExpressionEffect[];
  itemSideEffects: SideEffect[];
}

export interface FormEngineOptions {
  /** 本地 schema。 */
  schema: FormField[];
  /** 初始表单数据。 */
  initialModel?: FormModel | undefined;
  /** 注入给表达式使用的函数。 */
  functions?: FunctionRegistry | undefined;
  /** 一次 setValue 允许的最大级联步数，用于防止副作用互相触发造成死循环。 */
  maxSteps?: number | undefined;
}

/** useFormEngine 暴露给渲染层的 API。 */
export interface FormEngine {
  /** 业务数据；写入请统一走 setValue。 */
  model: FormModel;
  /** 已经补齐 path 的静态 schema，repeatable 的 itemSchema 不在此展开。 */
  schema: ShallowRef<FormField[]>;
  /** 静态字段 + repeatable 数组项字段。 */
  runtimeFieldMap: ComputedRef<FieldMap>;
  /** 调试用：path -> 依赖该 path 的表达式。 */
  runtimeDependencyGraph: ComputedRef<DependencyGraph>;
  /** 调试用：path -> 由该 path 触发的副作用。 */
  runtimeSideEffectGraph: ComputedRef<SideEffectGraph>;
  getValue(path: string): any;
  setValue(path: string, value: any): void;
  append(arrayPath: string): void;
  remove(arrayPath: string, index: number): void;
}
