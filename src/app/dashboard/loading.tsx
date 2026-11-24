export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-36 rounded-md bg-stone-200" />
          <div className="h-3.5 w-52 rounded-md bg-stone-200" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-stone-200" />
      </div>

      {[1, 2].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
        >
          <div className="flex gap-3">
            <div className="h-16 w-16 shrink-0 rounded-lg bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-stone-200" />
              <div className="h-4 w-1/3 rounded bg-stone-200" />
              <div className="h-3 w-1/2 rounded bg-stone-200" />
            </div>
          </div>
          <div className="h-12 rounded-lg bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
