type StatusKind = "confirmed" | "needs-price" | "needs-stock" | "error";

const styles: Record<StatusKind, { wrap: string; dot: string; label: string }> = {
  confirmed: {
    wrap: "bg-leaf-tint",
    dot: "bg-leaf",
    label: "Confirmed",
  },
  "needs-price": {
    wrap: "bg-turmeric-tint",
    dot: "bg-turmeric",
    label: "Needs price",
  },
  "needs-stock": {
    wrap: "bg-turmeric-tint",
    dot: "bg-turmeric",
    label: "Needs stock",
  },
  error: {
    wrap: "bg-brick-tint",
    dot: "bg-brick",
    label: "Error",
  },
};

export function StatusChip({
  kind,
  label,
}: {
  kind: StatusKind;
  label?: string;
}) {
  const style = styles[kind];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-ink ${style.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {label ?? style.label}
    </span>
  );
}
