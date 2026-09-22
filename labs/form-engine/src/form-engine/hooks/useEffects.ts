import type {
  FieldMap,
  FormField,
  FormModel,
  FunctionRegistry,
  SideEffect,
  SideEffectGraph,
} from "../types";
import { evalExpression } from "../utils/expr";
import { getByPath, isPathRelated, parseArrayContext, setByPath } from "../utils/path";

function buildStaticSideEffects(fields: FormField[]): SideEffect[] {
  const result: SideEffect[] = [];

  function walk(list: FormField[]): void {
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
    graph[effect.sourcePath]!.push(effect);
  });

  return graph;
}

export interface UseEffectsParams {
  model: FormModel;
  getRuntimeFieldMap: () => FieldMap;
  functions?: FunctionRegistry | undefined;
}

export function useEffects(params: UseEffectsParams) {
  const { model, getRuntimeFieldMap, functions = {} } = params;

  function createStaticSideEffects(fields: FormField[]): SideEffect[] {
    return buildStaticSideEffects(fields);
  }

  function createSideEffectGraph(effects: SideEffect[]): SideEffectGraph {
    return buildSideEffectGraph(effects);
  }

  /**
   * 执行一条副作用，返回被改动的 model 路径。
   *
   * 返回值会交给调度队列继续派发，这样 “a 清空 b、b 又清空 c” 能级联到稳定状态。
   */
  function runSideEffect(effect: SideEffect): string[] {
    const sourceField = getRuntimeFieldMap()[effect.sourcePath];
    const context = parseArrayContext(effect.sourcePath);
    const item = context ? getByPath(model, `${context.arrayPath}[${context.index}]`) : undefined;

    if (effect.when) {
      const passed = evalExpression(effect.when, {
        $model: model,
        $item: item,
        $index: context?.index,
        $self: sourceField,
        $functions: functions,
      });

      if (!passed) return [];
    }

    if (effect.type === "clear") {
      effect.targets.forEach((targetPath) => {
        setByPath(model, targetPath, undefined);
      });
    }

    return [...effect.targets];
  }

  /** 按变更路径增量执行副作用，返回被清空的路径列表。 */
  function triggerSideEffectsByPath(changedPath: string, graph: SideEffectGraph): string[] {
    const matched = new Set<SideEffect>();

    Object.keys(graph).forEach((sourcePath) => {
      if (isPathRelated(changedPath, sourcePath)) {
        (graph[sourcePath] ?? []).forEach((effect) => matched.add(effect));
      }
    });

    return Array.from(matched).flatMap((effect) => runSideEffect(effect));
  }

  return {
    createStaticSideEffects,
    createSideEffectGraph,
    runSideEffect,
    triggerSideEffectsByPath,
  };
}
