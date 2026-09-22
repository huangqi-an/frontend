# form-engine（实验）

Vue 3 + TypeScript 的动态表单引擎实验：用只读 schema、业务 model 和运行时字段三层结构，
支撑表达式联动、声明式副作用和 repeatable 数组字段。

这个目录来自 `labs/` 里的设计草稿。草稿原样归档在 [DESIGN.draft.md](./DESIGN.draft.md)，
当前实现的逐段导读在 [DESIGN.md](./DESIGN.md)（场景走查 + 核心函数内嵌，读代码前建议先看它）。
草稿本身是一份 Markdown 代码堆，这里把其中的代码整理成可运行的工程，并修掉了会直接导致运行失败的问题。

## 运行

labs 下的实验不进根 pnpm workspace，需要在本目录单独安装依赖：

```bash
cd labs/form-engine
pnpm install --ignore-workspace
pnpm typecheck
pnpm test
pnpm dev     # http://127.0.0.1:5173
pnpm build
```

## 目录

```text
form-engine/
├── DESIGN.md            当前实现的导读：场景走查 + 核心函数 + 4 张流程图
├── DESIGN.draft.md      最初的设计草稿（历史存档，不代表现状）
├── src/
│   ├── form-engine/     引擎本体，可整体复制到其他 Vue 3 项目
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── utils/       path / clone / expr
│   │   ├── hooks/       useSchema / useExpression / useEffects / useRepeatable / useFormEngine
│   │   └── renderer/    headless 渲染层：FormRenderer + 控件注册表的 provide/inject
│   └── demo/            演示：schema、调试面板，以及业务侧自己的布局与控件
│       ├── DemoForm.vue 用插槽接管布局的自递归组件
│       └── controls/    原生 input / select / 文本域控件
└── tests/               path、表达式、引擎集成、渲染层契约、demo 皮肤
```

## 核心概念

| 概念       | 作用                                                             | 谁能改                     |
| ---------- | ---------------------------------------------------------------- | -------------------------- |
| schema     | 字段结构：控件、初始 props、rules、expressions、effects          | 业务侧编写，引擎只读       |
| model      | 要提交、要持久化的业务数据                                       | 只能通过 `engine.setValue` |
| 运行时字段 | schema 的响应式副本，表达式结果写进 `props` / `rules` / `custom` | 引擎                       |

表达式上下文：

```text
$model      整个表单数据
$item       repeatable 当前行数据（只有数组项内的表达式才有）
$index      当前行下标
$self       当前运行时字段
$functions  useFormEngine 注入的函数表
```

## 一次 setValue 发生了什么

```text
engine.setValue(path, value)
  -> 写入 model
  -> path 入队
  -> 命中依赖该 path 的表达式，结果写进运行时字段
  -> 命中 sourcePath 匹配的副作用，执行 clear
  -> 被清空的 path 重新入队
  -> 队列清空，或达到 maxSteps（默认 100）后停止
```

初始化只执行表达式，不执行副作用，因此调用方传入的 `initialModel` 不会被清空。

## 渲染层：依赖注入 + headless 插槽

`src/form-engine/renderer/` 只做四件事：推导路径、判断显隐、递归到子层、读写 model。
它**不 import 任何具体控件**，也不带任何样式：

```ts
// 控件注册表由业务侧注入，渲染层只按 schema 里的 component 字符串去取
provideFormControls({ input: InputControl, select: ElSelect, textarea: MyTextarea });
// 应用级注册也可以直接 app.provide(FORM_CONTROLS_KEY, registry)
```

`FormRenderer` 暴露四个插槽，把外观和递归方式交回业务侧：

| 插槽      | 作用域                                                                                                                    | 业务侧负责                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `field`   | `{ field, path, runtime, control, value, setValue, label, placeholder, disabled, required, hint, options, controlProps }` | 叶子字段的包装、控件选型与绑定方式           |
| `object`  | `{ field, path, runtime, label, children }`                                                                               | 对象分组的容器样式，以及如何递归 `children`  |
| `array`   | `{ field, path, runtime, label, itemSchema, items, append, remove }`                                                      | 数组容器、增删按钮文案与位置、每一项如何递归 |
| `missing` | 同 `field`                                                                                                                | 组件没注册时的兜底展示                       |

插槽只作用于当前层，递归时要把同一套插槽传下去——demo 的做法是让 [DemoForm.vue](./src/demo/DemoForm.vue)
自己递归，`object` 和 `array` 插槽里渲染的都是 `DemoForm` 而不是 `FormRenderer`。

