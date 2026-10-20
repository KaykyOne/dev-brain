import Image from "next/image";

import logo from "@/public/logo.png";

/** Ícone do DevBrain (public/icon.png reduzido). */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return <Image src={logo} alt="DevBrain" width={size} height={size} className={className} priority />;
}
