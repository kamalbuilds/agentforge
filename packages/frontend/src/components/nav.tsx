"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/connect-button";

const NAV_LINKS = [
  { href: "/agents", label: "Gallery" },
  { href: "/arena",  label: "Arena"  },
  { href: "/breed",  label: "Breed"  },
  { href: "/mint",   label: "Mint"   },
  { href: "/profile",label: "Profile"},
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a14]/85 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Geometric logo mark — two overlapping triangles */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
            <polygon points="10,2 18,16 2,16" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round"/>
            <polygon points="10,7 15,16 5,16" fill="#7c3aed" opacity="0.5"/>
          </svg>
          <span
            className="text-base font-semibold tracking-tight text-[#ededed] group-hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.01em" }}
          >
            AgentForge
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "text-[#ededed] bg-white/[0.06]"
                    : "text-[#6b7280] hover:text-[#ededed] hover:bg-white/[0.03]",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <ConnectButton />
      </div>
    </nav>
  );
}
