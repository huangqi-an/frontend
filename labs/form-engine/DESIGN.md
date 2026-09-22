# 一、**建议目录结构**

```bash
form-engine/
  types.ts
  utils/
    path.ts
    clone.ts
    expr.ts
  hooks/
    useSchema.ts
    useExpression.ts
    useEffects.ts
    useRepeatable.ts
    useFormEngine.ts
```

# 二、**类型定义`types.ts`**

```tsx
// form-engine/types.ts

export type ExpressionMap = Record<string, string>;

export interface FieldEffect {
  /** 副作用类型：先只实现 clear，后面可扩展 reset/assign/request 等 */
  type: "clear";
  /** 满足条件时才执行 */
  when?: string;
  /** 要影响的目标字段路径；在 repeatable 项中支持相对路径 */
  targets: string[];
}

export interface FormField {
  /** 字段名，例如 name、contact、phone */
  field?: string;
  /** 初始化或运行时生成的完整路径，例如 contact.phone、contacts[0].name */
  path?: string;

  /** 渲染组件标识，例如 el-input / el-select / 自定义组件 */
  component?: string;

  /** 透传给 UI 组件的属性，结构不固定 */
  props?: Record<string, any>;

  /** 业务自定义数据，例如 options / remoteMethod / 请求配置等 */
  custom?: Record<string, any>;

  /** 校验规则 */
  rules?: any[];

  /** 表达式联动：targetPath -> expression */
  expressions?: ExpressionMap;

  /** 副作用配置 */
  effects?: FieldEffect[];

  /** 对象嵌套 */
  children?: FormField[];

  /** 数组项模板 */
  itemSchema?: FormField[];

  /** 是否为可增删数组容器 */
  repeatable?: boolean;
}

export interface ParsedDep {
  type: "model" | "item";
  path: string;
}

export interface ExpressionEffect {
  /** 被影响的字段路径 */
  fieldPath: string;
  /** 被影响字段内部的目标路径，如 props.disabled / rules[0].required */
  targetPath: string;
  /** 表达式字符串 */
  expression: string;
  /** 依赖的 model path */
  deps: string[];
}

export interface SideEffect {
  /** 源字段路径，变化时触发 */
  sourcePath: string;
  type: "clear";
  when?: string;
  targets: string[];
}

export type FieldMap = Record<string, FormField>;
export type DependencyGraph = Record<string, ExpressionEffect[]>;
export type SideEffectGraph = Record<string, SideEffect[]>;

export interface RepeatableRuntime {
  itemFieldMap: FieldMap;
  itemExpressionEffects: ExpressionEffect[];
  itemSideEffects: SideEffect[];
}

export interface FormEngineOptions {
  /** 本地 schema */
  schema: FormField[];
  /** 初始表单数据 */
  initialModel?: Record<string, any>;
  /** 外部注入函数，如 options 获取、远程搜索等 */
  functions?: Record<string, (...args: any[]) => any>;
}
```

# 三、基础工具

**1）路径工具 `utils/path.ts`**

```tsx
// form-engine/utils/path.ts

/**
 * 将 a[0].b 转成 a.0.b，便于统一 split 处理
 */
export function normalizePath(path: string) {
  return path.replace(/$(\d+)$/g, ".$1");
}

/**
 * 根据路径读取对象值
 * 例：
 * getByPath(model, 'contact.phone')
 * getByPath(model, 'contacts[0].name')
 */
export function getByPath(obj: any, path: string) {
  if (!path) return obj;

  return normalizePath(path)
    .split(".")
    .filter(Boolean)
    .reduce((cur, key) => cur?.[key], obj);
}

/**
 * 根据路径设置对象值
 * 例：
 * setByPath(model, 'contact.phone', '123')
 * setByPath(model, 'contacts[0].name', 'Tom')
 */
export function setByPath(obj: any, path: string, value: any) {
  if (!path) return;

  const keys = normalizePath(path).split(".").filter(Boolean);
  let cur = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];

    if (cur[key] == null) {
      cur[key] = /^\d+$/.test(nextKey) ? [] : {};
    }

    cur = cur[key];
  }

  cur[keys[keys.length - 1]] = value;
}

/**
 * 判断两个路径是否存在父子/相同关系
 * 用于 setValue('contact') 时，也能触发依赖 contact.phone 的表达式
 */
export function isPathRelated(changedPath: string, depPath: string) {
  return (
    changedPath === depPath ||
    changedPath.startsWith(depPath + ".") ||
    changedPath.startsWith(depPath + "[") ||
    depPath.startsWith(changedPath + ".") ||
    depPath.startsWith(changedPath + "[")
  );
}
```

