<script setup lang="ts">
import { computed } from "vue";

import { useFormEngine } from "../form-engine";
import FormRenderer from "./renderer/FormRenderer.vue";
import { createDemoFunctions, createDemoModel, createDemoSchema } from "./schema";

/** 保留一份源 schema 的引用，用来验证引擎没有污染业务侧定义。 */
const sourceSchema = createDemoSchema();

const engine = useFormEngine({
  schema: sourceSchema,
  initialModel: createDemoModel(),
  functions: createDemoFunctions(),
});

const modelJson = computed(() => JSON.stringify(engine.model, null, 2));

const deptRuntimeJson = computed(() => {
  const field = engine.runtimeFieldMap.value.dept;
  return JSON.stringify({ props: field?.props, rules: field?.rules }, null, 2);
});

const deptSourceJson = computed(() => {
  const field = sourceSchema.find((item) => item.field === "dept");
  return JSON.stringify({ props: field?.props, rules: field?.rules }, null, 2);
});

const itemPaths = computed(() =>
  Object.keys(engine.runtimeFieldMap.value).filter((path) => path.includes("[")),
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
      </p>

      <FormRenderer :engine="engine" />
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
        <h2>源 schema 里的 dept（不应被改动）</h2>
        <pre>{{ deptSourceJson }}</pre>
      </section>

      <section>
        <h2>数组项运行时路径</h2>
        <pre>{{ itemPaths.join("\n") || "(空)" }}</pre>
      </section>
    </aside>
  </main>
</template>
