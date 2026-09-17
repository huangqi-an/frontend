export type ButtonTone = "accent" | "danger" | "neutral";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
  disabled?: boolean;
}