**2）深拷贝 `utils/clone.ts`**

```tsx
// form-engine/utils/clone.ts

/**
 * 简单深拷贝
 * 如果你的 schema 里有函数、Date 等，可替换成更稳的 deepClone 实现
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
```

**3）表达式工具 `utils/expr.ts`**

```tsx
// form-engine/utils/expr.ts

import type { ParsedDep } from "../types";

/**
 * 执行表达式
 * 注意：这里使用 new Function，前提是 schema 为本地可信配置
 */
export function evalExpression(expression: string, context: Record<string, any>) {
  const keys = Object.keys(context);
  const values = Object.values(context);

  try {
    const fn = new Function(...keys, `return (${expression})`);
    return fn(...values);
  } catch (error) {
    console.error("[FormEngine][ExpressionError]", expression, error);
    return undefined;
  }
}

/**
 * 收集表达式中的依赖
 * 支持：
 * - $model.xxx
 * - $item.xxx
 */
export function collectDeps(expression: string): ParsedDep[] {
  const deps: ParsedDep[] = [];

  const modelMatches = expression.match(/\$model((\.[a-zA-Z_$][\w$]*)+)/g) || [];
  modelMatches.forEach((m) => {
    deps.push({
      type: "model",
      path: m.replace(/^\$model\./, ""),
    });
  });

  const itemMatches = expression.match(/\$item((\.[a-zA-Z_$][\w$]*)+)/g) || [];
  itemMatches.forEach((m) => {
    deps.push({
      type: "item",
      path: m.replace(/^\$item\./, ""),
    });
  });

  return deps;
}
```

# 四、`useSchema.ts`

负责：

- 初始化静态 path
- 收集静态字段 map
- 找出 repeatable 容器

```tsx
// form-engine/hooks/useSchema.ts

import { computed, shallowRef } from "vue";
import type { FieldMap, FormField } from "../types";
import { deepClone } from "../utils/clone";

/**
 * 构建静态字段路径：
 * - 普通字段、对象嵌套字段会在初始化时生成 path
 * - repeatable 的 itemSchema 不在这里展开
 */
function buildStaticFieldPath(schema: FormField[], parentPath = ""): FormField[] {
  return schema.map((field) => {
    const currentPath = field.field
      ? parentPath
        ? `${parentPath}.${field.field}`
        : field.field
      : parentPath;

    const nextField: FormField = {
      ...deepClone(field),
      path: currentPath,
    };

    if (field.children?.length) {
      nextField.children = buildStaticFieldPath(field.children, currentPath);
    }

    return nextField;
  });
}

/**
 * 收集字段映射：field.path -> field
 */
function collectFieldMap(fields: FormField[], map: FieldMap) {
  fields.forEach((field) => {
    if (field.path) {
      map[field.path] = field;
    }

    if (field.children?.length) {
      collectFieldMap(field.children, map);
    }
  });
}

/**
 * 收集 repeatable 容器字段
 */
function collectRepeatableFields(fields: FormField[], result: FormField[]) {
  fields.forEach((field) => {
    if (field.repeatable) {
      result.push(field);
    }

    if (field.children?.length) {
      collectRepeatableFields(field.children, result);
    }
  });
}

export function useSchema(inputSchema: FormField[]) {
  /** 静态 schema：path 已初始化 */
  const staticSchemaRef = shallowRef<FormField[]>(buildStaticFieldPath(inputSchema));

  /** 静态 fieldMap */
  const staticFieldMap = computed<FieldMap>(() => {
    const map: FieldMap = {};
    collectFieldMap(staticSchemaRef.value, map);
    return map;
  });

  /** 所有 repeatable 容器 */
  const repeatableFields = computed<FormField[]>(() => {
    const result: FormField[] = [];
    collectRepeatableFields(staticSchemaRef.value, result);
    return result;
  });

  return {
    staticSchemaRef,
    staticFieldMap,
    repeatableFields,
  };
}
```

# 五、`useExpression.ts`

负责：

