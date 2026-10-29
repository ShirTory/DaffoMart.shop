"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-500">Please try again. If it keeps happening, reload the page or come back in a moment.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <a href="/" className="btn-outline">Go to home</a>
      </div>
    </main>
  );
}
