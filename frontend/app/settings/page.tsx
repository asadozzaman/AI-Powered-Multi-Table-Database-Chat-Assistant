"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, Plug, RefreshCw, Server, Star } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Connection = {
  id: number;
  name: string;
  dialect: string;
  is_default: boolean;
  has_active_schema: boolean;
};

export default function SettingsPage() {
  const toast = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("Demo Business Database");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setConnections(await apiFetch<Connection[]>("/database/list"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load connections";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!connectionUrl.trim()) return "Connection URL is required.";
    if (!/^postgres(ql)?(\+\w+)?:\/\//i.test(connectionUrl.trim())) {
      return "URL should start with postgresql:// or postgresql+psycopg://";
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/database/connect", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), connection_url: connectionUrl.trim(), is_default: true }),
      });
      toast.success("Connection saved and schema inspected.");
      setConnectionUrl("");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><Server size={12} /> Configuration</span>
          <h1>Database Settings</h1>
          <p>Connect an external PostgreSQL database. The assistant inspects it dynamically and rebuilds schema metadata.</p>
        </div>
        <button className="button secondary" onClick={load} type="button" disabled={loading}>
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
          Reload
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="error" title="Action could not be completed" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      <div className="grid two">
        <section className="panel">
          <div className="section-heading">
            <h2>Connect a database</h2>
            <Plug size={18} className="text-soft" />
          </div>
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label className="field-label" htmlFor="conn-name">Connection name</label>
              <input
                id="conn-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Demo Business Database"
                disabled={submitting}
              />
              <span className="field-hint">A short label so your team can recognize this connection.</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="conn-url">PostgreSQL connection URL</label>
              <input
                id="conn-url"
                className="input mono"
                value={connectionUrl}
                onChange={(event) => setConnectionUrl(event.target.value)}
                placeholder="postgresql+psycopg://user:pass@host:5432/db"
                disabled={submitting}
                autoComplete="off"
                spellCheck={false}
              />
              <span className="field-hint">
                The URL is stored on the server and used to inspect the database. Use a service account with read access.
              </span>
            </div>
            <div>
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? <Loader2 size={17} className="spin" /> : <DatabaseZap size={17} />}
                {submitting ? "Connecting…" : "Connect & Inspect"}
              </button>
            </div>
          </form>
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>Saved connections</h2>
            <Badge variant="neutral">{connections.length}</Badge>
          </div>
          {loading ? (
            <div className="stack">
              <Skeleton variant="block" />
              <Skeleton variant="block" />
            </div>
          ) : connections.length === 0 ? (
            <EmptyState
              icon={<DatabaseZap size={22} />}
              title="No connections yet"
              description="Add your first database using the form. The assistant will inspect it and build schema metadata."
            />
          ) : (
            <div className="stack">
              {connections.map((conn) => (
                <article className="connection-card" key={conn.id}>
                  <div className="connection-head">
                    <span className="action-card-icon"><DatabaseZap size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <strong>{conn.name}</strong>
                      <p className="text-muted mono" style={{ fontSize: 12, marginTop: 2 }}>{conn.dialect}</p>
                    </div>
                  </div>
                  <div className="cluster">
                    {conn.is_default && (
                      <Badge variant="info"><Star size={12} /> Default</Badge>
                    )}
                    {conn.has_active_schema ? (
                      <Badge variant="success"><CheckCircle2 size={12} /> Schema ready</Badge>
                    ) : (
                      <Badge variant="warning">Schema missing</Badge>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        .connection-card {
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 14px;
          background: var(--panel);
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .connection-card:hover {
          border-color: #cbd5e1;
          box-shadow: var(--shadow-xs);
        }
        .connection-head {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .connection-head strong {
          display: block;
          font-size: 13.5px;
          font-weight: 600;
        }
        .spin,
        .spinning {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
