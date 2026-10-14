export function FullPageLoader() {
  return (
    <main className="full-page-state" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Loading your session…</p>
    </main>
  );
}