- 构建表达式 effect
- 构建依赖图
- 执行 expression
- 根据 path 触发增量更新

```tsx
// form-engine/hooks/useExpression.ts

import { computed } from "vue";
import type { DependencyGraph, ExpressionEffect, FieldMap, FormField, ParsedDep } from "../types";
import { collectDeps, evalExpression } from "../utils/expr";
import { getByPath, isPathRelated, setByPath } from "../utils/path";

function resolveStaticDeps(parsedDeps: ParsedDep[]) {
  return parsedDeps.filter((dep) => dep.type === "model").map((dep) => dep.path);
}

function buildExpressionEffects(fields: FormField[]): ExpressionEffect[] {
  const result: ExpressionEffect[] = [];

  function walk(list: FormField[]) {
    list.forEach((field) => {
      if (field.path && field.expressions) {
        Object.entries(field.expressions).forEach(([targetPath, expression]) => {
          const deps = resolveStaticDeps(collectDeps(expression));
          result.push({
            fieldPath: field.path!,
            targetPath,
            expression,
            deps,
          });
        });
      }

      if (field.children?.length) {
        walk(field.children);
      }
    });
  }

  walk(fields);
  return result;
}

function buildDependencyGraph(effects: ExpressionEffect[]): DependencyGraph {
  const graph: DependencyGraph = {};

  effects.forEach((effect) => {
    effect.deps.forEach((dep) => {
      if (!graph[dep]) graph[dep] = [];
      graph[dep].push(effect);
    });
  });

  return graph;
}

/**
 * 从 fieldPath 中解析数组上下文
 * 例：
 * emergencyContacts[1].phone -> { arrayPath: 'emergencyContacts', index: 1 }
 */
function parseArrayContext(path: string): { arrayPath: string; index: number } | null {
  const match = path.match(/^(.*)$(\d+)$\..+$/);
  if (!match) return null;

  return {
    arrayPath: match[1],
    index: Number(match[2]),
  };
}

export function useExpression(params: {
  model: Record<string, any>;
  getRuntimeFieldMap: () => FieldMap;
  functions?: Record<string, (...args: any[]) => any>;
}) {
  const { model, getRuntimeFieldMap, functions = {} } = params;

  /**
   * 生成静态字段的 expression effects
   */
  function createStaticExpressionEffects(fields: FormField[]) {
    return buildExpressionEffects(fields);
  }

  /**
   * 构建依赖图
   */
  function createDependencyGraph(effects: ExpressionEffect[]) {
    return buildDependencyGraph(effects);
  }

  /**
   * 执行单个表达式 effect
   */
  function runExpressionEffect(effect: ExpressionEffect) {
    const fieldMap = getRuntimeFieldMap();
    const field = fieldMap[effect.fieldPath];
    if (!field) return;

    const ctx = parseArrayContext(effect.fieldPath);
    const item = ctx ? getByPath(model, `${ctx.arrayPath}[${ctx.index}]`) : undefined;

    const result = evalExpression(effect.expression, {
      $model: model,
      $item: item,
      $index: ctx?.index,
      $self: field,
      $functions: functions,
    });

    setByPath(field, effect.targetPath, result);
  }

  /**
   * 全量执行 expressions
   * 适用于初始化，或数组项增删后的统一重算
   */
  function runAllExpressions(effects: ExpressionEffect[]) {
    effects.forEach(runExpressionEffect);
  }

  /**
   * 根据变更 path 增量触发相关 expressions
   * 这里做了 related path 匹配，支持父子路径联动
   */
  function triggerExpressionsByPath(changedPath: string, graph: DependencyGraph) {
    const matchedEffects = new Set<ExpressionEffect>();

    Object.keys(graph).forEach((depPath) => {
      if (isPathRelated(changedPath, depPath)) {
        (graph[depPath] || []).forEach((effect) => matchedEffects.add(effect));
      }
    });

    matchedEffects.forEach(runExpressionEffect);
  }

  return {
    createStaticExpressionEffects,
    createDependencyGraph,
    runExpressionEffect,
    runAllExpressions,
    triggerExpressionsByPath,
  };
}
```

# 六、`useEffects.ts`

负责副作用：

- 扫描 effects
- 构建 sideEffectGraph
- 按 path 执行 clear 等副作用

