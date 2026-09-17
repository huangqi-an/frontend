<script setup lang="ts">
import { ref } from "vue";

import { Button } from "@frontend-lab/ui-vue";

const count = ref(0);
</script>

<template>
  <div class="demo-content">
    <p>Vue 组件使用 Composition API、类型化 props 和原生 CSS，并通过 workspace 直接引用本地包。</p>
    <div class="demo-actions">
      <Button label="点击计数" @click="count += 1" />
      <Button label="重置" tone="neutral" @click="count = 0" />
    </div>
    <output class="demo-output">当前次数：{{ count }}</output>
  </div>
</template>
