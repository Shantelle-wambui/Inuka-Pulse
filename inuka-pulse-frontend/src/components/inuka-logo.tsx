import Image from "next/image";

import { cn } from "@/lib/utils";

interface InukaLogoProps {
  className?: string;
}

export function InukaLogo({ className }: InukaLogoProps) {
  return (
    <Image
      src="/inuka-logo.png"
      alt="Sentinel Logo"
      width={40}
      height={40}
      className={cn("size-4 object-contain", className)}
    />
  );
}