```tsx
// form-engine/hooks/useEffects.ts

import type { FieldMap, FormField, SideEffect, SideEffectGraph } from "../types";
import { evalExpression } from "../utils/expr";
import { getByPath, isPathRelated, setByPath } from "../utils/path";

function buildStaticSideEffects(fields: FormField[]) {
  const result: SideEffect[] = [];

  function walk(list: FormField[]) {
    list.forEach((field) => {
      if (field.path && field.effects?.length) {
        field.effects.forEach((effect) => {
          result.push({
            sourcePath: field.path!,
            type: effect.type,
            when: effect.when,
            targets: effect.targets,
          });
        });
      }

      if (field.children?.length) {
        walk(field.children);
      }
    });
  }

  walk(fields);
  return result;
}

function buildSideEffectGraph(effects: SideEffect[]): SideEffectGraph {
  const graph: SideEffectGraph = {};

  effects.forEach((effect) => {
    if (!graph[effect.sourcePath]) graph[effect.sourcePath] = [];
    graph[effect.sourcePath].push(effect);
  });

  return graph;
}

function parseArrayContext(path: string): { arrayPath: string; index: number } | null {
  const match = path.match(/^(.*)$(\d+)$\..+$/);
  if (!match) return null;

  return {
    arrayPath: match[1],
    index: Number(match[2]),
  };
}

export function useEffects(params: {
  model: Record<string, any>;
  getRuntimeFieldMap: () => FieldMap;
  functions?: Record<string, (...args: any[]) => any>;
}) {
  const { model, getRuntimeFieldMap, functions = {} } = params;

  function createStaticSideEffects(fields: FormField[]) {
    return buildStaticSideEffects(fields);
  }

  function createSideEffectGraph(effects: SideEffect[]) {
    return buildSideEffectGraph(effects);
  }

  /**
   * 执行单个副作用
   * 目前只实现 clear
   */
  function runSideEffect(effect: SideEffect) {
    const fieldMap = getRuntimeFieldMap();
    const sourceField = fieldMap[effect.sourcePath];
    const ctx = parseArrayContext(effect.sourcePath);
    const item = ctx ? getByPath(model, `${ctx.arrayPath}[${ctx.index}]`) : undefined;

    if (effect.when) {
      const passed = evalExpression(effect.when, {
        $model: model,
        $item: item,
        $index: ctx?.index,
        $self: sourceField,
        $functions: functions,
      });

      if (!passed) return;
    }

    if (effect.type === "clear") {
      effect.targets.forEach((targetPath) => {
        setByPath(model, targetPath, undefined);
      });
    }
  }

  /**
   * 根据 path 增量触发副作用
   */
  function triggerSideEffectsByPath(changedPath: string, graph: SideEffectGraph) {
    const matchedEffects = new Set<SideEffect>();

    Object.keys(graph).forEach((sourcePath) => {
      if (isPathRelated(changedPath, sourcePath)) {
        (graph[sourcePath] || []).forEach((effect) => matchedEffects.add(effect));
      }
    });

    matchedEffects.forEach(runSideEffect);
  }

  return {
    createStaticSideEffects,
    createSideEffectGraph,
    runSideEffect,
    triggerSideEffectsByPath,
  };
}
```

# 七、`useRepeatable.ts`

负责：

- 根据 repeatable 的 `itemSchema` 派生运行时字段
- 为每个数组容器构建 itemFieldMap / itemExpressionEffects / itemSideEffects
- 处理 add/remove
- 数组增删后局部重建

