import Image from "next/image";

import logo from "@/public/logo.png";
import logoDark from "@/public/logo-dark.png";

/** Ícone do DevBrain: versão escura no tema claro e versão clara no tema escuro. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <>
      <Image src={logo} alt="DevBrain" width={size} height={size} className={`dark:hidden ${className}`} priority />
      <Image src={logoDark} alt="DevBrain" width={size} height={size} className={`hidden dark:block ${className}`} priority />
    </>
  );
}
