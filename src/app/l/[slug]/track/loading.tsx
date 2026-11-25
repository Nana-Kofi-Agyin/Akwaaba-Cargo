export default function PublicTrackingLoading() {
  return (
    <div
      className="min-h-screen bg-[#faf8f5] pb-12"
      aria-busy="true"
      aria-label="Loading batch timeline"
    >
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-stone-200" />
        </div>
      </header>

      <main className="mx-auto max-w-md animate-pulse space-y-4 px-4 pt-4">
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-36 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
      </main>
    </div>
  );
}