不写插槽也能跑：渲染层会按默认约定把注册到的控件 `v-bind` 上
`modelValue` / `onUpdate:modelValue` / `label` / `placeholder` / `disabled` / `required` / `hint` / `options`，
组件没注册就走 `missing` 插槽。也就是说，**结构由渲染层决定，长什么样由业务侧决定**。

## 怎么验证 schema 真的没被改写

demo 页面右侧有几块对照面板，它们不是静态截图，而是跟着每次联动重算的：

| 面板                        | 说明                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 源 schema 里的 dept（只读） | 启动时把 schema 序列化成快照，之后每次 `setValue` / `append` / `remove` 都重新序列化比对，一致就显示「✓ 与启动快照一致」，被改写就变红 |
| 表达式改写运行时字段的路径  | 用 `diffPaths` 比较源字段与运行时字段，列出表达式实际写到了哪些路径，例如 `props.disabled: false → true`                               |

对应的回归测试在 `tests/engine.test.ts`（跑完整个生命周期后源 schema 与深快照逐字相同，
同时断言运行时副本确实变了）和 `tests/renderer.test.ts`（挂载真实 demo 页面，交互后面板仍显示一致）。
把 `useSchema` 里的 `deepClone` 去掉，这两条用例会立刻失败。

## 相比草稿修掉的问题

草稿里的代码按原样复制无法运行，或者运行后结果不对，整理时逐条修正：

1. `normalizePath` 用的正则 `/$(\d+)$/g` 匹配的是字面量 `$0`，改成 `/\[(\d+)\]/g`，`a[0].b` 才能正确变成 `a.0.b`。
2. `parseArrayContext` 的正则同样错误，导致 `$item` 永远取不到值；改成 `/^(.*)\[(\d+)\](?:\.|$)/`。
3. 表达式结果原地写进 schema 对象，且字段不是响应式的，改完界面不更新；改用 `deepClone` 后的 `reactive` 运行时字段。
4. `deepClone` 用 `JSON.parse(JSON.stringify())`，会丢掉函数、`undefined`、`Date`；改成支持循环引用的结构化拷贝，函数和类实例按引用保留。
5. 副作用清空字段后不再派发，`a → b → c` 这类级联不生效；`setValue` 改为有限步 BFS，清空的路径重新入队。
6. 表达式每次求值都重新 `new Function`；增加按表达式 + 形参缓存的编译结果。
7. `initialModel` 没有的 repeatable 容器不会被初始化，渲染层拿到 `undefined`；初始化时补成空数组。
8. 嵌套 repeatable 在草稿里没有定义行为；现在会在 schema 校验阶段直接抛错。
9. `collectDeps` 只能识别 `$model.a.b`，改成同时支持 `$model.contacts[0].name`，并去重。

## 已知边界

- 不支持嵌套 repeatable，schema 校验会直接报错。
- 不支持表达式依赖另一个表达式的结果，依赖只来自 model 路径。
- 不支持 `$model[key]` 这类动态路径；路径必须是静态可解析的。
- 表达式直接解引用未初始化的嵌套路径（如 `$model.contact.phone` 而 model 里没有 `contact`）会抛错并被记录，
  需要在 `initialModel` 里补齐结构，或把表达式写成 `$model.contact?.phone`。
- 表达式用 `new Function` 求值，只适用于本地可信 schema；不可信来源需要替换成 AST 白名单求值器。
- repeatable 增删按 `O(数组长度)` 全量重建运行时字段，用性能换索引正确性。
- 没有实现校验执行器，`rules` 只作为可联动的运行时状态。
- 显隐属于行为层：`props.visible === false` 的字段不会被渲染，插槽拿不到它（想要“渲染但隐藏”需要另加开关）。
- 渲染层读的是约定：`props.*` 透传、`rules[0].required` 判必填、`custom.options` / `custom.hint` 由控件自己解释；
  这些约定只写在渲染层和 demo schema 里，引擎本身把它们当作不透明数据。
- `options` 以原始 `unknown[]` 交给控件，形状由业务侧自己归一化（demo 的 select 就是这么做的）。

## 与其他文档的关系

`content/notes/动态表单引擎.md` 是同一主题的成稿文章，它把运行时状态进一步拆成独立的 `runtimeState`
（表达式不写回字段对象），并补上了编译期 schema 冻结、BFS 调度和错误收集。本实验保留草稿的模块划分和
API 形态，改动只针对“让草稿真正跑起来”；如果要提升为 `packages/` 里的正式包，建议按那篇文章的方案先做
状态归属的拆分。
