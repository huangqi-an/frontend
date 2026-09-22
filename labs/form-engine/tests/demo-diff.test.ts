import { describe, expect, it } from "vitest";

import { diffPaths } from "../src/demo/diff";

describe("diffPaths", () => {
  it("returns nothing for identical configs", () => {
    expect(diffPaths({ disabled: false }, { disabled: false })).toEqual([]);
  });

  it("reports changed leaves with path and value", () => {
    expect(
      diffPaths(
        { props: { disabled: false, visible: true }, rules: [{ required: false }] },
        { props: { disabled: true, visible: true }, rules: [{ required: true }] },
      ),
    ).toEqual(["props.disabled: false → true", "rules[0].required: false → true"]);
  });

  it("reports changed values and removed keys", () => {
    expect(diffPaths({ hint: "" }, { hint: "来自表达式" })).toEqual(['hint: "" → "来自表达式"']);
    expect(diffPaths({ a: 1 }, {})).toEqual(["a: 1 → undefined"]);
  });
});
