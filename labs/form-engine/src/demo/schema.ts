import type { FormField, FunctionRegistry } from "../form-engine";

/**
 * demo schema：覆盖普通字段、对象结构、表达式联动、副作用和 repeatable。
 *
 * 注意这里没有“状态”字段，visible / disabled / required / options 全部由表达式算出。
 */
export function createDemoSchema(): FormField[] {
  return [
    {
      field: "name",
      component: "input",
      props: { label: "姓名", placeholder: "请输入姓名", visible: true },
    },
    {
      field: "userType",
      component: "select",
      props: { label: "用户类型", placeholder: "请选择用户类型", visible: true },
      custom: {
        options: [
          { label: "普通用户", value: "normal" },
          { label: "管理员", value: "admin" },
        ],
      },
      // 用户类型一变，之前选的部门就不再有意义，直接清空。
      effects: [{ type: "clear", targets: ["dept"] }],
    },
    {
      field: "dept",
      component: "select",
      props: { label: "部门", placeholder: "请选择部门", disabled: false, visible: true },
      custom: { options: [] },
      rules: [{ required: false, message: "请选择部门" }],
      expressions: {
        "props.visible": '$model.userType === "admin"',
        "props.disabled": "!$model.name",
        "rules[0].required": '$model.userType === "admin"',
        "custom.options": "$functions.getDeptOptions($model.userType)",
      },
    },
    {
      field: "emergencyContacts",
      repeatable: true,
      props: { label: "紧急联系人" },
      itemSchema: [
        {
          field: "name",
          component: "input",
          props: { label: "联系人姓名", placeholder: "请输入姓名" },
        },
        {
          field: "phone",
          component: "input",
          props: { label: "联系人手机", placeholder: "请先填写姓名", disabled: false },
          // 数组项内的表达式用 $item，读的是同一行的数据。
          expressions: { "props.disabled": "!$item.name" },
        },
        {
          field: "email",
          component: "input",
          props: { label: "联系人邮箱", placeholder: "请输入邮箱" },
        },
      ],
    },
  ];
}

export function createDemoFunctions(): FunctionRegistry {
  return {
    getDeptOptions(userType: unknown) {
      if (userType === "admin") {
        return [
          { label: "技术部", value: "tech" },
          { label: "产品部", value: "product" },
        ];
      }

      return [{ label: "访客组", value: "guest" }];
    },
  };
}

export function createDemoModel(): Record<string, any> {
  return {
    name: "",
    userType: "",
    dept: "",
    emergencyContacts: [],
  };
}
