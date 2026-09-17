---
title: JavaScript 事件循环：浏览器与 Node.js 到底有什么不同
date: 2026-09-17
tags:
  - JavaScript
  - Event Loop
  - Node.js
  - 面试
summary: 从调用栈、任务队列、微任务和 Node.js 六个阶段出发，校正常见表述并解释浏览器与 Node.js 事件循环的差异。
draft: true
---

# JavaScript 事件循环：浏览器与 Node.js 到底有什么不同

JavaScript 是单线程语言，却要同时处理点击事件、网络请求、定时器和页面渲染。事件循环就是让这些任务看起来可以并发运行的调度机制。浏览器和 Node.js 都执行 JavaScript，也都可能使用 V8，但它们拥有不同的事件循环实现。

理解事件循环时，最重要的不是背下“宏任务在前、微任务在后”，而是区分 JavaScript 引擎、宿主环境和任务队列分别负责什么。

## 为什么需要事件循环

JavaScript 的主要执行单元是调用栈。函数被调用时进入栈顶，执行结束后离开。同步代码必须等前一段执行完成，后一段才能开始。

如果网络请求也占用调用栈，页面就会被长时间阻塞。因此，`setTimeout`、网络请求和文件读写等操作会交给宿主环境处理。宿主在条件满足后，把对应回调加入队列；事件循环负责在合适的时机把回调重新交给调用栈。

这里要区分两个角色：

- JavaScript 引擎执行代码，负责调用栈、内存以及语言规范定义的作业。
- 宿主环境提供定时器、DOM、网络、文件系统和事件循环。

所以，V8 不等于事件循环。V8 是引擎，浏览器和 Node.js 才是事件循环的实现者。

Promise 虽然属于 ECMAScript 规范的一部分，但 Promise 回调何时执行，仍然需要宿主环境把对应作业放入微任务队列。这也是为什么 `then` 的基本语义在各运行环境中一致，却不能脱离宿主实现来理解整体执行顺序。

## 浏览器中的事件循环

在 HTML 规范中，更准确的术语是 **task** 和 **microtask**。“宏任务”是社区常用的说法，通常指任务队列中的一个任务。

浏览器会维护一个或多个任务队列。常见任务包括：

- 执行一段脚本。
- 派发用户交互事件。
- 执行已经到期的 `setTimeout` 或 `setInterval` 回调。
- 完成网络请求后执行对应回调。

浏览器可以维护多个任务队列，而不是只有一个全局 FIFO。用户代理会根据任务来源和优先级选择队列，因此不同来源的任务之间不保证存在全局先后顺序。例如，一个较早到期的定时器不一定永远比后来发生的用户点击先执行。

微任务通常包括：

- `Promise` 的 `then`、`catch` 和 `finally` 回调。
- `queueMicrotask` 注册的回调。
- `MutationObserver` 的回调。

一个容易被误解的点是：**UI 渲染不属于宏任务**。浏览器会在合适的时间获得一次 rendering opportunity，然后更新渲染。它可能在任务与微任务之后发生，但不保证每一轮事件循环都会渲染，也不应该被放进任务队列中理解。

`requestAnimationFrame` 的回调也不是普通任务。浏览器会在下一次重绘前调用它们，然后继续进行样式计算、布局和绘制。这个机制让动画能够跟随刷新节奏，而不是靠高频定时器模拟。

浏览器的一次典型循环可以简化成：

1. 选择一个任务并执行，直到调用栈清空。
2. 进入微任务检查点，依次清空微任务队列。
3. 微任务执行期间新产生的微任务，会继续追加在当前队列末尾。
4. 如果浏览器判断需要更新渲染，就在渲染时机执行 `requestAnimationFrame` 回调、样式计算、布局和绘制等步骤。
5. 进入下一轮循环。

关键规则是：**在当前任务完全结束前，不会开始下一个任务；但在下一个任务开始前，微任务队列会被清空。**