```tsx
// form-engine/hooks/useRepeatable.ts

import { reactive } from "vue";
import type {
  ExpressionEffect,
  FieldMap,
  FormField,
  ParsedDep,
  RepeatableRuntime,
  SideEffect,
} from "../types";
import { deepClone } from "../utils/clone";
import { collectDeps } from "../utils/expr";
import { getByPath, setByPath } from "../utils/path";

function collectFieldMap(fields: FormField[], map: FieldMap) {
  fields.forEach((field) => {
    if (field.path) {
      map[field.path] = field;
    }
    if (field.children?.length) {
      collectFieldMap(field.children, map);
    }
  });
}

function buildRuntimeChildren(children: FormField[], parentPath: string): FormField[] {
  return children.map((child) => {
    const currentPath = child.field ? `${parentPath}.${child.field}` : parentPath;

    const nextField: FormField = {
      ...deepClone(child),
      path: currentPath,
    };

    if (child.children?.length) {
      nextField.children = buildRuntimeChildren(child.children, currentPath);
    }

    return nextField;
  });
}

/**
 * 基于 itemSchema + index 生成数组项运行时字段
 */
function buildRuntimeItemFields(
  itemSchema: FormField[],
  arrayPath: string,
  index: number,
): FormField[] {
  return itemSchema.map((field) => {
    const currentPath = `${arrayPath}[${index}].${field.field}`;

    const nextField: FormField = {
      ...deepClone(field),
      path: currentPath,
    };

    if (field.children?.length) {
      nextField.children = buildRuntimeChildren(field.children, currentPath);
    }

    return nextField;
  });
}

function resolveRuntimeDeps(parsedDeps: ParsedDep[], arrayPath: string, index: number) {
  return parsedDeps.map((dep) => {
    if (dep.type === "model") return dep.path;
    return `${arrayPath}[${index}].${dep.path}`;
  });
}

function resolveRuntimeTargetPath(target: string, arrayPath: string, index: number) {
  // 相对路径：email -> emergencyContacts[1].email
  if (!target.includes(".") && !target.includes("[")) {
    return `${arrayPath}[${index}].${target}`;
  }
  return target;
}

/**
 * 构建数组项运行时 expressions
 */
function buildRuntimeItemExpressionEffects(
  runtimeFields: FormField[],
  arrayPath: string,
  index: number,
): ExpressionEffect[] {
  const result: ExpressionEffect[] = [];

  function walk(fields: FormField[]) {
    fields.forEach((field) => {
      if (field.path && field.expressions) {
        Object.entries(field.expressions).forEach(([targetPath, expression]) => {
          const deps = resolveRuntimeDeps(collectDeps(expression), arrayPath, index);
          result.push({
            fieldPath: field.path!,
            targetPath,
            expression,
            deps,
          });
        });
      }

      if (field.children?.length) {
        walk(field.children);
      }
    });
  }

  walk(runtimeFields);
  return result;
}

/**
 * 构建数组项运行时副作用
 */
function buildRuntimeItemSideEffects(
  runtimeFields: FormField[],
  arrayPath: string,
  index: number,
): SideEffect[] {
  const result: SideEffect[] = [];

  function walk(fields: FormField[]) {
    fields.forEach((field) => {
      if (field.path && field.effects?.length) {
        field.effects.forEach((effect) => {
          result.push({
            sourcePath: field.path!,
            type: effect.type,
            when: effect.when,
            targets: effect.targets.map((target) =>
              resolveRuntimeTargetPath(target, arrayPath, index),
            ),
          });
        });
      }

      if (field.children?.length) {
        walk(field.children);
      }
    });
  }

  walk(runtimeFields);
  return result;
}

/**
 * 根据 itemSchema 生成默认数组项数据
 */
function createDefaultItem(itemSchema: FormField[]) {
  const obj: Record<string, any> = {};

  itemSchema.forEach((field) => {
    if (!field.field) return;

    if (field.children?.length) {
      obj[field.field] = createDefaultItem(field.children);
    } else if (field.repeatable) {
      obj[field.field] = [];
    } else {
      obj[field.field] = undefined;
    }
  });

  return obj;
}

export function useRepeatable(params: {
  model: Record<string, any>;
  staticFieldMap: () => FieldMap;
}) {
  const { model, staticFieldMap } = params;

  /**
   * 每个 repeatable 容器的运行时缓存
   * key = arrayPath
   */
  const repeatableRuntimeMap = reactive<Record<string, RepeatableRuntime>>({});

  /**
   * 重建某个数组容器的运行时缓存
   */
  function rebuildRepeatableRuntime(arrayField: FormField) {
    const arrayPath = arrayField.path!;
    const list = getByPath(model, arrayPath) || [];

    const itemFieldMap: FieldMap = {};
    const itemExpressionEffects: ExpressionEffect[] = [];
    const itemSideEffects: SideEffect[] = [];

    list.forEach((_: any, index: number) => {
      const runtimeFields = buildRuntimeItemFields(arrayField.itemSchema || [], arrayPath, index);
      collectFieldMap(runtimeFields, itemFieldMap);

      itemExpressionEffects.push(
        ...buildRuntimeItemExpressionEffects(runtimeFields, arrayPath, index),
      );

      itemSideEffects.push(...buildRuntimeItemSideEffects(runtimeFields, arrayPath, index));
    });

    repeatableRuntimeMap[arrayPath] = {
      itemFieldMap,
      itemExpressionEffects,
      itemSideEffects,
    };
  }

  /**
   * 添加数组项
   */
  function addArrayItem(arrayPath: string) {
    const field = staticFieldMap()[arrayPath];
    if (!field?.itemSchema) return;

    const list = getByPath(model, arrayPath) || [];
    list.push(createDefaultItem(field.itemSchema));
    setByPath(model, arrayPath, list);

    rebuildRepeatableRuntime(field);
  }

  /**
   * 删除数组项
   * 删除后会重建整个数组容器的运行时 path / graph
   */
  function removeArrayItem(arrayPath: string, index: number) {
    const field = staticFieldMap()[arrayPath];
    if (!field) return;

    const list = getByPath(model, arrayPath) || [];
    list.splice(index, 1);
    setByPath(model, arrayPath, list);

    rebuildRepeatableRuntime(field);
  }

  return {
    repeatableRuntimeMap,
    rebuildRepeatableRuntime,
    addArrayItem,
    removeArrayItem,
  };
}
```

