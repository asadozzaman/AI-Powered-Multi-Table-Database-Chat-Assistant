"use client";

import { useState } from "react";
import { CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type RefreshResult = {
  schema_hash: string;
  changes: Record<string, unknown>;
};

export default function AdminPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RefreshResult | null>(null);

  async function refreshSchema() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<RefreshResult>("/schema/refresh", { method: "POST", body: "{}" });
      setResult(data);
      toast.success(`Schema refreshed · ${data.schema_hash.slice(0, 12)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><ShieldCheck size={12} /> Admin</span>
          <h1>Admin Panel</h1>
          <p>Refresh schema metadata, regenerate Schema-RAG chunks, and rebuild the relationship graph.</p>
        </div>
        <Badge variant="info"><ShieldCheck size={12} /> Admin access</Badge>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="error" title="Refresh failed" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      <div className="grid two">
        <section className="panel">
          <div className="section-heading">
            <h2>Schema metadata</h2>
            <Database size={18} className="text-soft" />
          </div>
          <p className="text-soft" style={{ fontSize: 13.5, marginBottom: 14 }}>
            Re-inspects the active database, regenerates schema chunks, recomputes the schema hash, and rebuilds
            relationship graph inputs used by the chat assistant.
          </p>
          <ul className="admin-checklist">
            <li><CheckCircle2 size={15} /> Inspects tables, columns, primary keys, and foreign keys</li>
            <li><CheckCircle2 size={15} /> Regenerates Schema-RAG chunks for retrieval</li>
            <li><CheckCircle2 size={15} /> Records a new schema version with diff details</li>
          </ul>
          <div style={{ marginTop: 18 }}>
            <button className="button" onClick={refreshSchema} type="button" disabled={loading}>
              {loading ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}
              {loading ? "Refreshing schema…" : "Refresh schema now"}
            </button>
          </div>

          {result && !loading && (
            <div style={{ marginTop: 16 }}>
              <Alert variant="success" title="Schema refreshed">
                Hash <span className="mono">{result.schema_hash.slice(0, 16)}</span>
                {" · "}
                {Object.keys(result.changes).length === 0
                  ? "No structural changes detected."
                  : `Detected ${Object.keys(result.changes).length} change group(s).`}
              </Alert>
              {Object.keys(result.changes).length > 0 && (
                <pre className="sql" style={{ marginTop: 12, maxHeight: 220 }}>
                  {JSON.stringify(result.changes, null, 2)}
                </pre>
              )}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>What this does</h2>
            <Sparkles size={18} className="text-soft" />
          </div>
          <div className="guardrail-list">
            <div className="guardrail">
              <span className="guardrail-icon"><Database size={18} /></span>
              <div>
                <strong>Keeps answers accurate</strong>
                <p>When the database changes, refreshing schema ensures the assistant builds queries against the latest tables and columns.</p>
              </div>
            </div>
            <div className="guardrail">
              <span className="guardrail-icon"><RefreshCw size={18} /></span>
              <div>
                <strong>Versioned and auditable</strong>
                <p>Every refresh creates a new schema version record so you can see when changes were detected.</p>
              </div>
            </div>
            <div className="guardrail">
              <span className="guardrail-icon"><ShieldCheck size={18} /></span>
              <div>
                <strong>Safe to run anytime</strong>
                <p>Refreshing is read-only against the target database. It only updates internal metadata.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .admin-checklist {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
          font-size: 13.5px;
          color: var(--text-soft);
        }
        .admin-checklist li {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .admin-checklist svg {
          color: var(--good);
          flex: 0 0 auto;
        }
        .spin {
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