## 一个基础执行顺序

以下代码在浏览器和 Node.js 中的输出顺序相同：

```js
console.log("script start");

setTimeout(() => {
  console.log("timeout");
}, 0);

Promise.resolve().then(() => {
  console.log("promise");
});

queueMicrotask(() => {
  console.log("queueMicrotask");
});

console.log("script end");
```

输出：

```text
script start
script end
promise
queueMicrotask
timeout
```

原因是全局脚本先作为当前任务执行。`setTimeout` 的回调被安排到后续任务，而 `Promise.then` 和 `queueMicrotask` 的回调属于微任务。同步代码执行完后，JavaScript 引擎先清空两个微任务，事件循环才处理定时器任务。

`setTimeout(fn, 0)` 也并不意味着立即执行。它只表示“尽快在满足最小延迟后安排一个任务”，不能用来做精确计时。

## 微任务饥饿

微任务可以继续创建微任务，因此下面的写法需要谨慎：

```js
let remaining = 3;

function drainMicrotasks() {
  console.log("microtask", remaining);

  if (remaining-- > 0) {
    queueMicrotask(drainMicrotasks);
  }
}

queueMicrotask(drainMicrotasks);
console.log("sync");

setTimeout(() => {
  console.log("timeout");
}, 0);
```

输出：

```text
sync
microtask 3
microtask 2
microtask 1
microtask 0
timeout
```

有 `remaining` 限制时，微任务最终会结束，随后才轮到定时器。如果去掉限制，让每个微任务继续创建新的微任务，当前微任务队列就永远清不空。结果是定时器、用户输入和页面渲染都可能长期得不到机会，这种现象叫作**微任务饥饿**。

## Node.js 中的六个阶段

Node.js 的事件循环主要由 libuv 驱动，可以划分为六个阶段：

1. **timers**：执行已经到期的 `setTimeout` 和 `setInterval` 回调。
2. **pending callbacks**：执行部分延迟的系统回调，例如某些 TCP 错误。
3. **idle, prepare**：Node.js 内部使用，通常不需要直接关注。
4. **poll**：获取新的 I/O 事件并执行相关回调；在特定情况下可能在此等待。
5. **check**：执行 `setImmediate` 的回调。
6. **close callbacks**：执行关闭回调，例如 `socket.on("close", ...)`。

当没有定时器、`setImmediate` 或其他待处理任务时，poll 阶段可能短暂阻塞，等待新的 I/O 事件；这并不等于事件循环在忙等。阻塞时间会影响后续 timers 阶段何时检查过期定时器，所以网络活动密集时，定时器回调可能出现额外延迟。

这个划分解释了 `setImmediate` 与 `setTimeout` 的行为差异：`setImmediate` 属于 check 阶段，而定时器回调属于 timers 阶段。

Node.js 还有两个需要单独说明的队列：

- `process.nextTick` 使用独立的 nextTick 队列。
- Promise 等微任务使用微任务队列。

在当前主流 Node.js 版本中，可以按下面的规则理解：**一次操作结束后，先清空 nextTick 队列，再清空 Promise 微任务队列，然后事件循环才继续推进。**Node.js 11 前后的队列处理曾经存在一些差异，但新的代码不应继续依赖旧版本行为。

`process.nextTick` 的优先级虽然高，但它不是浏览器标准，也不能因此把它简单归为普通 Promise 微任务。它更准确的身份是 Node.js 提供的独立高优先级队列。

递归调用 `process.nextTick` 同样可能让事件循环无法推进，而且它比递归 Promise 微任务更容易造成饥饿，因为 nextTick 队列会先被处理完。`setImmediate` 适合把工作推迟到当前 I/O 阶段之后，但不应把它当作解决所有调度问题的万能工具。

## nextTick 与 Promise 的顺序

在 Node.js 中运行：

