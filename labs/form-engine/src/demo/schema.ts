import type { FormField, FunctionRegistry } from "../form-engine";

/**
 * demo schema。
 *
 * 覆盖到的字段能力：
 * - 叶子字段：input / select / textarea；
 * - 对象嵌套：contact.address.city 这类两级路径；
 * - 表达式：$model / $item / $index / $self / $functions，目标覆盖
 *   props.*、rules[0].*、custom.options、custom.hint；
 * - 副作用：静态字段 clear，以及数组项内的相对 target + when；
 * - repeatable：叶子字段和嵌套对象字段。
 *
 * 注意这里没有“状态”字段，visible / disabled / required / options / hint 全部由表达式算出。
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
      custom: { options: [], hint: "" },
      rules: [{ required: false, message: "请选择部门" }],
      expressions: {
        "props.visible": '$model.userType === "admin"',
        "props.disabled": "!$model.name",
        "props.placeholder": '$model.userType === "admin" ? "请选择所属部门" : "请选择部门"',
        "rules[0].required": '$model.userType === "admin"',
        "rules[0].message": '$model.userType === "admin" ? "管理员必须选择部门" : "请选择部门"',
        "custom.options": "$functions.getDeptOptions($model.userType)",
        "custom.hint": '$model.userType === "normal" ? "普通用户只能加入访客组" : ""',
      },
    },
    {
      field: "contact",
      props: { label: "联系方式" },
      children: [
        {
          field: "phone",
          component: "input",
          props: { label: "手机号", placeholder: "请输入手机号" },
          custom: { hint: "" },
          // $self 指向当前运行时字段，可以复用 schema 里已经写好的 label。
          expressions: { "custom.hint": '$self.props.label + "用于接收面试通知"' },
        },
        {
          field: "address",
          props: { label: "地址" },
          children: [
            {
              field: "city",
              component: "input",
              props: { label: "城市", placeholder: "请先填写手机号", disabled: false },
              // 依赖另一个嵌套路径，验证跨层级路径匹配。
              expressions: { "props.disabled": "!$model.contact.phone" },
            },
            {
              field: "detail",
              component: "textarea",
              props: { label: "详细地址", placeholder: "街道、门牌号", rows: 2 },
            },
          ],
        },
      ],
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
          props: { label: "联系人手机", disabled: false },
          // 数组项内的相对 target：清空时把同一行的邮箱一起清掉。
          effects: [{ type: "clear", when: "!$item.phone", targets: ["email"] }],
          expressions: {
            "props.disabled": "!$item.name",
            "props.placeholder": '$index === 0 ? "主联系人手机号" : "备用联系人手机号"',
          },
        },
        {
          field: "email",
          component: "input",
          props: { label: "联系人邮箱", placeholder: "请输入邮箱" },
        },
        {
          field: "meta",
          props: { label: "其他信息" },
          children: [
            {
              field: "note",
              component: "textarea",
              props: { label: "备注", placeholder: "可选", rows: 2 },
            },
          ],
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
    contact: {
      phone: "",
      address: { city: "", detail: "" },
    },
    emergencyContacts: [],
  };
}
