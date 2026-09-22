import { describe, expect, it } from "vitest";

import { useFormEngine } from "../src/form-engine";
import type { FormField, FormEngineOptions } from "../src/form-engine";

function createLinkageOptions(): FormEngineOptions {
  const schema: FormField[] = [
    {
      field: "name",
      component: "input",
      props: { label: "姓名", visible: true },
    },
    {
      field: "userType",
      component: "select",
      props: { visible: true },
      effects: [{ type: "clear", targets: ["dept"] }],
    },
    {
      field: "dept",
      component: "select",
      props: { disabled: false, visible: true },
      custom: { options: [] },
      rules: [{ required: false, message: "请选择部门" }],
      expressions: {
        "props.visible": '$model.userType === "admin"',
        "props.disabled": "!$model.name",
        "rules[0].required": '$model.userType === "admin"',
        "custom.options": "$functions.getDeptOptions($model.userType)",
      },
    },
  ];

  return {
    schema,
    initialModel: { name: "", userType: "", dept: "default" },
    functions: {
      getDeptOptions: (userType: unknown) =>
        userType === "admin"
          ? [{ label: "技术部", value: "tech" }]
          : [{ label: "访客组", value: "guest" }],
    },
  };
}

describe("useFormEngine", () => {
  it("writes expression results into runtime fields without touching the source schema", () => {
    const options = createLinkageOptions();
    const engine = useFormEngine(options);
    const sourceDept = options.schema[2]!;

    // 源 schema 保持调用方写入的样子。
    expect(sourceDept.props?.visible).toBe(true);
    expect(sourceDept.props?.disabled).toBe(false);
    expect(sourceDept.rules?.[0]?.required).toBe(false);

    // 运行时字段已经被表达式更新。
    expect(engine.runtimeFieldMap.value.dept?.props?.visible).toBe(false);
    expect(engine.runtimeFieldMap.value.dept?.props?.disabled).toBe(true);
    expect(engine.runtimeFieldMap.value.dept?.custom?.options).toEqual([
      { label: "访客组", value: "guest" },
    ]);

    engine.setValue("userType", "admin");

    expect(engine.runtimeFieldMap.value.dept?.props?.visible).toBe(true);
    expect(engine.runtimeFieldMap.value.dept?.rules?.[0]?.required).toBe(true);
    expect(engine.getValue("dept")).toBeUndefined();

    engine.setValue("name", "Ada");

    expect(engine.runtimeFieldMap.value.dept?.props?.disabled).toBe(false);
  });

  it("cascades clear effects to a fixed point", () => {
    const engine = useFormEngine({
      schema: [
        { field: "a", component: "input", effects: [{ type: "clear", targets: ["b"] }] },
        { field: "b", component: "input", effects: [{ type: "clear", targets: ["c"] }] },
        { field: "c", component: "input" },
      ],
      initialModel: { a: "", b: "B", c: "C" },
    });

    // 初始化只跑表达式，不跑副作用：调用方传入的初始值不会被清掉。
    expect(engine.getValue("b")).toBe("B");
    expect(engine.getValue("c")).toBe("C");

    engine.setValue("a", "A");

    expect(engine.getValue("b")).toBeUndefined();
    expect(engine.getValue("c")).toBeUndefined();
  });

  it("respects effect.when conditions", () => {
    const engine = useFormEngine({
      schema: [
        { field: "type", component: "select" },
        {
          field: "dept",
          component: "select",
          effects: [{ type: "clear", when: '$model.type === "normal"', targets: ["owner"] }],
        },
        { field: "owner", component: "input" },
      ],
      initialModel: { type: "", dept: "", owner: "Ada" },
    });

    engine.setValue("dept", "tech");
    expect(engine.getValue("owner")).toBe("Ada");

    engine.setValue("type", "normal");
    engine.setValue("dept", "tech");
    expect(engine.getValue("owner")).toBeUndefined();
  });

  it("expands repeatable items and rebuilds paths after remove", () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          itemSchema: [
            { field: "name", component: "input" },
            {
              field: "phone",
              component: "input",
              props: { disabled: false },
              expressions: { "props.disabled": "!$item.name" },
            },
          ],
        },
      ],
      initialModel: { contacts: [] },
    });

    engine.append("contacts");
    engine.append("contacts");

    expect(Object.keys(engine.runtimeFieldMap.value)).toEqual(
      expect.arrayContaining([
        "contacts",
        "contacts[0].name",
        "contacts[0].phone",
        "contacts[1].name",
        "contacts[1].phone",
      ]),
    );

    // 同一行的 $item 表达式只影响自己那一项。
    expect(engine.runtimeFieldMap.value["contacts[0].phone"]?.props?.disabled).toBe(true);
    engine.setValue("contacts[0].name", "Tom");
    expect(engine.runtimeFieldMap.value["contacts[0].phone"]?.props?.disabled).toBe(false);
    expect(engine.runtimeFieldMap.value["contacts[1].phone"]?.props?.disabled).toBe(true);

    engine.setValue("contacts[0].phone", "138");
    engine.remove("contacts", 0);

    // 下标前移后，运行时字段按新下标重建。
    expect(engine.getValue("contacts[0].name")).toBeUndefined();
    expect(engine.getValue("contacts[0].phone")).toBeUndefined();
    expect(engine.runtimeFieldMap.value["contacts[0].phone"]?.props?.disabled).toBe(true);
    expect(Object.keys(engine.runtimeFieldMap.value)).not.toContain("contacts[1].name");

    // 业务 model 里不写 _id 之类的运行时字段。
    expect(Object.keys(engine.model)).toEqual(["contacts"]);
    expect(JSON.stringify(engine.model)).not.toContain("_id");
  });

  it("initializes missing repeatable containers as empty arrays", () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          itemSchema: [{ field: "name", component: "input" }],
        },
      ],
    });

    expect(engine.getValue("contacts")).toEqual([]);
  });

  it("rejects nested repeatable schema", () => {
    expect(() =>
      useFormEngine({
        schema: [
          {
            field: "outer",
            repeatable: true,
            itemSchema: [{ field: "inner", repeatable: true, itemSchema: [{ field: "name" }] }],
          },
        ],
      }),
    ).toThrow(/Nested repeatable/);
  });
});
