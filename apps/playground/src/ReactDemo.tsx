import { useState } from "react";

import { Button } from "@frontend-lab/ui-react";

export function ReactDemo() {
  const [count, setCount] = useState(0);

  return (
    <div className="demo-content">
      <p>React 组件使用 hooks、类型化 props 和原生 CSS，并通过 workspace 直接引用本地包。</p>
      <div className="demo-actions">
        <Button onClick={() => setCount((value) => value + 1)}>点击计数</Button>
        <Button tone="neutral" onClick={() => setCount(0)}>
          重置
        </Button>
      </div>
      <output className="demo-output">当前次数：{count}</output>
    </div>
  );
}
