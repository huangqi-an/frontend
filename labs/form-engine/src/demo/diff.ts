/**
 * 比较两份配置对象的叶子差异，用来观察表达式到底改到了哪些路径。
 *
 * 返回形如 ["props.disabled: false → true"] 的字符串列表。
 */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";

  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text;
}

export function diffPaths(source: unknown, runtime: unknown, prefix = ""): string[] {
  if (Object.is(source, runtime)) return [];

  if (isPlainRecord(source) && isPlainRecord(runtime)) {
    const keys = new Set([...Object.keys(source), ...Object.keys(runtime)]);

    return [...keys].flatMap((key) =>
      diffPaths(source[key], runtime[key], prefix ? `${prefix}.${key}` : key),
    );
  }

  if (Array.isArray(source) && Array.isArray(runtime)) {
    const length = Math.max(source.length, runtime.length);

    return Array.from({ length }, (_unused, index) => index).flatMap((index) =>
      diffPaths(source[index], runtime[index], `${prefix}[${index}]`),
    );
  }

  return [`${prefix || "(root)"}: ${formatValue(source)} → ${formatValue(runtime)}`];
}
