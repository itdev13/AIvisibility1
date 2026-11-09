"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: string | number;
  locked?: boolean;
}

const ICONS = {
  overview: <path d="M3 10.5 10 4l7 6.5M5 9v7h10V9" />,
  questions: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.4M10 14.2v.1" />
    </>
  ),
  competitors: <path d="M4 16V9M10 16V4M16 16v-5" />,
  content: <path d="M5 3.5h7l3 3V16.5H5zM12 3.5V7h3M7.5 10h5M7.5 13h5" />,
  fixes: <path d="m11.5 4.5 4 4-7.5 7.5H4v-4zM10 6l4 4" />,
  offsite: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 3 4.3 3 7s-1 5-3 7c-2-2-3-4.3-3-7s1-5 3-7" />
    </>
  ),
  traffic: <path d="M3 15l4.5-5 3 3L17 6M12.5 6H17v4.5" />,
  settings: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </>
  ),
  clients: <path d="M3 16c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M13 3.3a3 3 0 0 1 0 5.4M17 16c0-2-1-3.4-2.6-4" />,
  review: <path d="M3 10s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />,
  leads: <path d="M3 5h14v10H3zM3 5l7 5.5L17 5" />,
  jobs: <path d="M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2" />,
};

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function SideNav({ items, base }: { items: NavItem[]; base: string }) {
  const path = usePathname();
  const active = (href: string) => (href === base ? path === base : path.startsWith(href));
  return (
    <>
      {/* Desktop */}
      <nav className="hidden space-y-0.5 lg:block">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition",
              active(it.href) ? "bg-white font-medium text-ink-950 shadow-card ring-1 ring-ink-200/70" : "text-ink-600 hover:bg-ink-150/60 hover:text-ink-950",
            )}
          >
            <Icon name={it.icon} className={active(it.href) ? "text-ink-950" : "text-ink-400 group-hover:text-ink-700"} />
            <span className="flex-1">{it.label}</span>
            {it.locked && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Scale</span>}
            {it.badge != null && it.badge !== 0 && (
              <span className="tnum rounded-full bg-ink-900 px-1.5 py-px text-[10.5px] font-semibold text-white">{it.badge}</span>
            )}
          </Link>
        ))}
      </nav>
      {/* Mobile */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]", active(it.href) ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200")}
          >
            {it.label}
            {it.badge != null && it.badge !== 0 && <span className="tnum text-[11px] opacity-70">{it.badge}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Masthead section tabs. Active tab gets the highlighter underline. Scrolls sideways on phones. */
export function TopNav({ items, base }: { items: NavItem[]; base: string }) {
  const path = usePathname();
  const active = (href: string) => (href === base ? path === base : path.startsWith(href));
  return (
    <nav className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max items-stretch gap-1">
        {items.map((it) => {
          const on = active(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "group relative flex h-11 items-center gap-2 px-3 text-[14px] transition",
                  on ? "font-medium text-ink-950" : "text-ink-600 hover:text-ink-950",
                )}
              >
                <span className={cn(on && "hl-under")}>{it.label}</span>
                {it.locked && <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-400">Scale</span>}
                {it.badge != null && it.badge !== 0 && (
                  <span className="tnum grid h-[18px] min-w-[18px] place-items-center rounded-[3px] bg-ink-950 px-1 font-mono text-[10px] font-semibold text-lime">{it.badge}</span>
                )}
                <span className={cn("absolute inset-x-3 -bottom-px h-[3px]", on ? "bg-ink-950" : "bg-transparent group-hover:bg-ink-300")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
