import { describe, expect, it, vi } from "vitest";

import { collectDeps, evalExpression } from "../src/form-engine/utils/expr";

describe("expression utils", () => {
  it("evaluates expressions against the injected context", () => {
    const context = {
      $model: { userType: "admin" },
      $functions: { getDeptOptions: () => ["tech"] },
    };

    expect(evalExpression('$model.userType === "admin"', context)).toBe(true);
    expect(evalExpression("$functions.getDeptOptions()", context)).toEqual(["tech"]);
  });

  it("logs and returns undefined instead of throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(evalExpression("$model.missing.value", { $model: {} })).toBeUndefined();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("collects and dedupes $model / $item dependencies", () => {
    expect(collectDeps('$model.userType === "admin" && $model.userType !== ""')).toEqual([
      { type: "model", path: "userType" },
    ]);

    expect(collectDeps("!$item.name || !!$model.contacts[0].name")).toEqual([
      { type: "item", path: "name" },
      { type: "model", path: "contacts[0].name" },
    ]);
  });
});
