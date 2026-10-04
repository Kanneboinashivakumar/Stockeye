type LiveStatus = "live" | "reconnecting" | "offline";

const copy: Record<LiveStatus, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-leaf" },
  reconnecting: { label: "Reconnecting", dot: "bg-turmeric" },
  offline: { label: "Offline", dot: "bg-brick" },
};

export function LiveIndicator({ status }: { status: LiveStatus }) {
  const item = copy[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[14px] text-white"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden />
      {item.label}
    </span>
  );
}
