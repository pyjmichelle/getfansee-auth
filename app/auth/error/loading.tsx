export default function Loading() {
  return (
    <div className="min-h-dvh bg-bg-base flex items-center justify-center">
      <div className="text-text-muted text-small" role="status" aria-live="polite">
        Loading…
      </div>
    </div>
  );
}
