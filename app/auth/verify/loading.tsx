export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground" role="status" aria-live="polite">
        Loading…
      </div>
    </div>
  );
}