# 八、`useFormEngine.ts`

这是总 hook，负责串联：

- model
- schema
- expression
- side effect
- repeatable runtime
- 暴露统一 API

```tsx
// form-engine/hooks/useFormEngine.ts

import { computed, reactive } from "vue";
import type {
  DependencyGraph,
  ExpressionEffect,
  FieldMap,
  FormEngineOptions,
  SideEffect,
  SideEffectGraph,
} from "../types";
import { getByPath, setByPath } from "../utils/path";
import { useEffects } from "./useEffects";
import { useExpression } from "./useExpression";
import { useRepeatable } from "./useRepeatable";
import { useSchema } from "./useSchema";

export function useFormEngine(options: FormEngineOptions) {
  const model = reactive<Record<string, any>>(options.initialModel || {});
  const functions = options.functions || {};

  /** 1. 静态 schema 初始化 */
  const { staticSchemaRef, staticFieldMap, repeatableFields } = useSchema(options.schema);

  /** 2. repeatable 运行时层 */
  const { repeatableRuntimeMap, rebuildRepeatableRuntime, addArrayItem, removeArrayItem } =
    useRepeatable({
      model,
      staticFieldMap: () => staticFieldMap.value,
    });

  /**
   * 3. 运行时合并 fieldMap
   * = 静态字段 + repeatable 数组项实例字段
   */
  const runtimeFieldMap = computed<FieldMap>(() => {
    const merged: FieldMap = {
      ...staticFieldMap.value,
    };

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      Object.assign(merged, runtime.itemFieldMap);
    });

    return merged;
  });

  /** 4. expressions */
  const {
    createStaticExpressionEffects,
    createDependencyGraph,
    runAllExpressions,
    triggerExpressionsByPath,
  } = useExpression({
    model,
    getRuntimeFieldMap: () => runtimeFieldMap.value,
    functions,
  });

  /** 5. side effects */
  const { createStaticSideEffects, createSideEffectGraph, triggerSideEffectsByPath } = useEffects({
    model,
    getRuntimeFieldMap: () => runtimeFieldMap.value,
    functions,
  });

  /** 静态 expressions */
  const staticExpressionEffects = computed<ExpressionEffect[]>(() =>
    createStaticExpressionEffects(staticSchemaRef.value),
  );

  /** 运行时 expressions = 静态 + repeatable */
  const runtimeExpressionEffects = computed<ExpressionEffect[]>(() => {
    const merged: ExpressionEffect[] = [...staticExpressionEffects.value];

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      merged.push(...runtime.itemExpressionEffects);
    });

    return merged;
  });

  /** 运行时 dependency graph */
  const runtimeDependencyGraph = computed<DependencyGraph>(() =>
    createDependencyGraph(runtimeExpressionEffects.value),
  );

  /** 静态 side effects */
  const staticSideEffects = computed<SideEffect[]>(() =>
    createStaticSideEffects(staticSchemaRef.value),
  );

  /** 运行时 side effects = 静态 + repeatable */
  const runtimeSideEffects = computed<SideEffect[]>(() => {
    const merged: SideEffect[] = [...staticSideEffects.value];

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      merged.push(...runtime.itemSideEffects);
    });

    return merged;
  });

  /** 运行时 side effect graph */
  const runtimeSideEffectGraph = computed<SideEffectGraph>(() =>
    createSideEffectGraph(runtimeSideEffects.value),
  );

  /**
   * 初始化：
   * 1. 先根据 model 中已有的数组数据，重建所有 repeatable 容器的运行时缓存
   * 2. 再执行一遍全部 expressions，得到初始 props/rules/custom 状态
   */
  function init() {
    repeatableFields.value.forEach((field) => {
      rebuildRepeatableRuntime(field);
    });

    runAllExpressions(runtimeExpressionEffects.value);
  }

  /**
   * 统一写值入口
   * 推荐业务侧统一使用这个方法，而不是直接 model.xxx = xxx
   */
  function setValue(path: string, value: any) {
    setByPath(model, path, value);

    // 先更新配置联动
    triggerExpressionsByPath(path, runtimeDependencyGraph.value);

    // 再处理副作用
    triggerSideEffectsByPath(path, runtimeSideEffectGraph.value);
  }

  function getValue(path: string) {
    return getByPath(model, path);
  }

  /**
   * 包一层 add/remove：
   * 数组增删后重新执行全部 expressions，保证新增/索引变更后的联动状态正确
   */
  function append(arrayPath: string) {
    addArrayItem(arrayPath);
    runAllExpressions(runtimeExpressionEffects.value);
  }

  function remove(arrayPath: string, index: number) {
    removeArrayItem(arrayPath, index);
    runAllExpressions(runtimeExpressionEffects.value);
  }

  init();

  return {
    /** 表单数据 */
    model,

    /** 静态 schema，可用于渲染普通字段和 repeatable 容器 */
    schema: staticSchemaRef,

    /** 运行时合并 fieldMap */
    runtimeFieldMap,

    /** 调试用：运行时图 */
    runtimeDependencyGraph,
    runtimeSideEffectGraph,

    /** 统一数据操作 */
    getValue,
    setValue,

    /** repeatable 操作 */
    append,
    remove,
  };
}
```

