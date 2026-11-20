import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="SeoWaveTech home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-12">{children}</div>
        </div>
      </div>
      <div className="noise relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)", backgroundSize: "56px 56px" }} />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <div className="display max-w-lg text-[50px]">
            Be the name AI <em className="text-lime">recommends.</em>
          </div>
          <ul className="mt-8 space-y-3 text-[14.5px] text-white/65">
            <li>— Buyer questions tracked daily across the major AI engines</li>
            <li>— Content, fixes and off-site work done for you</li>
            <li>— One dashboard showing every result</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
