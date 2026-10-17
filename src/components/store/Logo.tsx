import Image from "next/image";
/** Uses the logo uploaded in Admin → Website Content, otherwise the bundled DaffoMart logo. */
export default function Logo({ src, name, className, priority }: { src?: string; name: string; className: string; priority?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name} className={className} />;
  return <Image src="/logo-horizontal.png" alt={name} width={778} height={168} priority={priority} className={className} />;
}
