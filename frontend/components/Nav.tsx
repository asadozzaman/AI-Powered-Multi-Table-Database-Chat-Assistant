"use client";

import Link from "next/link";
import {
  Bot,
  Database,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  UserCircle,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, clearToken, getToken } from "@/lib/api";

const NAV_GROUPS: { title: string; items: { href: string; label: string; icon: typeof Gauge }[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/chat", label: "Chat Assistant", icon: Bot },
      { href: "/data", label: "Data Manager", icon: Table2 },
      { href: "/history", label: "Query History", icon: History },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/schema", label: "Schema", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admin", label: "Admin", icon: ShieldCheck },
    ],
  },
];

type CurrentUser = {
  email: string;
  role: string;
  full_name: string | null;
};

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!getToken()) {
        setUser(null);
        return;
      }

      try {
        const currentUser = await apiFetch<CurrentUser>("/auth/me");
        if (!cancelled) setUser(currentUser);
      } catch {
        clearToken();
        if (!cancelled) setUser(null);
      }
    }

    loadUser();
    window.addEventListener("auth-changed", loadUser);
    window.addEventListener("storage", loadUser);

    return () => {
      cancelled = true;
      window.removeEventListener("auth-changed", loadUser);
      window.removeEventListener("storage", loadUser);
    };
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function logout() {
    clearToken();
    setUser(null);
    router.push("/login");
  }

  const initial = (user?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <button
        className="mobile-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className={open ? "sidebar-backdrop open" : "sidebar-backdrop"} onClick={() => setOpen(false)} />
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link className="brand" href={user ? "/dashboard" : "/login"}>
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span className="brand-text">
            <strong>DB Chat AI</strong>
            <span>Multi-table assistant</span>
          </span>
        </Link>

        {user &&
          NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="nav-section-title">{group.title}</div>
              <nav>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link className={isActive ? "active" : ""} href={item.href} key={item.href}>
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

        <div className="account-box">
          {user ? (
            <>
              <div className="account-email" title={user.email}>
                <span className="account-avatar">{initial}</span>
                <div className="account-meta">
                  <strong>{user.full_name || user.email}</strong>
                  <small>{user.role}</small>
                </div>
              </div>
              <button className="logout-button" onClick={logout} type="button">
                <LogOut size={17} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <Link className={pathname === "/login" ? "active login-link" : "login-link"} href="/login">
              <UserCircle size={17} />
              <span>Login</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
