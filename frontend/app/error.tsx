"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="panel app-error-panel">
      <div className="app-error-icon">
        <AlertTriangle size={24} />
      </div>
      <div>
        <h1>Something interrupted the page render</h1>
        <p>
          This can happen if a browser extension changes the page while the app is rendering. Disable translation or
          grammar extensions for localhost, then try again.
        </p>
        <button className="button" onClick={reset} type="button">
          <RefreshCw size={17} />
          Try again
        </button>
      </div>
    </section>
  );
}
