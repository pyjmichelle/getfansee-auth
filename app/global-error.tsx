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
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "system-ui" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>Application Error</h1>
          <p style={{ color: "#666", marginBottom: "24px" }}>
            A critical error occurred. Please refresh the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              cursor: "pointer",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "24px", fontSize: "12px", color: "#999" }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
