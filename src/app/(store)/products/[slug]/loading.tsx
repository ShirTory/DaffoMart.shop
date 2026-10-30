export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading product">
      <div className="mb-4 h-4 w-64 rounded bg-gray-200" />
      <div className="grid gap-8 rounded-2xl border bg-white p-5 md:grid-cols-2 md:p-8">
        <div className="aspect-square rounded-2xl bg-gray-100" />
        <div className="space-y-4"><div className="h-8 w-3/4 rounded bg-gray-200" /><div className="h-4 w-40 rounded bg-gray-100" /><div className="h-10 w-48 rounded bg-gray-200" /><div className="h-12 w-full max-w-sm rounded-full bg-gray-200" /><div className="h-24 w-full rounded bg-gray-100" /></div>
      </div>
      <div className="mt-8 h-6 w-48 rounded bg-gray-200" /><div className="mt-3 h-40 rounded-2xl bg-gray-100" />
    </div>
  );
}
