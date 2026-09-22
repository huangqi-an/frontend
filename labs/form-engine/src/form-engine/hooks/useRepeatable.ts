import { reactive } from "vue";

import type {
  ExpressionEffect,
  FieldMap,
  FormField,
  FormModel,
  ParsedDep,
  RepeatableRuntime,
  SideEffect,
} from "../types";
import { deepClone } from "../utils/clone";
import { collectDeps } from "../utils/expr";
import { getByPath, setByPath } from "../utils/path";

function collectFieldMap(fields: FormField[], map: FieldMap): void {
  fields.forEach((field) => {
    if (field.path) {
      map[field.path] = field;
    }

    if (field.children?.length) {
      collectFieldMap(field.children, map);
    }
  });
}

/** 展开对象嵌套字段，path 以父路径为前缀。 */
function buildRuntimeChildren(children: FormField[], parentPath: string): FormField[] {
  return children.map((child) => {
    const currentPath = child.field ? `${parentPath}.${child.field}` : parentPath;
    const nextField = reactive<FormField>({ ...deepClone(child), path: currentPath });

    if (child.children?.length) {
      nextField.children = buildRuntimeChildren(child.children, currentPath);
    }

    return nextField;
  });
}

/** 根据 itemSchema 和下标生成数组项的运行时字段。 */
function buildRuntimeItemFields(
  itemSchema: FormField[],
  arrayPath: string,
  index: number,
): FormField[] {
  return itemSchema.map((field) => {
    const currentPath = field.field
      ? `${arrayPath}[${index}].${field.field}`
      : `${arrayPath}[${index}]`;
    const nextField = reactive<FormField>({ ...deepClone(field), path: currentPath });

    if (field.children?.length) {
      nextField.children = buildRuntimeChildren(field.children, currentPath);
    }

    return nextField;
  });
}

/** 数组项里的 $item.xxx 需要解析成 contacts[1].xxx 这样的绝对路径。 */
function resolveRuntimeDeps(parsedDeps: ParsedDep[], arrayPath: string, index: number): string[] {
  return parsedDeps.map((dep) => {
    if (dep.type === "model") return dep.path;
    return `${arrayPath}[${index}].${dep.path}`;
  });
}

/** 副作用目标支持相对路径：email -> emergencyContacts[1].email。 */
function resolveRuntimeTargetPath(target: string, arrayPath: string, index: number): string {
  if (!target.includes(".") && !target.includes("[")) {
    return `${arrayPath}[${index}].${target}`;
  }

  return target;
}

function buildRuntimeItemExpressionEffects(
  runtimeFields: FormField[],
  arrayPath: string,
  index: number,
): ExpressionEffect[] {
  const result: ExpressionEffect[] = [];

  function walk(fields: FormField[]): void {
    fields.forEach((field) => {
      if (field.path && field.expressions) {
        Object.entries(field.expressions).forEach(([targetPath, expression]) => {
          result.push({
            fieldPath: field.path!,
            targetPath,
            expression,
            deps: resolveRuntimeDeps(collectDeps(expression), arrayPath, index),
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

function buildRuntimeItemSideEffects(
  runtimeFields: FormField[],
  arrayPath: string,
  index: number,
): SideEffect[] {
  const result: SideEffect[] = [];

  function walk(fields: FormField[]): void {
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

/** 根据 itemSchema 生成默认数组项数据。 */
function createDefaultItem(itemSchema: FormField[]): Record<string, any> {
  const item: Record<string, any> = {};

  itemSchema.forEach((field) => {
    if (!field.field) return;

    if (field.children?.length) {
      item[field.field] = createDefaultItem(field.children);
    } else if (field.repeatable) {
      item[field.field] = [];
    } else {
      item[field.field] = undefined;
    }
  });

  return item;
}

export interface UseRepeatableParams {
  model: FormModel;
  staticFieldMap: () => FieldMap;
}

export function useRepeatable(params: UseRepeatableParams) {
  const { model, staticFieldMap } = params;

  /** 每个 repeatable 容器的运行时缓存，key = arrayPath。 */
  const repeatableRuntimeMap = reactive<Record<string, RepeatableRuntime>>({});

  function getItemList(arrayPath: string): any[] {
    const list = getByPath(model, arrayPath);
    return Array.isArray(list) ? list : [];
  }

  /**
   * 重建某个数组容器的运行时缓存。
   *
   * 删除中间项会让后面的下标整体前移，所以这里按最新下标全量重建，
   * 用 O(数组长度) 换取“不会残留 contacts[2].phone 旧规则”的确定性。
   */
  function rebuildRepeatableRuntime(arrayField: FormField): void {
    const arrayPath = arrayField.path;
    if (!arrayPath) return;

    const list = getItemList(arrayPath);
    const itemFieldMap: FieldMap = {};
    const itemExpressionEffects: ExpressionEffect[] = [];
    const itemSideEffects: SideEffect[] = [];

    list.forEach((_item, index) => {
      const runtimeFields = buildRuntimeItemFields(arrayField.itemSchema ?? [], arrayPath, index);

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

  /** 添加数组项；新增项的表达式由调用方在增删后统一重算。 */
  function addArrayItem(arrayPath: string): void {
    const field = staticFieldMap()[arrayPath];
    if (!field?.itemSchema) return;

    const list = getItemList(arrayPath);
    list.push(createDefaultItem(field.itemSchema));
    setByPath(model, arrayPath, list);

    rebuildRepeatableRuntime(field);
  }

  /** 删除数组项，并重建整个容器的运行时 path / graph。 */
  function removeArrayItem(arrayPath: string, index: number): void {
    const field = staticFieldMap()[arrayPath];
    if (!field) return;

    const list = getItemList(arrayPath);
    if (index < 0 || index >= list.length) return;

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
