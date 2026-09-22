import type { ParsedDep } from "../types";

type CompiledExpression = (...args: any[]) => any;

/** 同一个表达式只编译一次；key 里带上形参列表，避免不同调用方互相污染。 */
const compiledCache = new Map<string, CompiledExpression>();

const DEP_PATTERN = /\$(model|item)((?:\.[A-Za-z_$][\w$]*|\[\d+\])+)/g;

/**
 * 编译表达式。
 *
 * schema 属于本地可信配置，所以直接使用 new Function；
 * 如果 schema 来自服务端或允许用户编辑，请替换成 AST 白名单求值器。
 */
export function compileExpression(expression: string, keys: string[]): CompiledExpression {
  const cacheKey = `${keys.join(",")}\u0000${expression}`;
  const cached = compiledCache.get(cacheKey);
  if (cached) return cached;

  const compiled = new Function(
    ...keys,
    `"use strict"; return (${expression});`,
  ) as CompiledExpression;
  compiledCache.set(cacheKey, compiled);

  return compiled;
}

/** 求值；出错时返回 undefined 并打印日志，不影响其他字段。 */
export function evalExpression(expression: string, context: Record<string, any>): any {
  const keys = Object.keys(context);

  try {
    return compileExpression(expression, keys)(...keys.map((key) => context[key]));
  } catch (error) {
    console.error("[FormEngine][ExpressionError]", expression, error);
    return undefined;
  }
}

/**
 * 收集表达式里的依赖。
 *
 * 支持 $model.xxx、$model.contacts[0].xxx、$item.xxx，重复出现只保留一份。
 */
export function collectDeps(expression: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const seen = new Set<string>();

  for (const match of expression.matchAll(DEP_PATTERN)) {
    const scope = match[1];
    const rawPath = match[2];
    if (!scope || !rawPath) continue;

    const path = rawPath.replace(/^\./, "");
    const key = `${scope}:${path}`;
    if (seen.has(key)) continue;

    seen.add(key);
    deps.push({ type: scope === "model" ? "model" : "item", path });
  }

  return deps;
}
