<script setup lang="ts">
import type { FormEngine, FormField } from "../form-engine";
import { FormRenderer, provideFormControls } from "../form-engine/renderer";
import InputControl from "./controls/InputControl.vue";
import SelectControl from "./controls/SelectControl.vue";
import TextareaControl from "./controls/TextareaControl.vue";

/**
 * 控件通过依赖注入登记：渲染层不认识 input / select / textarea，
 * 只按 schema 里的 component 字符串去注册表里取。
 */
const controls = {
  input: InputControl,
  select: SelectControl,
  textarea: TextareaControl,
};

provideFormControls(controls);

defineProps<{
  engine: FormEngine;
  /** 不传时渲染 engine.schema；递归渲染子层时传入 children / itemSchema。 */
  fields?: FormField[] | undefined;
  /** 递归渲染数组项时传入的父路径，例如 contacts[0]。 */
  parentPath?: string | undefined;
}>();
</script>

<template>
  <!--
    布局全部由业务侧插槽决定：结构、文案、类名、递归方式都在这里，
    FormRenderer 只负责路径、显隐、增删和写值。

    插槽只在当前层生效，所以递归时用的是本组件自己（DemoForm），
    这样每一层都会带上同一套插槽。
  -->
  <FormRenderer :engine="engine" :fields="fields" :parent-path="parentPath">
    <template #field="scope">
      <div class="fe-field">
        <component :is="scope.control" v-if="scope.control" v-bind="scope.controlProps" />
        <p v-else class="fe-error">未注册的组件：{{ scope.field.component }}</p>
      </div>
    </template>

    <template #object="scope">
      <fieldset class="fe-object-group">
        <legend class="fe-group-title">{{ scope.label }}</legend>
        <DemoForm :engine="engine" :fields="scope.children" :parent-path="scope.path" />
      </fieldset>
    </template>

    <template #array="scope">
      <div class="fe-array">
        <div class="fe-array-header">
          <span class="fe-label">{{ scope.label }}</span>
          <button type="button" @click="scope.append()">新增</button>
        </div>

        <p v-if="scope.items.length === 0" class="fe-empty">暂无数据</p>

        <div v-for="item in scope.items" :key="item.key" class="fe-array-item">
          <DemoForm :engine="engine" :fields="scope.itemSchema" :parent-path="item.path" />
          <button type="button" class="fe-remove" @click="scope.remove(item.index)">删除</button>
        </div>
      </div>
    </template>
  </FormRenderer>
</template>
