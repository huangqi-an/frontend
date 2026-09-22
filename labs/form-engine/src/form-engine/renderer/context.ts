import { inject, provide, type InjectionKey } from "vue";

import type { ControlRegistry } from "./types";

/**
 * 控件注册表的注入 key。
 *
 * 应用级注册可以直接 `app.provide(FORM_CONTROLS_KEY, registry)`。
 */
export const FORM_CONTROLS_KEY: InjectionKey<ControlRegistry> = Symbol("form-engine:controls");

/** 在组件 setup 里注册控件；渲染层只通过注入拿控件，不 import 任何具体实现。 */
export function provideFormControls(registry: ControlRegistry): ControlRegistry {
  provide(FORM_CONTROLS_KEY, registry);
  return registry;
}

/** 读取注入的控件注册表；没注入时返回空表，未注册的字段会走 missing 插槽。 */
export function useFormControls(): ControlRegistry {
  return inject(FORM_CONTROLS_KEY, {});
}
