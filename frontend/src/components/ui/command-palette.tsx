"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  HomeIcon, CubeTransparentIcon, ServerIcon, ExclamationTriangleIcon,
  BellIcon, SparklesIcon, UserGroupIcon, Cog6ToothIcon, ShieldCheckIcon,
  PlusIcon, MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  group: string;
}

const pages: Item[] = [
  { id: "dashboard", label: "Dashboard", icon: HomeIcon, href: "/dashboard", group: "Pages" },
  { id: "applications", label: "Applications", icon: CubeTransparentIcon, href: "/applications", group: "Pages" },
  { id: "hosts", label: "Hosts", icon: ServerIcon, href: "/hosts", group: "Pages" },
  { id: "incidents", label: "Incidents", icon: ExclamationTriangleIcon, href: "/incidents", group: "Pages" },
  { id: "notifications", label: "Notifications", icon: BellIcon, href: "/notifications", group: "Pages" },
  { id: "subscriptions", label: "Subscriptions", icon: SparklesIcon, href: "/subscriptions", group: "Pages" },
  { id: "groups", label: "Groups", icon: UserGroupIcon, href: "/groups", group: "Pages" },
  { id: "settings", label: "Settings", icon: Cog6ToothIcon, href: "/settings", group: "Pages" },
  { id: "admin", label: "Admin", icon: ShieldCheckIcon, href: "/admin", group: "Pages" },
];

const actions: Item[] = [
  { id: "new-app", label: "Add application", description: "Register a new app", icon: PlusIcon, href: "/applications/new", group: "Actions" },
  { id: "new-host", label: "Register host", description: "Add infrastructure", icon: PlusIcon, href: "/hosts/new", group: "Actions" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allItems = useMemo(() => [...pages, ...actions], []);

  const filtered = useMemo(() => {
    if (!query) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
    );
  }, [query, allItems]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return map;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  const execute = useCallback((item: Item) => {
    setOpen(false);
    if (item.href) router.push(item.href);
    else item.action?.();
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flatItems[selected]) {
      e.preventDefault();
      execute(flatItems[selected]);
    }
  };

  let idx = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[400] bg-canvas/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            key="palette"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed inset-x-0 top-[15%] z-[401] mx-auto w-full max-w-md"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-fgSubtle" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                  onKeyDown={onKeyDown}
                  placeholder="Search pages and actions…"
                  className="flex-1 bg-transparent py-3 text-[13px] text-fg outline-none placeholder:text-fgSubtle"
                />
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-fgSubtle">ESC</kbd>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {flatItems.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-fgSubtle">No results found</p>
                ) : (
                  Array.from(groups.entries()).map(([group, items]) => (
                    <div key={group}>
                      <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fgSubtle">{group}</p>
                      {items.map((item) => {
                        idx++;
                        const i = idx;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => execute(item)}
                            onMouseEnter={() => setSelected(i)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                              i === selected ? "bg-surfaceRaised text-fg" : "text-fgMuted",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-fgSubtle" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium">{item.label}</p>
                              {item.description && <p className="truncate text-[11px] text-fgSubtle">{item.description}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
