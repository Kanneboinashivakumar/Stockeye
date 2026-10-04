import { ImageResponse } from "next/og";

export const size = {
  width: 192,
  height: 192,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1E5B43",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 44,
        }}
      >
        <svg
          width="128"
          height="128"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 16C8.2 9.8 12.2 7 16 7C19.8 7 23.8 9.8 27 16C23.8 22.2 19.8 25 16 25C12.2 25 8.2 22.2 5 16Z"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="4.5" fill="#E4EFE8" />
          <circle cx="16" cy="16" r="2.8" fill="#17302A" />
          <circle cx="17.4" cy="14.6" r="1.2" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
