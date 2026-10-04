import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "text";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-leaf text-white hover:bg-leaf/90 disabled:bg-leaf/40 disabled:text-white",
  secondary:
    "bg-surface text-ink border border-line hover:bg-paper disabled:text-ink-muted",
  text: "bg-transparent text-ink hover:underline disabled:text-ink-muted disabled:no-underline",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-md px-4 text-[16px] font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
