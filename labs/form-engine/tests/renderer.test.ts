import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";

import App from "../src/demo/App.vue";
import DemoForm from "../src/demo/DemoForm.vue";
import { createDemoFunctions, createDemoModel, createDemoSchema } from "../src/demo/schema";
import { useFormEngine } from "../src/form-engine";
import { FORM_CONTROLS_KEY, FormRenderer } from "../src/form-engine/renderer";
import type { ArrayScope, FieldScope, ObjectScope } from "../src/form-engine/renderer";

/** 测试用控件：只认默认约定的 modelValue / label / disabled。 */
const StubInput = defineComponent({
  name: "StubInput",
  props: ["modelValue", "label", "disabled"],
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        "data-label": props.label,
        disabled: props.disabled === true,
        value: props.modelValue === undefined ? "" : String(props.modelValue),
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
});

const registry = { input: StubInput };

describe("FormRenderer（headless 渲染层）", () => {
  it("resolves controls from the injected registry instead of importing them", async () => {
    const engine = useFormEngine({
      schema: [{ field: "name", component: "input", props: { label: "姓名" } }],
      initialModel: { name: "" },
    });

    const wrapper = mount(FormRenderer, {
      props: { engine },
      global: { provide: { [FORM_CONTROLS_KEY]: registry } },
    });

    expect(wrapper.get("input").attributes("data-label")).toBe("姓名");

    await wrapper.get("input").setValue("Ada");

    expect(engine.getValue("name")).toBe("Ada");
  });

  it("falls back to the missing slot when a component is not registered", () => {
    const engine = useFormEngine({
      schema: [{ field: "signature", component: "signature-pad", props: { label: "签名" } }],
    });

    // 没有注入任何注册表。
    const wrapper = mount(FormRenderer, { props: { engine } });

    expect(wrapper.text()).toContain("未注册的组件：signature-pad");
  });

  it("hands control of markup to the field slot", async () => {
    const engine = useFormEngine({
      schema: [{ field: "name", component: "input", props: { label: "姓名" } }],
      initialModel: { name: "" },
    });

    const wrapper = mount(FormRenderer, {
      props: { engine },
      global: { provide: { [FORM_CONTROLS_KEY]: registry } },
      slots: {
        field: (scope: FieldScope) =>
          h("section", { class: "my-field" }, [
            h("span", { class: "my-label" }, scope.label),
            scope.control ? h(scope.control, { ...scope.controlProps }) : null,
          ]),
      },
    });

    expect(wrapper.find("section.my-field").exists()).toBe(true);
    expect(wrapper.get("span.my-label").text()).toBe("姓名");

    await wrapper.get("input").setValue("Ada");

    expect(engine.getValue("name")).toBe("Ada");
  });

  it("hands add/remove and recursion of array items to the array slot", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          itemSchema: [{ field: "name", component: "input", props: { label: "姓名" } }],
        },
      ],
      initialModel: { contacts: [] },
    });

    const wrapper = mount(FormRenderer, {
      props: { engine },
      global: { provide: { [FORM_CONTROLS_KEY]: registry } },
      slots: {
        array: (scope: ArrayScope) =>
          h("div", { class: "my-array" }, [
            h("button", { class: "add", onClick: () => scope.append() }, "add"),
            ...scope.items.map((item) =>
              h("div", { class: "row", key: item.key }, [
                h(FormRenderer, {
                  engine,
                  fields: scope.itemSchema,
                  parentPath: item.path,
                }),
                h("button", { class: "remove", onClick: () => scope.remove(item.index) }, "remove"),
              ]),
            ),
          ]),
      },
    });

    expect(wrapper.findAll("input")).toHaveLength(0);

    await wrapper.get("button.add").trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(1);

    await wrapper.get(".remove").trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(0);
  });

  it("hands recursion of object groups to the object slot", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contact",
          props: { label: "联系方式" },
          children: [
            { field: "phone", component: "input", props: { label: "手机号" } },
            {
              field: "address",
              props: { label: "地址" },
              children: [{ field: "city", component: "input", props: { label: "城市" } }],
            },
          ],
        },
      ],
    });

    // 插槽只作用于当前层；递归时要把同一套插槽再传下去。
    const slots = {
      object: (scope: ObjectScope): unknown =>
        h("fieldset", { class: "my-group" }, [
          h("legend", scope.label),
          h(FormRenderer, { engine, fields: scope.children, parentPath: scope.path }, slots),
        ]),
    };

    const wrapper = mount(FormRenderer, {
      props: { engine },
      global: { provide: { [FORM_CONTROLS_KEY]: registry } },
      slots,
    });

    expect(wrapper.findAll("fieldset.my-group")).toHaveLength(2);
    expect(wrapper.text()).toContain("地址");

    await wrapper.get("input").setValue("138");

    expect(engine.getValue("contact.phone")).toBe("138");
  });

  it("skips fields whose runtime props.visible is false", () => {
    const engine = useFormEngine({
      schema: [
        { field: "userType", component: "input" },
        {
          field: "dept",
          component: "input",
          props: { visible: false },
          expressions: { "props.visible": '$model.userType === "admin"' },
        },
      ],
      initialModel: { userType: "", dept: "" },
    });

    const wrapper = mount(FormRenderer, {
      props: { engine },
      global: { provide: { [FORM_CONTROLS_KEY]: registry } },
    });

    expect(wrapper.findAll("input")).toHaveLength(1);

    engine.setValue("userType", "admin");

    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.findAll("input")).toHaveLength(2);
    });
  });
});

