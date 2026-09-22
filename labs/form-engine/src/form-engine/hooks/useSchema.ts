import { computed, reactive, shallowRef } from "vue";

import type { FieldMap, FormField } from "../types";
import { deepClone } from "../utils/clone";
import { joinPath } from "../utils/path";

/** v1 不支持嵌套 repeatable：在编译阶段直接报错，避免出现难排查的隐式行为。 */
function assertSchemaSupported(fields: FormField[], insideRepeatable = false): void {
  fields.forEach((field) => {
    const name = field.field ?? "(anonymous)";

    if (field.repeatable) {
      if (insideRepeatable) {
        throw new Error(`[FormEngine] Nested repeatable field "${name}" is not supported.`);
      }

      assertSchemaSupported(field.itemSchema ?? [], true);
    }

    if (field.children?.length) {
      assertSchemaSupported(field.children, insideRepeatable);
    }
  });
}

/**
 * 生成静态字段路径。
 *
 * 普通字段和对象嵌套字段在这里得到 path；repeatable 的 itemSchema 留到运行时按下标展开。
 * 运行时字段用 reactive 包一层，表达式写回 props/rules/custom 之后渲染层才会更新。
 */
function buildStaticFields(fields: FormField[], parentPath = ""): FormField[] {
  return fields.map((field) => {
    const currentPath = joinPath(parentPath, field.field);
    const nextField = reactive<FormField>({ ...deepClone(field), path: currentPath });

    if (field.children?.length) {
      nextField.children = buildStaticFields(field.children, currentPath);
    }

    return nextField;
  });
}

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

function collectRepeatableFields(fields: FormField[], result: FormField[]): void {
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
  assertSchemaSupported(inputSchema);

  /** 静态 schema：path 已初始化。 */
  const staticSchemaRef = shallowRef<FormField[]>(buildStaticFields(inputSchema));

  const staticFieldMap = computed<FieldMap>(() => {
    const map: FieldMap = {};
    collectFieldMap(staticSchemaRef.value, map);
    return map;
  });

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