**九、怎么用**

```tsx
import { useFormEngine } from "./form-engine/hooks/useFormEngine";
import type { FormField } from "./form-engine/types";

const schema: FormField[] = [
  {
    field: "name",
    component: "el-input",
    props: {
      placeholder: "请输入姓名",
      visible: true,
    },
  },
  {
    field: "userType",
    component: "el-select",
    props: {
      placeholder: "请选择用户类型",
      visible: true,
    },
    custom: {
      options: [
        { label: "普通用户", value: "normal" },
        { label: "管理员", value: "admin" },
      ],
    },
    effects: [
      {
        type: "clear",
        targets: ["dept"],
      },
    ],
  },
  {
    field: "dept",
    component: "el-select",
    props: {
      placeholder: "请选择部门",
      disabled: false,
      visible: true,
    },
    custom: {
      options: [],
    },
    rules: [{ required: false, message: "请选择部门" }],
    expressions: {
      "props.disabled": "!$model.name",
      "props.visible": '$model.userType === "admin"',
      "rules[0].required": '$model.userType === "admin"',
      "custom.options": "$functions.getDeptOptions($model.userType)",
    },
  },
  {
    field: "emergencyContacts",
    repeatable: true,
    itemSchema: [
      {
        field: "name",
        component: "el-input",
        props: {
          placeholder: "联系人姓名",
        },
      },
      {
        field: "phone",
        component: "el-input",
        props: {
          placeholder: "联系人手机号",
          disabled: false,
        },
        expressions: {
          "props.disabled": "!$item.name",
        },
      },
      {
        field: "email",
        component: "el-input",
        props: {
          placeholder: "联系人邮箱",
        },
      },
    ],
  },
];

const {
  model,
  schema: runtimeSchema,
  getValue,
  setValue,
  append,
  remove,
} = useFormEngine({
  schema,
  initialModel: {
    name: "",
    userType: "",
    dept: "",
    emergencyContacts: [],
  },
  functions: {
    getDeptOptions(userType: string) {
      if (userType === "admin") {
        return [
          { label: "技术部", value: "tech" },
          { label: "产品部", value: "product" },
        ];
      }
      return [{ label: "访客组", value: "guest" }];
    },
  },
});
```
