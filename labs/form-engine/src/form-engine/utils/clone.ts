/**
 * 结构化深拷贝。
 *
 * 与 JSON.parse(JSON.stringify()) 相比：
 * - 保留 undefined、Date、RegExp；
 * - 函数、Map/Set、类实例按引用保留，不会被丢成空对象；
 * - 支持循环引用。
 */

function isPlainObject(value: unknown): boolean {
  if (Object.prototype.toString.call(value) !== "[object Object]") return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function cloneValue(value: any, seen: WeakMap<object, any>): any {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (!Array.isArray(value) && !isPlainObject(value)) return value;

  const cached = seen.get(value);
  if (cached) return cached;

  const output: any = Array.isArray(value) ? [] : {};
  seen.set(value, output);

  Object.keys(value).forEach((key) => {
    output[key] = cloneValue(value[key], seen);
  });

  return output;
}

export function deepClone<T>(value: T): T {
  return cloneValue(value, new WeakMap());
}
