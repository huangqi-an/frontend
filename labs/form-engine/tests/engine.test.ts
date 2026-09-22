import { describe, expect, it, vi } from "vitest";

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

  it("supports nested object fields and cross-level dependencies", () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contact",
          props: { label: "联系方式" },
          children: [
            {
              field: "phone",
              component: "input",
              props: { label: "手机号" },
              custom: { hint: "" },
              expressions: { "custom.hint": '$self.props.label + "用于接收通知"' },
            },
            {
              field: "address",
              props: { label: "地址" },
              children: [
                {
                  field: "city",
                  component: "input",
                  props: { disabled: false },
                  expressions: { "props.disabled": "!$model.contact.phone" },
                },
              ],
            },
          ],
        },
      ],
      initialModel: { contact: { phone: "" } },
    });

    expect(Object.keys(engine.runtimeFieldMap.value)).toEqual(
      expect.arrayContaining([
        "contact",
        "contact.phone",
        "contact.address",
        "contact.address.city",
      ]),
    );

    // $self 在初始化时就能读到当前字段自己的 schema 属性。
    expect(engine.runtimeFieldMap.value["contact.phone"]?.custom?.hint).toBe("手机号用于接收通知");
    expect(engine.runtimeFieldMap.value["contact.address.city"]?.props?.disabled).toBe(true);

    engine.setValue("contact.phone", "138");

    expect(engine.runtimeFieldMap.value["contact.address.city"]?.props?.disabled).toBe(false);

    // 嵌套路径按需创建容器。
    engine.setValue("contact.address.city", "杭州");
    expect(engine.getValue("contact.address.city")).toBe("杭州");
  });

  it("can target rules entries other than the first", () => {
    const engine = useFormEngine({
      schema: [
        { field: "flag", component: "select" },
        {
          field: "dept",
          component: "select",
          rules: [
            { required: false, message: "请选择部门" },
            { required: false, message: "管理员必须选择部门" },
          ],
          expressions: { "rules[1].required": '$model.flag === "yes"' },
        },
      ],
      initialModel: { flag: "", dept: "" },
    });

    expect(engine.runtimeFieldMap.value.dept?.rules?.[1]?.required).toBe(false);

    engine.setValue("flag", "yes");

    expect(engine.runtimeFieldMap.value.dept?.rules?.[1]?.required).toBe(true);
    expect(engine.runtimeFieldMap.value.dept?.rules?.[0]?.required).toBe(false);
  });

  it("clears a relative target inside a repeatable item", () => {
    const engine = useFormEngine({
      schema: [
        {
          field: "contacts",
          repeatable: true,
          itemSchema: [
            {
              field: "phone",
              component: "input",
              effects: [{ type: "clear", when: "!$item.phone", targets: ["email"] }],
            },
            { field: "email", component: "input" },
          ],
        },
      ],
      initialModel: { contacts: [] },
    });

    engine.append("contacts");
    engine.append("contacts");

    engine.setValue("contacts[0].phone", "138");
    engine.setValue("contacts[0].email", "tom@example.com");
    engine.setValue("contacts[1].email", "amy@example.com");

    // when 不成立时不清空。
    expect(engine.getValue("contacts[0].email")).toBe("tom@example.com");

    engine.setValue("contacts[0].phone", "");

    expect(engine.getValue("contacts[0].email")).toBeUndefined();
    expect(engine.getValue("contacts[1].email")).toBe("amy@example.com");

    // 删除首项后相对 target 会随新下标重建。
    engine.remove("contacts", 0);
    expect(engine.getValue("contacts[0].email")).toBe("amy@example.com");

    engine.setValue("contacts[0].phone", "");
    expect(engine.getValue("contacts[0].email")).toBeUndefined();
  });

  it("keeps multiple repeatable containers independent", () => {
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
        {
          field: "attachments",
          repeatable: true,
          itemSchema: [{ field: "title", component: "input" }],
        },
      ],
      initialModel: { contacts: [], attachments: [] },
    });

    engine.append("contacts");
    engine.append("attachments");

    expect(Object.keys(engine.runtimeFieldMap.value)).toEqual(
      expect.arrayContaining(["contacts[0].name", "attachments[0].title"]),
    );

    engine.setValue("contacts[0].name", "Tom");
    expect(engine.runtimeFieldMap.value["contacts[0].phone"]?.props?.disabled).toBe(false);

    engine.remove("contacts", 0);

    expect(engine.runtimeFieldMap.value["contacts[0].phone"]).toBeUndefined();
    expect(engine.runtimeFieldMap.value["attachments[0].title"]).toBeDefined();
  });

  it("keeps other fields working when an expression throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const engine = useFormEngine({
      schema: [
        {
          field: "broken",
          component: "input",
          props: { visible: true },
          expressions: { "props.visible": "(" },
        },
        { field: "stable", component: "input", props: { visible: true } },
      ],
    });

    expect(error).toHaveBeenCalled();
    expect(engine.runtimeFieldMap.value.broken?.props?.visible).toBeUndefined();
    expect(engine.runtimeFieldMap.value.stable?.props?.visible).toBe(true);

    error.mockRestore();
  });

  it("stops runaway cascades at maxSteps", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const engine = useFormEngine({
      maxSteps: 6,
      schema: [
        { field: "a", component: "input", effects: [{ type: "clear", targets: ["b"] }] },
        { field: "b", component: "input", effects: [{ type: "clear", targets: ["a"] }] },
      ],
      initialModel: { a: "", b: "" },
    });

    engine.setValue("a", "A");

    expect(warn).toHaveBeenCalled();
    expect(engine.getValue("a")).toBeUndefined();
    expect(engine.getValue("b")).toBeUndefined();

    warn.mockRestore();
  });

  it("keeps the caller's schema untouched across a full lifecycle", () => {
    const schema: FormField[] = [
      { field: "name", component: "input", props: { placeholder: "姓名", visible: true } },
      {
        field: "userType",
        component: "select",
        custom: { options: [{ label: "管理员", value: "admin" }] },
        effects: [{ type: "clear", targets: ["dept"] }],
      },
      {
        field: "dept",
        component: "select",
        props: { disabled: false, visible: true },
        custom: { options: [], hint: "" },
        rules: [{ required: false, message: "请选择部门" }],
        expressions: {
          "props.visible": '$model.userType === "admin"',
          "props.disabled": "!$model.name",
          "rules[0].required": '$model.userType === "admin"',
          "custom.options": "$functions.getDeptOptions()",
          "custom.hint": '"来自表达式"',
        },
      },
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
    ];
    const snapshot = JSON.stringify(schema);

    const engine = useFormEngine({
      schema,
      initialModel: { name: "", userType: "", dept: "", contacts: [] },
      functions: { getDeptOptions: () => [{ label: "技术部", value: "tech" }] },
    });

    engine.setValue("userType", "admin");
    engine.setValue("name", "Ada");
    engine.append("contacts");
    engine.setValue("contacts[0].name", "Tom");
    engine.remove("contacts", 0);

    // 源 schema 跑完整个生命周期后一字未改。
    expect(JSON.stringify(schema)).toBe(snapshot);
    expect(schema[2]?.props).toEqual({ disabled: false, visible: true });
    expect(schema[2]?.rules).toEqual([{ required: false, message: "请选择部门" }]);
    expect(schema[2]?.custom).toEqual({ options: [], hint: "" });
    expect(schema[3]?.itemSchema?.[1]?.props).toEqual({ disabled: false });

    // 运行时字段是副本，和源 schema 不是同一个对象。
    expect(engine.runtimeFieldMap.value.dept).not.toBe(schema[2]);
    expect(engine.runtimeFieldMap.value.dept?.props).not.toBe(schema[2]?.props);

    // 对照：运行时副本确实被表达式改过，证明上面不是因为“什么都没发生”。
    expect(engine.runtimeFieldMap.value.dept?.props?.visible).toBe(true);
    expect(engine.runtimeFieldMap.value.dept?.props?.disabled).toBe(false);
    expect(engine.runtimeFieldMap.value.dept?.custom?.hint).toBe("来自表达式");
    expect(engine.runtimeFieldMap.value.dept?.custom?.options).toEqual([
      { label: "技术部", value: "tech" },
    ]);
  });
});
