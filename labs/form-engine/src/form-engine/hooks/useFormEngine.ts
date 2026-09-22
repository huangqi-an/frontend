import { computed, reactive } from "vue";

import type {
  DependencyGraph,
  ExpressionEffect,
  FieldMap,
  FormEngine,
  FormEngineOptions,
  FormModel,
  SideEffect,
  SideEffectGraph,
} from "../types";
import { deepClone } from "../utils/clone";
import { getByPath, setByPath } from "../utils/path";
import { useEffects } from "./useEffects";
import { useExpression } from "./useExpression";
import { useRepeatable } from "./useRepeatable";
import { useSchema } from "./useSchema";

export function useFormEngine(options: FormEngineOptions): FormEngine {
  const maxSteps = options.maxSteps ?? 100;
  const model = reactive<FormModel>(options.initialModel ? deepClone(options.initialModel) : {});
  const functions = options.functions ?? {};

  /** 1. 静态 schema 初始化。 */
  const { staticSchemaRef, staticFieldMap, repeatableFields } = useSchema(options.schema);

  /** 2. repeatable 运行时层。 */
  const { repeatableRuntimeMap, rebuildRepeatableRuntime, addArrayItem, removeArrayItem } =
    useRepeatable({
      model,
      staticFieldMap: () => staticFieldMap.value,
    });

  /** 3. 运行时字段 = 静态字段 + repeatable 数组项实例字段。 */
  const runtimeFieldMap = computed<FieldMap>(() => {
    const merged: FieldMap = { ...staticFieldMap.value };

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      Object.assign(merged, runtime.itemFieldMap);
    });

    return merged;
  });

  /** 4. expressions。 */
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

  /** 5. side effects。 */
  const { createStaticSideEffects, createSideEffectGraph, triggerSideEffectsByPath } = useEffects({
    model,
    getRuntimeFieldMap: () => runtimeFieldMap.value,
    functions,
  });

  const staticExpressionEffects = computed<ExpressionEffect[]>(() =>
    createStaticExpressionEffects(staticSchemaRef.value),
  );

  /** 运行时表达式 = 静态 + repeatable。 */
  const runtimeExpressionEffects = computed<ExpressionEffect[]>(() => {
    const merged: ExpressionEffect[] = [...staticExpressionEffects.value];

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      merged.push(...runtime.itemExpressionEffects);
    });

    return merged;
  });

  const runtimeDependencyGraph = computed<DependencyGraph>(() =>
    createDependencyGraph(runtimeExpressionEffects.value),
  );

  const staticSideEffects = computed<SideEffect[]>(() =>
    createStaticSideEffects(staticSchemaRef.value),
  );

  /** 运行时副作用 = 静态 + repeatable。 */
  const runtimeSideEffects = computed<SideEffect[]>(() => {
    const merged: SideEffect[] = [...staticSideEffects.value];

    Object.values(repeatableRuntimeMap).forEach((runtime) => {
      merged.push(...runtime.itemSideEffects);
    });

    return merged;
  });

  const runtimeSideEffectGraph = computed<SideEffectGraph>(() =>
    createSideEffectGraph(runtimeSideEffects.value),
  );

  /**
   * 用有限步 BFS 派发一次变更。
   *
   * 对每个路径先执行表达式（只改运行时字段），再执行副作用；副作用清空的路径会重新入队，
   * 因此可以级联，同时用 maxSteps 兜住互相触发的死循环。
   */
  function dispatch(startPath: string): void {
    const queue: string[] = [startPath];
    let steps = 0;

    while (queue.length > 0) {
      if (steps >= maxSteps) {
        console.warn(
          `[FormEngine][StepLimit] 级联超过 ${maxSteps} 步，已停止。起始路径：${startPath}`,
        );
        return;
      }

      steps += 1;
      const changedPath = queue.shift()!;

      triggerExpressionsByPath(changedPath, runtimeDependencyGraph.value);
      queue.push(...triggerSideEffectsByPath(changedPath, runtimeSideEffectGraph.value));
    }
  }

  /**
   * 初始化：
   * 1. 按 model 里已有的数组数据建立 repeatable 运行时缓存；
   * 2. 执行一次全部表达式。
   *
   * 初始化不执行副作用：副作用代表“值变化后的清理”，不应该清空调用方传入的初始 model。
   */
  function init(): void {
    repeatableFields.value.forEach((field) => {
      const arrayPath = field.path;
      if (!arrayPath) return;

      if (!Array.isArray(getByPath(model, arrayPath))) {
        setByPath(model, arrayPath, []);
      }

      rebuildRepeatableRuntime(field);
    });

    runAllExpressions(runtimeExpressionEffects.value);
  }

  /** 统一写值入口；直接改 model 不会触发表达式和副作用。 */
  function setValue(path: string, value: any): void {
    setByPath(model, path, value);
    dispatch(path);
  }

  function getValue(path: string): any {
    return getByPath(model, path);
  }

  /** 数组增删后重新执行全部表达式，保证新增项和下标前移后的状态都正确。 */
  function append(arrayPath: string): void {
    addArrayItem(arrayPath);
    runAllExpressions(runtimeExpressionEffects.value);
  }

  function remove(arrayPath: string, index: number): void {
    removeArrayItem(arrayPath, index);
    runAllExpressions(runtimeExpressionEffects.value);
  }

  init();

  return {
    model,
    schema: staticSchemaRef,
    runtimeFieldMap,
    runtimeDependencyGraph,
    runtimeSideEffectGraph,
    getValue,
    setValue,
    append,
    remove,
  };
}
