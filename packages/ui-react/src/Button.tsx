import { forwardRef, type ButtonHTMLAttributes } from "react";

import "./Button.css";

export type ButtonTone = "accent" | "danger" | "neutral";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, tone = "accent", type = "button", ...props },
  ref,
) {
  const classes = ["fl-button", `fl-button--${tone}`, className].filter(Boolean).join(" ");

  return <button {...props} className={classes} ref={ref} type={type} />;
});