```js
console.log("start");

setTimeout(() => {
  console.log("timer");
}, 0);

setImmediate(() => {
  console.log("immediate");
});

Promise.resolve().then(() => {
  console.log("promise");
});

process.nextTick(() => {
  console.log("nextTick");
});

console.log("end");
```

输出通常为：

```text
start
end
nextTick
promise
timer
immediate
```

最后两行在顶层脚本中可能交换，因为第一次进入 timers 阶段时，定时器不一定已经到期，具体结果会受到进程启动耗时和运行环境影响。

如果在 I/O 回调中同时安排 `setTimeout` 和 `setImmediate`，通常会先执行 `setImmediate`。因为当前处于 poll 阶段，下一步会进入 check 阶段，而定时器要等下一轮 timers 阶段。

## 浏览器与 Node.js 对照

| 对比项             | 浏览器                                        | Node.js                           |
| ------------------ | --------------------------------------------- | --------------------------------- |
| 事件循环实现       | HTML 规范与浏览器实现                         | libuv                             |
| 任务来源           | 脚本、DOM 事件、定时器、网络等                | 定时器、I/O、`setImmediate` 等    |
| 微任务             | Promise、`queueMicrotask`、`MutationObserver` | Promise 等                        |
| Node.js 特有队列   | 无                                            | `process.nextTick`、nextTick 队列 |
| 渲染               | 存在 rendering opportunity                    | 没有页面渲染阶段                  |
| Node.js 定时器阶段 | 不适用                                        | timers                            |
| `setImmediate`     | 不支持                                        | check 阶段执行                    |

共同点是：同步代码先执行，调用栈清空后处理微任务，之后才继续处理新的任务。差异主要来自宿主环境提供的输入源和阶段划分。

## 常见误区

### Promise 构造函数会异步执行吗

不会。`new Promise(executor)` 中的 executor 会同步执行，只有传给 `then`、`catch` 或 `finally` 的回调才会进入微任务队列。

### 微任务会在每个同步语句后执行吗

不会。同步代码持续执行，直到当前调用栈清空，才进入微任务检查点。

### `setTimeout(fn, 0)` 会立刻执行吗

不会。回调必须等待当前任务与微任务结束，还要满足浏览器的计时与任务调度规则。

### V8 负责事件循环吗

不负责。V8 是 JavaScript 引擎；事件循环由浏览器或 Node.js 等宿主实现。

### `process.nextTick` 就是 Promise 微任务吗

不是。它使用 Node.js 独立的 nextTick 队列，并且通常先于 Promise 微任务执行，同时只存在于 Node.js。

## 面试速答

- 事件循环是什么：宿主环境用来调度任务和回调的执行机制。
- 浏览器的一次循环做什么：执行一个任务，清空微任务，按需更新渲染，然后继续循环。
- 微任务什么时候执行：当前调用栈清空后，以及进入下一个任务前。
- Node.js 为什么有六个阶段：libuv 按事件类型分阶段处理定时器、I/O、check 和关闭回调。
- `setImmediate` 和 `setTimeout` 为什么顺序可能变化：它们属于不同阶段，顶层脚本中的执行顺序会受到进程启动和定时器到期时间影响。

## 总结

事件循环的核心不是一张死记硬背的顺序表，而是三个层次：

1. JavaScript 引擎执行同步代码并管理调用栈。
2. 宿主环境接收异步操作，在条件满足后安排任务。
3. 事件循环执行任务、清空微任务，并按需处理渲染或进入 Node.js 的下一个阶段。

只要分清浏览器与 Node.js 的边界，再结合具体运行环境判断 Promise、`setTimeout`、`setImmediate` 和 `process.nextTick` 的位置，大多数事件循环面试题都可以回到同一套模型上。

真正可靠的判断方法是先问三件事：当前代码属于哪个任务，运行环境会提供哪些队列，回调被放入队列时是否还有新任务持续产生。搞清这三点，就不必依赖容易记错的“宏任务大全”。
