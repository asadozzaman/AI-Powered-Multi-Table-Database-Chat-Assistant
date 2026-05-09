"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { apiFetch, clearToken, getToken } from "@/lib/api";

const PUBLIC_PATHS = new Set(["/login"]);

type CurrentUser = {
  email: string;
  role: string;
  full_name: string | null;
};

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(PUBLIC_PATHS.has(pathname));

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (PUBLIC_PATHS.has(pathname)) {
        setIsAllowed(true);
        return;
      }

      if (!getToken()) {
        setIsAllowed(false);
        router.replace("/login");
        return;
      }

      try {
        await apiFetch<CurrentUser>("/auth/me");
        if (!cancelled) setIsAllowed(true);
      } catch {
        clearToken();
        if (!cancelled) {
          setIsAllowed(false);
          router.replace("/login");
        }
      }
    }

    checkAccess();
    window.addEventListener("auth-changed", checkAccess);
    window.addEventListener("storage", checkAccess);

    return () => {
      cancelled = true;
      window.removeEventListener("auth-changed", checkAccess);
      window.removeEventListener("storage", checkAccess);
    };
  }, [pathname, router]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
