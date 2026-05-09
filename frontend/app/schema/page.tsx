"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  Key,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";

type ColumnInfo = { name: string; type: string; nullable: boolean };

type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primary_key: string[];
  row_count: number | null;
};

type Relationship = {
  source_table?: unknown;
  target_table?: unknown;
  source_columns?: unknown;
  target_columns?: unknown;
};

export default function SchemaPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [tableResponse, relationshipResponse] = await Promise.all([
        apiFetch<{ tables: TableInfo[] }>("/schema/tables"),
        apiFetch<{ relationships: Relationship[] }>("/schema/relationships"),
      ]);
      setTables(tableResponse.tables);
      setRelationships(relationshipResponse.relationships);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load schema");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredTables = useMemo(() => {
    if (!filter.trim()) return tables;
    const q = filter.trim().toLowerCase();
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(q) ||
        table.columns.some((column) => column.name.toLowerCase().includes(q)),
    );
  }, [tables, filter]);

  const totalColumns = useMemo(
    () => tables.reduce((sum, table) => sum + table.columns.length, 0),
    [tables],
  );

  function toggle(name: string) {
    setExpanded((current) => ({ ...current, [name]: !current[name] }));
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><Database size={12} /> Metadata</span>
          <h1>Schema Explorer</h1>
          <p>Inspect tables, columns, row counts, keys, and detected relationships across your active database.</p>
        </div>
        <div className="cluster">
          <Badge variant="info">{tables.length} tables</Badge>
          <Badge variant="neutral">{totalColumns} columns</Badge>
          <Badge variant="success">{relationships.length} relationships</Badge>
          <button className="button secondary" onClick={load} disabled={loading} type="button">
            <RefreshCw size={17} className={loading ? "spinning" : ""} />
            Reload
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="error" onClose={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="grid two">
        <section className="stack">
          <div className="input-group">
            <span className="input-group-icon"><Search size={15} /></span>
            <input
              className="input"
              placeholder="Search tables or columns…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          {loading ? (
            <SkeletonRows count={4} />
          ) : filteredTables.length === 0 ? (
            <EmptyState
              icon={<Table2 size={26} />}
              title={tables.length === 0 ? "No tables found" : "No matches"}
              description={tables.length === 0 ? "Connect a database in Settings to inspect its schema." : "Try a different search term."}
            />
          ) : (
            filteredTables.map((table) => {
              const isOpen = expanded[table.name] ?? false;
              return (
                <article className="panel flush" key={table.name}>
                  <button
                    className="schema-head"
                    onClick={() => toggle(table.name)}
                    type="button"
                    aria-expanded={isOpen}
                  >
                    <div className="schema-head-left">
                      <span className="action-card-icon"><Database size={16} /></span>
                      <div>
                        <strong>{table.name}</strong>
                        <p className="text-muted" style={{ fontSize: 12.5 }}>
                          {table.columns.length} columns · {table.row_count ?? "unknown"} rows
                        </p>
                      </div>
                    </div>
                    <div className="cluster">
                      {table.primary_key.length > 0 && (
                        <Badge variant="info"><Key size={12} /> {table.primary_key.join(", ")}</Badge>
                      )}
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="schema-body">
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Type</th>
                              <th>Nullable</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns.map((column) => {
                              const isPk = table.primary_key.includes(column.name);
                              return (
                                <tr key={column.name}>
                                  <td>
                                    <strong>{column.name}</strong>
                                  </td>
                                  <td className="mono text-soft">{column.type}</td>
                                  <td>
                                    {column.nullable ? (
                                      <Badge variant="neutral">nullable</Badge>
                                    ) : (
                                      <Badge variant="success">required</Badge>
                                    )}
                                  </td>
                                  <td>{isPk && <Badge variant="info"><Key size={12} /> primary key</Badge>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>Relationships</h2>
            <GitBranch size={18} className="text-soft" />
          </div>
          {loading ? (
            <SkeletonRows count={3} />
          ) : relationships.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={22} />}
              title="No relationships detected"
              description="The assistant works best when foreign keys are defined. Add foreign keys to enable join-aware answers."
            />
          ) : (
            <div className="metric-list">
              {relationships.map((rel, index) => (
                <div className="metric" key={index}>
                  <strong>
                    {String(rel.source_table)} <span className="text-muted">→</span> {String(rel.target_table)}
                  </strong>
                  <p className="mono">
                    {String(rel.source_columns)} references {String(rel.target_columns)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        .schema-head {
          width: 100%;
          background: transparent;
          border: 0;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }
        .schema-head:hover {
          background: var(--panel-soft);
        }
        .schema-head-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .schema-head-left strong {
          display: block;
          font-size: 14.5px;
        }
        .schema-body {
          padding: 0 18px 18px;
          border-top: 1px solid var(--line-soft);
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
