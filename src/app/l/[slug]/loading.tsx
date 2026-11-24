export default function PublicListingLoading() {
  return (
    <div className="min-h-screen bg-[#faf8f5] pb-10" aria-busy="true" aria-label="Loading batch">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
          <div className="h-3.5 w-20 animate-pulse rounded bg-stone-200" />
        </div>
      </header>

      <main className="mx-auto max-w-md animate-pulse space-y-4 px-4 pt-4">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="aspect-[4/3] w-full bg-stone-200" />
          <div className="space-y-3 p-4">
            <div className="h-6 w-3/4 rounded bg-stone-200" />
            <div className="h-7 w-1/3 rounded bg-stone-200" />
            <div className="h-3.5 w-full rounded bg-stone-100" />
            <div className="h-2 w-full rounded-full bg-stone-200" />
          </div>
        </div>

        <div className="h-12 rounded-xl bg-stone-200" />
        <div className="h-64 rounded-xl border border-stone-200 bg-white" />
      </main>
    </div>
  );
}
