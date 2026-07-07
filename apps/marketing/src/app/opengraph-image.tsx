import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#08090c",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 75% 75%, rgba(34,211,238,0.25), transparent 55%)",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #7B7CF6, #22D3EE)",
              fontSize: 36,
              color: "white",
              fontWeight: 700,
            }}
          >
            V
          </div>
          <span style={{ fontSize: 40, color: "white", fontWeight: 700 }}>
            {siteConfig.name}
          </span>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 64,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 980,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "rgba(255,255,255,0.65)",
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          AI agents, CRM, workflows, knowledge, meetings, and automation in one platform.
        </div>
      </div>
    ),
    { ...size },
  );
}
