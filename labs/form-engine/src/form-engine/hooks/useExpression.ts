import type {
  DependencyGraph,
  ExpressionEffect,
  FieldMap,
  FormField,
  FormModel,
  FunctionRegistry,
  ParsedDep,
} from "../types";
import { collectDeps, evalExpression } from "../utils/expr";
import { getByPath, isPathRelated, parseArrayContext, setByPath } from "../utils/path";

function resolveStaticDeps(parsedDeps: ParsedDep[]): string[] {
  return parsedDeps.filter((dep) => dep.type === "model").map((dep) => dep.path);
}

function buildExpressionEffects(fields: FormField[]): ExpressionEffect[] {
  const result: ExpressionEffect[] = [];

  function walk(list: FormField[]): void {
    list.forEach((field) => {
      if (field.path && field.expressions) {
        Object.entries(field.expressions).forEach(([targetPath, expression]) => {
          result.push({
            fieldPath: field.path!,
            targetPath,
            expression,
            deps: resolveStaticDeps(collectDeps(expression)),
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
      graph[dep]!.push(effect);
    });
  });

  return graph;
}

export interface UseExpressionParams {
  model: FormModel;
  getRuntimeFieldMap: () => FieldMap;
  functions?: FunctionRegistry | undefined;
}

export function useExpression(params: UseExpressionParams) {
  const { model, getRuntimeFieldMap, functions = {} } = params;

  /** 为静态字段生成表达式规则。 */
  function createStaticExpressionEffects(fields: FormField[]): ExpressionEffect[] {
    return buildExpressionEffects(fields);
  }

  function createDependencyGraph(effects: ExpressionEffect[]): DependencyGraph {
    return buildDependencyGraph(effects);
  }

  /** 执行一条表达式规则，结果写进运行时字段。 */
  function runExpressionEffect(effect: ExpressionEffect): void {
    const field = getRuntimeFieldMap()[effect.fieldPath];
    if (!field) return;

    const context = parseArrayContext(effect.fieldPath);
    const item = context ? getByPath(model, `${context.arrayPath}[${context.index}]`) : undefined;

    const result = evalExpression(effect.expression, {
      $model: model,
      $item: item,
      $index: context?.index,
      $self: field,
      $functions: functions,
    });

    setByPath(field, effect.targetPath, result);
  }

  /** 全量执行：用于初始化，以及数组增删后的统一重算。 */
  function runAllExpressions(effects: ExpressionEffect[]): void {
    effects.forEach(runExpressionEffect);
  }

  /** 按变更路径增量执行；父子路径都会命中，保证整体替换数组时也能联动。 */
  function triggerExpressionsByPath(changedPath: string, graph: DependencyGraph): void {
    const matched = new Set<ExpressionEffect>();

    Object.keys(graph).forEach((depPath) => {
      if (isPathRelated(changedPath, depPath)) {
        (graph[depPath] ?? []).forEach((effect) => matched.add(effect));
      }
    });

    matched.forEach(runExpressionEffect);
  }

  return {
    createStaticExpressionEffects,
    createDependencyGraph,
    runExpressionEffect,
    runAllExpressions,
    triggerExpressionsByPath,
  };
}
