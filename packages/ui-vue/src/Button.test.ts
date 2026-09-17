import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Button from "./BaseButton.vue";

describe("Button", () => {
  it("renders its label and emits a click", async () => {
    const wrapper = mount(Button, {
      props: {
        label: "Run task",
      },
    });

    expect(wrapper.text()).toContain("Run task");

    await wrapper.trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("does not emit while disabled", async () => {
    const wrapper = mount(Button, {
      props: {
        disabled: true,
        label: "Run task",
      },
    });

    await wrapper.trigger("click");

    expect(wrapper.emitted("click")).toBeUndefined();
  });
});
