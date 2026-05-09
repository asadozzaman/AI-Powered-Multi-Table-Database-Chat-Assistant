"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  GitBranch,
  History,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table2,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";

type CurrentUser = {
  email: string;
  role: string;
  full_name: string | null;
};

type DatabaseStatus = {
  configured_connections: number;
  default_target_from_env: boolean;
  app_env: string;
};

type TableInfo = {
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
  primary_key: string[];
  foreign_keys?: unknown[];
  row_count: number | null;
};

type VersionInfo = {
  schema_hash: string;
  is_active: boolean;
  changes: Record<string, unknown> | null;
  created_at: string;
};

type HistoryRow = {
  id: number;
  question: string;
  status: string;
  created_at: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [relationships, setRelationships] = useState<unknown[]>([]);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setError("");
    setLoading(true);
    try {
      const [me, dbStatus, schemaTables, schemaRelationships, schemaVersions, queryHistory] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<DatabaseStatus>("/database/status"),
        apiFetch<{ tables: TableInfo[] }>("/schema/tables"),
        apiFetch<{ relationships: unknown[] }>("/schema/relationships"),
        apiFetch<VersionInfo[]>("/schema/versions"),
        apiFetch<HistoryRow[]>("/history/queries"),
      ]);
      setUser(me);
      setStatus(dbStatus);
      setTables(schemaTables.tables);
      setRelationships(schemaRelationships.relationships);
      setVersions(schemaVersions);
      setHistory(queryHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalColumns = useMemo(
    () => tables.reduce((total, table) => total + table.columns.length, 0),
    [tables],
  );
  const totalRows = useMemo(
    () => tables.reduce((total, table) => total + (typeof table.row_count === "number" ? table.row_count : 0), 0),
    [tables],
  );
  const latestVersion = versions[0];
  const successfulQueries = history.filter((row) => row.status === "success").length;
  const failedQueries = history.length - successfulQueries;
  const successRate = history.length === 0 ? 0 : Math.round((successfulQueries / history.length) * 100);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={12} /> Operations
          </span>
          <h1>Welcome back{user?.full_name ? `, ${user.full_name}` : ""}</h1>
          <p>Live overview of your connected database, schema knowledge, query activity, and safety controls.</p>
        </div>
        <button className="button secondary" onClick={loadDashboard} type="button" disabled={loading}>
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 18 }}>
          <Alert variant="error" title="Could not load dashboard" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      <section className="overview-band">
        <div>
          <span className="eyebrow">Signed in</span>
          <h2>{user?.email ?? (loading ? "Loading account…" : "Not signed in")}</h2>
          <p>
            Role: <strong style={{ color: "var(--text)" }}>{user?.role ?? "unknown"}</strong> · Environment:{" "}
            <strong style={{ color: "var(--text)" }}>{status?.app_env ?? "unknown"}</strong>
          </p>
        </div>
        <div className="status-stack">
          <Badge variant="success"><Lock size={12} /> Read-only SQL</Badge>
          <Badge variant="info"><Database size={12} /> Schema-RAG</Badge>
          {successRate >= 90 && history.length > 3 && (
            <Badge variant="success"><CheckCircle2 size={12} /> {successRate}% query success</Badge>
          )}
        </div>
      </section>

      <section className="kpi-grid">
        {loading ? (
          <>
            <Skeleton variant="block" height={94} />
            <Skeleton variant="block" height={94} />
            <Skeleton variant="block" height={94} />
            <Skeleton variant="block" height={94} />
          </>
        ) : (
          <>
            <Kpi
              icon={<Database size={20} />}
              label="Connections"
              value={formatNumber(status?.configured_connections ?? 0)}
              detail="Configured target databases"
            />
            <Kpi
              icon={<Table2 size={20} />}
              label="Tables"
              value={formatNumber(tables.length)}
              detail={`${formatNumber(totalColumns)} inspected columns`}
            />
            <Kpi
              icon={<GitBranch size={20} />}
              label="Relationships"
              value={formatNumber(relationships.length)}
              detail="Foreign-key graph edges"
            />
            <Kpi
              icon={<History size={20} />}
              label="Queries"
              value={formatNumber(history.length)}
              detail={`${formatNumber(successfulQueries)} successful · ${formatNumber(failedQueries)} failed`}
            />
          </>
        )}
      </section>

      <div className="grid two">
        <section className="panel">
          <div className="section-heading">
            <h2>Schema Health</h2>
            <Link href="/schema">
              Explore schema <ArrowRight size={14} />
            </Link>
          </div>
          <div className="info-list">
            <InfoRow
              label="Active schema hash"
              value={latestVersion?.schema_hash.slice(0, 16) ?? "Not generated"}
              mono
            />
            <InfoRow
              label="Last refresh"
              value={latestVersion ? timeAgo(latestVersion.created_at) : "Never"}
            />
            <InfoRow label="Known row estimate" value={formatNumber(totalRows)} />
            <InfoRow
              label="Default target from env"
              value={status?.default_target_from_env ? "Configured" : "Not configured"}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th className="text-right">Rows</th>
                  <th className="text-right">Columns</th>
                  <th>Primary Key</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4}><Skeleton variant="line" /></td>
                      </tr>
                    ))
                  : tables.slice(0, 8).map((table) => (
                      <tr key={table.name}>
                        <td><strong>{table.name}</strong></td>
                        <td className="text-right">{table.row_count !== null ? formatNumber(table.row_count) : "—"}</td>
                        <td className="text-right">{table.columns.length}</td>
                        <td className="mono text-soft">{table.primary_key.join(", ") || "—"}</td>
                      </tr>
                    ))}
                {!loading && tables.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={<Table2 size={26} />}
                        title="No tables inspected yet"
                        description="Connect a database in Settings or refresh schema metadata in the Admin panel."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>Production Guardrails</h2>
            <ShieldCheck size={18} className="text-soft" />
          </div>
          <div className="guardrail-list">
            <Guardrail
              icon={<Lock size={18} />}
              title="SQL safety"
              text="Only validated SELECT queries run in chat mode. Destructive statements, comments, and multi-statement payloads are blocked."
            />
            <Guardrail
              icon={<Database size={18} />}
              title="Schema-RAG"
              text="Schema chunks regenerate when the database changes, so the assistant stays accurate without depending on a fixed table."
            />
            <Guardrail
              icon={<GitBranch size={18} />}
              title="Join graph"
              text="Foreign keys become a relationship graph that builds join context for multi-table questions."
            />
            <Guardrail
              icon={<Activity size={18} />}
              title="Audit trail"
              text="Questions, SQL, results, status, and feedback are saved for review and improvement."
            />
          </div>
        </aside>
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="section-heading">
            <h2>Recent Questions</h2>
            <Link href="/history">
              View history <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="stack">
              <Skeleton variant="block" />
              <Skeleton variant="block" />
              <Skeleton variant="block" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<Bot size={24} />}
              title="No questions asked yet"
              description="Ask the assistant a business question to get a chart-ready answer with grounded SQL."
              action={
                <Link className="button sm" href="/chat">
                  Try the assistant <ArrowRight size={14} />
                </Link>
              }
            />
          ) : (
            <div className="activity-list">
              {history.slice(0, 5).map((row) => {
                const success = row.status === "success";
                return (
                  <div className="activity-row" key={row.id}>
                    <span className="activity-icon" style={{ background: success ? "var(--good-soft)" : "var(--danger-soft)", color: success ? "var(--good)" : "var(--danger)" }}>
                      {success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong title={row.question}>{row.question}</strong>
                      <p>
                        <Badge variant={success ? "success" : "danger"}>{row.status}</Badge>{" "}
                        <span className="text-muted">· {timeAgo(row.created_at)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>Suggested Next Actions</h2>
          </div>
          <div className="action-grid">
            <ActionCard href="/chat" icon={<Bot size={18} />} label="Ask a business question" />
            <ActionCard href="/data" icon={<Table2 size={18} />} label="Manage table data" />
            <ActionCard href="/admin" icon={<RefreshCw size={18} />} label="Refresh schema metadata" />
            <ActionCard href="/settings" icon={<Database size={18} />} label="Review database connections" />
          </div>
        </aside>
      </div>

      <style jsx>{`
        .spinning {
          animation: spin 1s linear infinite;
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

function Kpi({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        <p className="kpi-detail">{detail}</p>
      </div>
    </article>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

function Guardrail({ icon, text, title }: { icon: React.ReactNode; text: string; title: string }) {
  return (
    <div className="guardrail">
      <span className="guardrail-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function ActionCard({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link className="action-card" href={href}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        <span className="action-card-icon">{icon}</span>
        {label}
      </span>
      <ArrowRight size={16} />
    </Link>
  );
}
