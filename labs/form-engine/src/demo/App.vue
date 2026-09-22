<script setup lang="ts">
import { computed } from "vue";

import { useFormEngine } from "../form-engine";
import DemoForm from "./DemoForm.vue";
import { diffPaths } from "./diff";
import { createDemoFunctions, createDemoModel, createDemoSchema } from "./schema";

/**
 * 保留一份源 schema 的引用，用来验证引擎没有污染业务侧定义。
 *
 * 引擎初始化时会 deepClone 出运行时字段，表达式只写运行时副本，
 * 所以这里理论上始终和启动快照一致；一旦被打破，下面的面板会立刻变红。
 */
const sourceSchema = createDemoSchema();
const sourceSnapshot = JSON.stringify(sourceSchema);

const engine = useFormEngine({
  schema: sourceSchema,
  initialModel: createDemoModel(),
  functions: createDemoFunctions(),
});

const modelJson = computed(() => JSON.stringify(engine.model, null, 2));

function findDeptSourceField() {
  return sourceSchema.find((item) => item.field === "dept");
}

/**
 * 读取 model 是为了建立响应式依赖：每次 setValue / append / remove 后都会重算。
 *
 * 这样它不是“算完就不动的快照”，而是每次联动后重新比对源 schema。
 */
function touchModel(): void {
  JSON.stringify(engine.model);
}

const sourceIntact = computed(() => {
  touchModel();
  return JSON.stringify(sourceSchema) === sourceSnapshot;
});

const deptRuntimeJson = computed(() => {
  const field = engine.runtimeFieldMap.value.dept;
  return JSON.stringify({ props: field?.props, rules: field?.rules }, null, 2);
});

const deptSourceJson = computed(() => {
  touchModel();
  const field = findDeptSourceField();
  return JSON.stringify({ props: field?.props, rules: field?.rules }, null, 2);
});

/** 表达式实际改写到运行时副本的路径；源 schema 那侧永远不会出现这些差异。 */
const deptChangedPaths = computed(() => {
  const source = findDeptSourceField();
  const runtime = engine.runtimeFieldMap.value.dept;

  return [
    ...diffPaths(source?.props, runtime?.props, "props"),
    ...diffPaths(source?.rules, runtime?.rules, "rules"),
    ...diffPaths(source?.custom, runtime?.custom, "custom"),
  ];
});

const itemPaths = computed(() =>
  Object.keys(engine.runtimeFieldMap.value).filter((path) => path.includes("[")),
);

/** 依赖索引：model 路径 -> 会被它触发的表达式。 */
const dependencyJson = computed(() =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(engine.runtimeDependencyGraph.value).map(([path, effects]) => [
        path,
        effects.map((effect) => `${effect.fieldPath}.${effect.targetPath}`),
      ]),
    ),
    null,
    2,
  ),
);

/** 副作用索引：源路径 -> 会被清空的目标路径。 */
const sideEffectJson = computed(() =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(engine.runtimeSideEffectGraph.value).map(([path, effects]) => [
        path,
        effects.flatMap((effect) => effect.targets),
      ]),
    ),
    null,
    2,
  ),
);
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">labs / form-engine</p>
      <h1>动态表单引擎</h1>
      <p class="intro">
        改「用户类型」「姓名」和联系人数组，观察运行时字段、model 与副作用清空的结果。
        业务侧统一调用 <code>engine.setValue</code>，直接写 <code>engine.model</code> 不会触发联动。
        表达式只写引擎自己 deepClone 出来的运行时字段，源 schema 全程只读，右侧面板会实时比对两者。
      </p>

      <DemoForm :engine="engine" />
    </section>

    <aside class="debug">
      <section>
        <h2>model</h2>
        <pre>{{ modelJson }}</pre>
      </section>

      <section>
        <h2>dept 运行时字段</h2>
        <pre>{{ deptRuntimeJson }}</pre>
      </section>

      <section>
        <h2>源 schema 里的 dept（只读）</h2>
        <p class="debug-status" :class="sourceIntact ? 'is-ok' : 'is-bad'">
          {{ sourceIntact ? "✓ 与启动快照一致" : "✗ 源 schema 已被修改" }}
        </p>
        <pre>{{ deptSourceJson }}</pre>
      </section>

      <section>
        <h2>表达式改写运行时字段的路径</h2>
        <p v-if="deptChangedPaths.length === 0" class="fe-empty">当前没有差异</p>
        <pre v-else>{{ deptChangedPaths.join("\n") }}</pre>
      </section>

      <section>
        <h2>数组项运行时路径</h2>
        <pre>{{ itemPaths.join("\n") || "(空)" }}</pre>
      </section>

      <section>
        <h2>依赖索引（model 路径 → 表达式）</h2>
        <pre>{{ dependencyJson }}</pre>
      </section>

      <section>
        <h2>副作用索引（源路径 → 清空目标）</h2>
        <pre>{{ sideEffectJson }}</pre>
      </section>
    </aside>
  </main>
</template>
