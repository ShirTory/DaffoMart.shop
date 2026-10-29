import Image from "next/image";

/** Shown instantly while a page loads — logo + brand with a light pulse. */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" aria-busy="true" aria-label="Loading DaffoMart">
      <div className="relative h-16 w-16 animate-pulse sm:h-20 sm:w-20">
        <Image src="/logo.png" alt="DaffoMart" fill className="object-contain" priority />
      </div>
      <p className="text-lg font-bold tracking-tight text-primary sm:text-xl">DaffoMart</p>
      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-primary-soft">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}
