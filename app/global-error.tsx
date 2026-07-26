"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Triggers when the root layout itself throws, so
 * it cannot rely on globals.css having loaded — colors are inlined using the
 * Noir Cabaret v5 token values (see app/globals.css `:root`) rather than
 * Tailwind classes.
 */
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
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0D",
          color: "#F5F0EE",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "420px", padding: "40px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 20px",
              borderRadius: "999px",
              background: "rgba(193, 61, 38, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              color: "#E86A50",
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#B5A9AC", marginBottom: "24px", lineHeight: 1.5 }}>
            A critical error occurred. Please refresh the page or try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "#8B313A",
              color: "#F5F0EE",
              border: "none",
              borderRadius: "10px",
              width: "100%",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "20px", fontSize: "12px", color: "#82767A" }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
