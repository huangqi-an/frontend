import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import FormRenderer from "../src/demo/renderer/FormRenderer.vue";
import { useFormEngine } from "../src/form-engine";

describe("FormRenderer", () => {
  it("renders a control and writes back through engine.setValue", async () => {
    const engine = useFormEngine({
      schema: [{ field: "name", component: "input", props: { label: "姓名" } }],
      initialModel: { name: "" },
    });

    const wrapper = mount(FormRenderer, { props: { engine } });

    expect(wrapper.text()).toContain("姓名");

    await wrapper.get("input").setValue("Ada");

    expect(engine.getValue("name")).toBe("Ada");
  });

  it("follows runtime props.visible and custom.options", async () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "userType",
          component: "select",
          custom: { options: [{ label: "管理员", value: "admin" }] },
        },
        {
          field: "dept",
          component: "select",
          props: { visible: false },
          expressions: { "props.visible": '$model.userType === "admin"' },
        },
      ],
      initialModel: { userType: "", dept: "" },
    });

    const wrapper = mount(FormRenderer, { props: { engine } });

    expect(wrapper.text()).toContain("管理员");
    expect(wrapper.findAll("select")).toHaveLength(1);

    engine.setValue("userType", "admin");
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll("select")).toHaveLength(2);
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

    const wrapper = mount(FormRenderer, { props: { engine } });

    expect(wrapper.findAll("input")).toHaveLength(0);

    await wrapper.get("button").trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(1);

    await wrapper.findAll("button")[1]!.trigger("click");
    expect(wrapper.findAll("input")).toHaveLength(0);
  });
});
