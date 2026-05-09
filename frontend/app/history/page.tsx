"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Code2, Copy, History as HistoryIcon, RefreshCw, Search, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type HistoryRow = {
  id: number;
  question: string;
  status: string;
  created_at: string;
  sql?: string;
};

type StatusFilter = "all" | "success" | "failed";

export default function HistoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      setRows(await apiFetch<HistoryRow[]>("/history/queries"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter === "success" && row.status !== "success") return false;
      if (statusFilter === "failed" && row.status === "success") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!row.question.toLowerCase().includes(q) && !(row.sql ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const successCount = rows.filter((row) => row.status === "success").length;
  const failedCount = rows.length - successCount;

  async function copySql(sql: string) {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("SQL copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><HistoryIcon size={12} /> Audit</span>
          <h1>Query History</h1>
          <p>Review every saved question, the SQL the assistant generated, and the outcome.</p>
        </div>
        <button className="button secondary" onClick={load} disabled={loading} type="button">
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="error" onClose={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="cluster" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <div className="cluster">
          <Badge variant="neutral">{rows.length} total</Badge>
          <Badge variant="success">{successCount} success</Badge>
          {failedCount > 0 && <Badge variant="danger">{failedCount} failed</Badge>}
        </div>
        <div className="cluster">
          <div className="input-group" style={{ minWidth: 280 }}>
            <span className="input-group-icon"><Search size={15} /></span>
            <input
              className="input"
              placeholder="Search question or SQL…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter-tabs">
            <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")} type="button">
              All
            </button>
            <button className={statusFilter === "success" ? "active" : ""} onClick={() => setStatusFilter("success")} type="button">
              Success
            </button>
            <button className={statusFilter === "failed" ? "active" : ""} onClick={() => setStatusFilter("failed")} type="button">
              Failed
            </button>
          </div>
        </div>
      </div>

      <section className="panel flush">
        {loading ? (
          <div style={{ padding: 22, display: "grid", gap: 10 }}>
            <Skeleton variant="block" />
            <Skeleton variant="block" />
            <Skeleton variant="block" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 22 }}>
            <EmptyState
              icon={<HistoryIcon size={26} />}
              title={rows.length === 0 ? "No queries yet" : "No matches"}
              description={
                rows.length === 0
                  ? "Once you ask the chat assistant a question, it will be recorded here."
                  : "Adjust the filter or search term to widen results."
              }
            />
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>SQL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const success = row.status === "success";
                  const isOpen = openId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td className="text-muted">{row.id}</td>
                        <td>
                          <strong style={{ fontWeight: 600 }}>{row.question}</strong>
                        </td>
                        <td>
                          {success ? (
                            <Badge variant="success"><CheckCircle2 size={12} /> Success</Badge>
                          ) : (
                            <Badge variant="danger"><XCircle size={12} /> {row.status}</Badge>
                          )}
                        </td>
                        <td className="text-soft">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Clock size={13} />
                            {new Date(row.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          {row.sql ? (
                            <button
                              className="button ghost sm"
                              onClick={() => setOpenId(isOpen ? null : row.id)}
                              type="button"
                            >
                              <Code2 size={14} />
                              {isOpen ? "Hide" : "View"}
                            </button>
                          ) : (
                            <span className="text-muted">Hidden</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && row.sql && (
                        <tr>
                          <td colSpan={5} style={{ background: "var(--panel-soft)" }}>
                            <div className="sql-block" style={{ margin: 4 }}>
                              <button className="sql-copy" onClick={() => copySql(row.sql!)} type="button">
                                <Copy size={12} /> Copy
                              </button>
                              <pre>{row.sql}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .filter-tabs {
          display: inline-flex;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 3px;
          gap: 2px;
        }
        .filter-tabs button {
          background: transparent;
          border: 0;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-soft);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-tabs button:hover {
          color: var(--text);
          background: var(--bg-soft);
        }
        .filter-tabs button.active {
          background: var(--accent-soft);
          color: var(--accent-hover);
        }
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
