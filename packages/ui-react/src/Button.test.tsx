import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("renders its label and calls onClick", () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Run task</Button>);

    const button = screen.getByRole("button", { name: "Run task" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while disabled", () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Run task
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run task" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
