import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[16px] text-ink">{label}</span>
      {children}
      {error ? (
        <p className="mt-1 text-[14px] text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

const controlClass =
  "h-12 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}
