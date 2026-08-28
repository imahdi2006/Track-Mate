import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#6366F1",
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
