import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  asLink?: boolean;
  href?: string;
}

export function Logo({
  size = "md",
  showWordmark = true,
  className = "",
  asLink = false,
  href = "/",
}: LogoProps) {
  const iconSizes = {
    sm: { box: 26, r: 6, font: "text-[18px]", stroke: 1.75 },
    md: { box: 34, r: 8, font: "text-[22px]", stroke: 2 },
    lg: { box: 44, r: 10, font: "text-[28px]", stroke: 2.25 },
  };

  const current = iconSizes[size];

  const content = (
    <div className="inline-flex items-center gap-2.5 select-none">
      {/* Geometric Eye & Shelf Tag Mark */}
      <svg
        width={current.box}
        height={current.box}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Leaf Tint background with 8px radius matching DESIGN.md */}
        <rect width="32" height="32" rx={current.r} fill="#E4EFE8" />
        {/* Eye contour in Leaf (#1E5B43) */}
        <path
          d="M6 16C8.8 10.8 12.4 8.5 16 8.5C19.6 8.5 23.2 10.8 26 16C23.2 21.2 19.6 23.5 16 23.5C12.4 23.5 8.8 21.2 6 16Z"
          stroke="#1E5B43"
          strokeWidth={current.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Focal Lens / Pupil in deep Ink (#17302A) */}
        <circle cx="16" cy="16" r="3.75" fill="#17302A" />
        {/* Catchlight reflection */}
        <circle cx="17.2" cy="14.8" r="1.25" fill="#FFFFFF" />
      </svg>

      {/* Brand Wordmark in Bricolage Grotesque (font-heading) */}
      {showWordmark && (
        <span
          className={`font-heading font-semibold text-ink tracking-tight leading-none ${current.font}`}
        >
          Stock<span className="text-leaf">eye</span>
        </span>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf rounded-[8px] ${className}`}
        aria-label="Stockeye home"
      >
        {content}
      </Link>
    );
  }

  return <div className={`inline-flex items-center ${className}`}>{content}</div>;
}
