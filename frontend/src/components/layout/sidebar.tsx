"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  HomeIcon, CubeTransparentIcon, ServerIcon, SparklesIcon, BellIcon,
  UserGroupIcon, ExclamationTriangleIcon, Cog6ToothIcon, ShieldCheckIcon,
  ChevronLeftIcon, ArrowRightOnRectangleIcon, SunIcon, MoonIcon, MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { MonitorIcon } from "@/components/ui/monitor-icon";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/applications", label: "Applications", icon: CubeTransparentIcon },
  { href: "/hosts", label: "Hosts", icon: ServerIcon },
  { href: "/incidents", label: "Incidents", icon: ExclamationTriangleIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
  { href: "/subscriptions", label: "Subscriptions", icon: SparklesIcon },
  { href: "/groups", label: "Groups", icon: UserGroupIcon },
];

const bottom = [
  { href: "/settings", label: "Settings", icon: Cog6ToothIcon },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ collapsed = false, onToggleCollapse, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const link = (item: (typeof nav)[0]) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => onNavigate?.()}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all duration-150",
          active ? "text-fg font-medium" : "text-fgMuted hover:text-fg",
        )}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-md bg-surfaceRaised"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <span className={cn(
          "relative z-10 transition-colors duration-150",
          !active && "group-hover:bg-surfaceRaised/60",
        )} />
        <Icon className={cn("relative z-10 h-4 w-4 shrink-0 transition-colors", active ? "text-accent" : "text-fgSubtle group-hover:text-fgMuted")} />
        <span className={cn("relative z-10 truncate", collapsed && "lg:sr-only")}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border bg-canvas/80 backdrop-blur-md transition-[width] duration-200",
        collapsed ? "lg:w-[52px]" : "w-[220px]",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent"
        >
          <MonitorIcon className="h-3.5 w-3.5 text-accentFg" />
        </motion.div>
        <span className={cn("text-[13px] font-semibold text-fg", collapsed && "lg:sr-only")}>Monitor</span>
      </div>

      {/* Search trigger */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        title="Search (⌘K)"
        className={cn(
          "mx-2 mb-1 flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11px] text-fgSubtle transition-colors hover:border-borderStrong hover:text-fgMuted",
          collapsed && "justify-center",
        )}
      >
        <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0" />
        <span className={cn("flex-1 truncate text-left", collapsed && "lg:sr-only")}>Search…</span>
        <kbd className={cn("rounded border border-border px-1 text-[10px]", collapsed && "lg:sr-only")}>⌘K</kbd>
      </motion.button>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1" aria-label="Main">
        {nav.map(link)}
      </nav>

      {/* Bottom nav */}
      <div className="space-y-0.5 border-t border-border px-2 py-2">
        {bottom.map(link)}
        {user?.role === "admin" && link({ href: "/admin", label: "Admin", icon: ShieldCheckIcon })}
      </div>

      {/* Theme + collapse */}
      <div className="flex items-center border-t border-border px-2 py-1.5">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-fgSubtle transition-colors hover:bg-surfaceRaised hover:text-fgMuted"
        >
          {theme === "dark" ? <SunIcon className="h-3.5 w-3.5" /> : <MoonIcon className="h-3.5 w-3.5" />}
          <span className={cn("text-[11px]", collapsed && "lg:sr-only")}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </motion.button>
        {onToggleCollapse && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onToggleCollapse}
            className="ml-auto hidden h-7 w-7 items-center justify-center rounded-md text-fgSubtle transition-colors hover:bg-surfaceRaised hover:text-fgMuted lg:flex"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </motion.div>
          </motion.button>
        )}
      </div>

      {/* User */}
      <div className="border-t border-border px-2 py-2">
        <div className={cn("flex items-center gap-2", collapsed && "lg:justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surfaceRaised text-[11px] font-medium text-fgMuted">
            {user?.display_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:sr-only")}>
            <p className="truncate text-[13px] font-medium text-fg">{user?.display_name}</p>
            <p className="truncate text-[11px] text-fgSubtle">{user?.email}</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={logout}
          className={cn(
            "mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-fgSubtle transition-colors hover:bg-danger/10 hover:text-danger",
            collapsed && "lg:justify-center",
          )}
        >
          <ArrowRightOnRectangleIcon className="h-3.5 w-3.5 shrink-0" />
          <span className={cn(collapsed && "lg:sr-only")}>Sign out</span>
        </motion.button>
      </div>
    </div>
  );
}
