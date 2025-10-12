import Image from "next/image";
import { ComponentPropsWithoutRef } from "react";

export function Logo(props: ComponentPropsWithoutRef<"div">) {
  return (
    <div className="text-3xl font-bold tracking-tight" {...props}>
      {/* <span className="text-orange-600 text-3xl">NOVA</span> */}
      <Image src="/logo.png" alt="NOVA" width={100} height={100} />
    </div>
  );
}