import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-extrabold tracking-tight text-primary">404</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">The page you are looking for does not exist or has moved.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/products" className="btn-outline">Browse products</Link>
      </div>
    </main>
  );
}
