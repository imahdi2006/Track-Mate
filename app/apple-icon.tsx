import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1E293B 0%, #0F172A 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 110,
            height: 110,
            borderRadius: 28,
            background: "linear-gradient(160deg, #6366F1 0%, #4338CA 55%, #F59E0B 120%)",
            alignItems: "center",
            justifyContent: "center",
            color: "#F5F0E8",
            fontSize: 72,
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
