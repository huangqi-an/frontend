/**
 * 路径工具。
 *
 * 引擎统一使用 a.b[0].c 这种写法；读写前会先规范化成 a.b.0.c，便于按 "." 拆分。
 */

const INDEX_PATTERN = /\[(\d+)\]/g;
const ARRAY_CONTEXT_PATTERN = /^(.*)\[(\d+)\](?:\.|$)/;

/** 把 a[0].b 规范化成 a.0.b。 */
export function normalizePath(path: string): string {
  return path.replace(INDEX_PATTERN, ".$1");
}

export function splitPath(path: string): string[] {
  return normalizePath(path)
    .split(".")
    .filter((segment) => segment !== "");
}

/**
 * 根据路径读取值。
 *
 * getByPath(model, "contact.phone")
 * getByPath(model, "contacts[0].name")
 */
export function getByPath(target: any, path: string): any {
  if (!path) return target;

  return splitPath(path).reduce(
    (current, key) => (current == null ? undefined : current[key]),
    target,
  );
}

/**
 * 根据路径写值，缺失的容器会按下一段的类型自动创建。
 *
 * setByPath(model, "contact.phone", "138")
 * setByPath(model, "contacts[0].name", "Tom")
 */
export function setByPath(target: any, path: string, value: any): void {
  if (!path) return;

  const keys = splitPath(path);
  let current = target;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    const nextKey = keys[i + 1]!;

    if (current[key] == null) {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }

    current = current[key];
  }

  current[keys[keys.length - 1]!] = value;
}

/** 拼接父路径与字段名。 */
export function joinPath(parentPath: string, field?: string): string {
  if (!field) return parentPath;
  return parentPath ? `${parentPath}.${field}` : field;
}

/**
 * 判断两个路径是否存在父子或相同关系。
 *
 * 用于 setValue("contact") 时也能触发依赖 contact.phone 的表达式。
 */
export function isPathRelated(changedPath: string, depPath: string): boolean {
  if (changedPath === depPath) return true;

  return (
    changedPath.startsWith(`${depPath}.`) ||
    changedPath.startsWith(`${depPath}[`) ||
    depPath.startsWith(`${changedPath}.`) ||
    depPath.startsWith(`${changedPath}[`)
  );
}

/**
 * 从 contacts[0].phone 这类路径里解析出数组根路径和下标。
 *
 * 取最后一个下标，因此 a.b[1].c 会得到 { arrayPath: "a.b", index: 1 }。
 */
export function parseArrayContext(path: string): { arrayPath: string; index: number } | null {
  const match = ARRAY_CONTEXT_PATTERN.exec(path);
  if (!match) return null;

  const arrayPath = match[1];
  const index = match[2];
  if (!arrayPath || index === undefined) return null;

  return { arrayPath, index: Number(index) };
}
