"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
            textAlign: "center",
            background: "#050505",
            color: "#ffffff",
          }}
        >
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
              Something went wrong
            </p>
            <p style={{ fontSize: "13px", color: "#A5A5A5", marginBottom: "16px" }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                fontSize: "13px",
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: "14px",
                border: "1px solid #D4AF37",
                background: "#0E0E0E",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
