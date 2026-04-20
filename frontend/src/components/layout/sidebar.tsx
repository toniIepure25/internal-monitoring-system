"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { href: "/applications", label: "All Applications", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { href: "/hosts", label: "Hosts", icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
  { href: "/subscriptions", label: "My Subscriptions", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { href: "/notifications", label: "My Notifications", icon: "M7 8h10M7 12h10M7 16h6m-8 5h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/groups", label: "My Groups", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { href: "/incidents", label: "Incidents", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

const adminItems = [
  { href: "/admin", label: "Admin", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="min-h-screen w-full shrink-0 border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,245,249,0.92))] px-4 py-5 shadow-[inset_-1px_0_0_rgba(148,163,184,0.16)] lg:w-72">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#2563eb)] text-sm font-bold text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.8)]">
            IM
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-950">Internal Monitor</h1>
            <p className="mt-0.5 text-xs text-slate-500">Operations visibility workspace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all",
              pathname.startsWith(item.href)
                ? "bg-[linear-gradient(135deg,rgba(219,234,254,0.95),rgba(239,246,255,0.95))] text-sky-800 shadow-[0_14px_30px_-24px_rgba(37,99,235,0.65)] ring-1 ring-inset ring-sky-200"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
            )}
          >
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}

        {user?.role === "admin" && (
          <>
            <div className="pb-2 pt-5">
              <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Admin</p>
            </div>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all",
                  pathname.startsWith(item.href)
                    ? "bg-[linear-gradient(135deg,rgba(219,234,254,0.95),rgba(239,246,255,0.95))] text-sky-800 shadow-[0_14px_30px_-24px_rgba(37,99,235,0.65)] ring-1 ring-inset ring-sky-200"
                    : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
                )}
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="rounded-3xl border border-slate-200/80 bg-white/92 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe,#eff6ff)] text-sm font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
            {user?.display_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.display_name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="secondary-button w-full justify-start"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
