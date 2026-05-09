"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Database,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
};

type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primary_key: string[];
  row_count: number | null;
};

type RowsResponse = {
  table: string;
  columns: ColumnInfo[];
  primary_key: string[];
  rows: Record<string, unknown>[];
  total: number | null;
};

type CurrentUser = {
  email: string;
  role: string;
};

export default function DataPage() {
  const toast = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [rowsData, setRowsData] = useState<RowsResponse | null>(null);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState("");
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [tableFilter, setTableFilter] = useState("");
  const [rowFilter, setRowFilter] = useState("");
  const [error, setError] = useState("");
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === "admin";

  const filteredTables = useMemo(() => {
    if (!tableFilter.trim()) return tables;
    const q = tableFilter.trim().toLowerCase();
    return tables.filter((table) => table.name.toLowerCase().includes(q));
  }, [tables, tableFilter]);

  const filteredRows = useMemo(() => {
    if (!rowsData) return [];
    if (!rowFilter.trim()) return rowsData.rows;
    const q = rowFilter.trim().toLowerCase();
    return rowsData.rows.filter((row) =>
      rowsData.columns.some((column) => String(row[column.name] ?? "").toLowerCase().includes(q)),
    );
  }, [rowsData, rowFilter]);

  async function loadTables(initial = false) {
    if (initial) setLoadingTables(true);
    try {
      const [me, tableResponse] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<{ tables: TableInfo[] }>("/data/tables"),
      ]);
      setUser(me);
      setTables(tableResponse.tables);
      const nextTable = selectedTable || tableResponse.tables[0]?.name || "";
      setSelectedTable(nextTable);
      if (nextTable) await loadRows(nextTable);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load data";
      setError(message);
      toast.error(message);
    } finally {
      if (initial) setLoadingTables(false);
    }
  }

  async function loadRows(tableName = selectedTable) {
    if (!tableName) return;
    setLoadingRows(true);
    try {
      const response = await apiFetch<RowsResponse>(`/data/${encodeURIComponent(tableName)}/rows?limit=100`);
      setRowsData(response);
      setCreateValues(emptyValues(response.columns));
      setEditingKey("");
      setEditValues({});
      setRowFilter("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load rows";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingRows(false);
    }
  }

  async function createRow(event: FormEvent) {
    event.preventDefault();
    if (!selectedTable) return;
    setCreating(true);
    setError("");
    try {
      await apiFetch(`/data/${encodeURIComponent(selectedTable)}/rows`, {
        method: "POST",
        body: JSON.stringify({ values: nonEmptyValues(createValues) }),
      });
      toast.success(`Row added to ${selectedTable}.`);
      await loadRows();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function updateRow(row: Record<string, unknown>) {
    if (!selectedTable || !rowsData) return;
    setError("");
    try {
      await apiFetch(`/data/${encodeURIComponent(selectedTable)}/rows`, {
        method: "PATCH",
        body: JSON.stringify({ pk: primaryKey(row, rowsData.primary_key), values: editValues }),
      });
      toast.success("Row updated.");
      await loadRows();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      toast.error(message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !selectedTable || !rowsData) return;
    setDeleting(true);
    setError("");
    try {
      await apiFetch(`/data/${encodeURIComponent(selectedTable)}/rows`, {
        method: "DELETE",
        body: JSON.stringify({ pk: primaryKey(deleteTarget, rowsData.primary_key) }),
      });
      toast.success("Row deleted.");
      setDeleteTarget(null);
      await loadRows();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    loadTables(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><Database size={12} /> Data</span>
          <h1>Data Manager</h1>
          <p>Browse every inspected table and manage rows from one place. Admin actions are read-only for non-admins.</p>
        </div>
        <div className="cluster">
          {!isAdmin && (
            <Badge variant="warning"><Lock size={12} /> Read-only access</Badge>
          )}
          <button className="button secondary" onClick={() => loadRows()} type="button" disabled={loadingRows || !selectedTable}>
            <RefreshCw size={17} className={loadingRows ? "spinning" : ""} />
            Reload Rows
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="error" onClose={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="grid two">
        <aside className="panel">
          <div className="section-heading">
            <h2>Tables</h2>
            <Badge variant="neutral">{tables.length}</Badge>
          </div>
          <div className="input-group" style={{ marginBottom: 12 }}>
            <span className="input-group-icon"><Search size={15} /></span>
            <input
              className="input"
              placeholder="Search tables…"
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
            />
          </div>
          {loadingTables ? (
            <SkeletonRows count={5} />
          ) : filteredTables.length === 0 ? (
            <EmptyState
              icon={<Table2 size={22} />}
              title={tables.length === 0 ? "No tables found" : "No matches"}
              description={tables.length === 0 ? "Connect a database in Settings to start." : "Try a different search term."}
            />
          ) : (
            <div className="table-list">
              {filteredTables.map((table) => (
                <button
                  className={table.name === selectedTable ? "table-picker active" : "table-picker"}
                  key={table.name}
                  onClick={() => {
                    setSelectedTable(table.name);
                    loadRows(table.name);
                  }}
                  type="button"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Table2 size={15} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {table.name}
                    </span>
                  </span>
                  <small>{table.row_count ?? 0} rows</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="panel">
          <div className="page-header" style={{ marginBottom: 18 }}>
            <div>
              <h2>{selectedTable || "Select a table"}</h2>
              <p style={{ marginTop: 4 }}>
                {rowsData?.total ?? 0} total rows · PK:{" "}
                <span className="mono">{rowsData?.primary_key.join(", ") || "none"}</span>
              </p>
            </div>
            {rowsData && rowsData.rows.length > 0 && (
              <div className="input-group" style={{ minWidth: 240 }}>
                <span className="input-group-icon"><Search size={15} /></span>
                <input
                  className="input"
                  placeholder="Filter rows…"
                  value={rowFilter}
                  onChange={(event) => setRowFilter(event.target.value)}
                />
              </div>
            )}
          </div>

          {isAdmin && rowsData && (
            <form className="crud-form" onSubmit={createRow}>
              <h3><Plus size={16} /> Create new row</h3>
              <div className="field-grid">
                {rowsData.columns.map((column) => (
                  <label key={column.name}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{column.name}</span>
                      <span className="text-muted mono" style={{ fontSize: 11 }}>{column.type}</span>
                    </span>
                    <input
                      className="input"
                      onChange={(event) => setCreateValues({ ...createValues, [column.name]: event.target.value })}
                      placeholder={column.nullable ? "Optional" : "Required"}
                      value={createValues[column.name] ?? ""}
                    />
                  </label>
                ))}
              </div>
              <div>
                <button className="button" type="submit" disabled={creating}>
                  <Plus size={17} />
                  {creating ? "Adding…" : "Add Row"}
                </button>
              </div>
            </form>
          )}

          {loadingRows ? (
            <SkeletonRows count={4} />
          ) : !rowsData || !selectedTable ? (
            <EmptyState
              icon={<Table2 size={26} />}
              title="Select a table"
              description="Pick a table from the list to start browsing rows."
            />
          ) : rowsData.rows.length === 0 ? (
            <EmptyState
              icon={<Table2 size={26} />}
              title="This table is empty"
              description={isAdmin ? "Use the form above to add the first row." : "Ask an admin to seed this table."}
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No rows match your filter"
              description="Try a different search term to widen the result."
            />
          ) : (
            <RowsTable
              data={{ ...rowsData, rows: filteredRows }}
              editingKey={editingKey}
              editValues={editValues}
              isAdmin={isAdmin}
              onDelete={(row) => setDeleteTarget(row)}
              onEditStart={(row) => {
                setEditingKey(rowKey(row, rowsData.primary_key));
                setEditValues(stringValues(row, rowsData.columns));
              }}
              onEditCancel={() => {
                setEditingKey("");
                setEditValues({});
              }}
              onEditValue={(column, value) => setEditValues({ ...editValues, [column]: value })}
              onSave={updateRow}
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this row?"
        description="This action cannot be undone. The row will be permanently removed from the table."
        confirmLabel="Delete row"
        destructive
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

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

function RowsTable({
  data,
  editingKey,
  editValues,
  isAdmin,
  onDelete,
  onEditCancel,
  onEditStart,
  onEditValue,
  onSave,
}: {
  data: RowsResponse;
  editingKey: string;
  editValues: Record<string, string>;
  isAdmin: boolean;
  onDelete: (row: Record<string, unknown>) => void;
  onEditCancel: () => void;
  onEditStart: (row: Record<string, unknown>) => void;
  onEditValue: (column: string, value: string) => void;
  onSave: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {data.columns.map((column) => (
              <th key={column.name}>
                {column.name}
                {data.primary_key.includes(column.name) && (
                  <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 10 }}>PK</span>
                )}
              </th>
            ))}
            {isAdmin && <th style={{ width: 100 }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => {
            const key = rowKey(row, data.primary_key);
            const isEditing = key === editingKey;
            return (
              <tr key={key}>
                {data.columns.map((column) => {
                  const isPk = data.primary_key.includes(column.name);
                  return (
                    <td key={column.name}>
                      {isEditing && !isPk ? (
                        <input
                          className="compact-input"
                          onChange={(event) => onEditValue(column.name, event.target.value)}
                          value={editValues[column.name] ?? ""}
                        />
                      ) : (
                        <span className={isPk ? "mono" : undefined}>
                          {String(row[column.name] ?? "")}
                        </span>
                      )}
                    </td>
                  );
                })}
                {isAdmin && (
                  <td>
                    {isEditing ? (
                      <div className="row-actions">
                        <button className="icon-button" onClick={() => onSave(row)} title="Save" type="button">
                          <Check size={15} />
                        </button>
                        <button className="icon-button" onClick={onEditCancel} title="Cancel" type="button">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button className="icon-button" onClick={() => onEditStart(row)} title="Edit" type="button">
                          <Pencil size={14} />
                        </button>
                        <button className="icon-button danger-icon" onClick={() => onDelete(row)} title="Delete" type="button">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function emptyValues(columns: ColumnInfo[]) {
  return Object.fromEntries(columns.map((column) => [column.name, ""]));
}

function stringValues(row: Record<string, unknown>, columns: ColumnInfo[]) {
  return Object.fromEntries(columns.map((column) => [column.name, String(row[column.name] ?? "")]));
}

function nonEmptyValues(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
}

function primaryKey(row: Record<string, unknown>, primaryKeyColumns: string[]) {
  return Object.fromEntries(primaryKeyColumns.map((column) => [column, row[column]]));
}

function rowKey(row: Record<string, unknown>, primaryKeyColumns: string[]) {
  if (primaryKeyColumns.length === 0) return JSON.stringify(row);
  return primaryKeyColumns.map((column) => `${column}:${String(row[column] ?? "")}`).join("|");
}