describe("DemoForm（业务侧用插槽接管布局）", () => {
  it("renders nested object groups and writes through nested paths", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contact",
          props: { label: "联系方式" },
          children: [
            { field: "phone", component: "input", props: { label: "手机号" } },
            {
              field: "address",
              props: { label: "地址" },
              children: [{ field: "city", component: "input", props: { label: "城市" } }],
            },
          ],
        },
      ],
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    expect(wrapper.text()).toContain("联系方式");
    expect(wrapper.text()).toContain("城市");

    await wrapper.get("input").setValue("138");

    expect(engine.getValue("contact.phone")).toBe("138");
  });

  it("reflects runtime disabled, required and custom.hint", () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "owner",
          component: "select",
          props: { disabled: false, visible: true },
          custom: { options: [], hint: "" },
          rules: [{ required: false }],
          expressions: {
            "props.disabled": "true",
            "rules[0].required": "true",
            "custom.hint": '"管理员必填"',
          },
        },
      ],
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    expect(wrapper.get("select").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("*");
    expect(wrapper.text()).toContain("管理员必填");
  });

  it("renders textarea controls and nested fields inside array items", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          props: { label: "联系人" },
          itemSchema: [
            { field: "name", component: "input", props: { label: "姓名" } },
            {
              field: "meta",
              props: { label: "其他信息" },
              children: [
                { field: "note", component: "textarea", props: { label: "备注", rows: 2 } },
              ],
            },
          ],
        },
      ],
      initialModel: { contacts: [] },
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    await wrapper.get("button").trigger("click");

    expect(wrapper.find("textarea").exists()).toBe(true);

    await wrapper.get("textarea").setValue("主联系人");

    expect(engine.getValue("contacts[0].meta.note")).toBe("主联系人");
  });

  it("appends and removes repeatable items", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          props: { label: "联系人" },
          itemSchema: [{ field: "name", component: "input", props: { label: "姓名" } }],
        },
      ],
      initialModel: { contacts: [] },
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    expect(wrapper.findAll("input")).toHaveLength(0);

    await wrapper.get("button").trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(1);

    await wrapper.findAll("button")[1]!.trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(0);
  });

  it("shows the demo fallback for unregistered components", () => {
    const engine = useFormEngine({
      schema: [{ field: "signature", component: "signature-pad", props: { label: "签名" } }],
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    expect(wrapper.text()).toContain("未注册的组件：signature-pad");
  });

  it("renders the demo schema without runtime errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const engine = useFormEngine({
      schema: createDemoSchema(),
      initialModel: createDemoModel(),
      functions: createDemoFunctions(),
    });

    const wrapper = mount(DemoForm, { props: { engine } });

    expect(error).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("联系方式");
    expect(wrapper.text()).toContain("紧急联系人");

    error.mockRestore();
  });

  it("keeps the demo source schema intact while the runtime copy changes", async () => {
    const wrapper = mount(App);

    // 初始化后：运行时副本已经算出 visible / disabled / options，源 schema 仍是原值。
    expect(wrapper.text()).toContain("✓ 与启动快照一致");
    expect(wrapper.text()).toContain("props.disabled: false → true");
    expect(wrapper.text()).toContain("props.visible: true → false");
    // 数组按下标报差异，新增项显示为 undefined → 新值。
    expect(wrapper.text()).toContain(
      'custom.options[0]: undefined → {"label":"访客组","value":"guest"}',
    );

    // 真实联动一轮：面板必须跟着重算，而不是停在初始快照上。
    await wrapper.get("select").setValue("admin");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('props.placeholder: "请选择部门" → "请选择所属部门"');
    expect(wrapper.text()).toContain("✓ 与启动快照一致");
    expect(wrapper.text()).not.toContain("✗ 源 schema 已被修改");

    await wrapper.get("input").setValue("Ada");
    await wrapper.vm.$nextTick();

    // name 有值后 disabled 表达式结果变回 false，与源值相同，差异项随之消失。
    expect(wrapper.text()).not.toContain("props.disabled: false → true");
    expect(wrapper.text()).toContain("✓ 与启动快照一致");
  });
});
