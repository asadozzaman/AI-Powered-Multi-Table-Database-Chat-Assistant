"use client";

import { FormEvent, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Check,
  Clock3,
  Copy,
  Database,
  DollarSign,
  GitBranch,
  Lightbulb,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

type ChatResponse = {
  history_id: number;
  direct_answer: string;
  explanation: string;
  important_numbers: Record<string, { min: number; max: number; sum: number }>;
  result_table: { columns: string[]; rows: Record<string, unknown>[] };
  chart: { type: string; x: string | null; y: string | null };
  business_insight: string;
  run_details?: {
    provider: string;
    model: string;
    token_usage: {
      input_tokens_estimate: number;
      output_tokens_estimate: number;
      schema_context_tokens_estimate: number;
      total_tokens_estimate: number;
      estimated: boolean;
    };
    estimated_cost_usd: number | null;
    pricing: {
      configured: boolean;
      input_cost_per_1m_tokens: number;
      output_cost_per_1m_tokens: number;
    };
    latency_ms: number;
    llm_calls: number;
    auto_fix_attempts: number;
    rows_returned: number;
    max_rows: number;
    execution_ok: boolean;
  };
  schema_sources?: {
    schema_hash: string;
    tables: string[];
    join_paths: { tables: string[]; joins: { condition: string }[] }[];
    chunks: { id: string; type: string; score: number; tables: string[] }[];
  };
  sql_safety_status?: {
    status: string;
    is_select_only: boolean;
    destructive_sql_blocked: boolean;
    multiple_statements_blocked: boolean;
    comments_blocked: boolean;
    identifiers_validated: boolean;
    limit_applied: boolean;
    max_limit_enforced: boolean;
    timeout_seconds: number;
    read_only_connection: boolean;
    used_tables: string[];
    error: string | null;
  };
  confidence?: {
    score: number;
    label: string;
    assumptions: string[];
  };
  follow_up_questions?: string[];
  sql?: string;
};

const SUGGESTIONS = [
  "What are total sales by city?",
  "Top 10 customers by revenue",
  "Monthly order trends this year",
  "Which products have the highest profit margin?",
];

const CHART_PALETTE = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ChatPage() {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function ask(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<ChatResponse>("/chat/ask", {
        method: "POST",
        body: JSON.stringify({ question: text.trim() }),
      });
      setAnswer(data);
      setFeedback(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await ask(question);
  }

  async function copySql() {
    if (!answer?.sql) return;
    try {
      await navigator.clipboard.writeText(answer.sql);
      setCopied(true);
      toast.success("SQL copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  const rowCount = answer?.result_table.rows.length ?? 0;
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function submitFeedback(rating: 1 | 5) {
    if (!answer?.history_id) return;
    const thumbs = rating === 5 ? "up" : "down";
    setFeedback(thumbs);
    try {
      await apiFetch(`/history/${answer.history_id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      toast.success(rating === 5 ? "Thanks for the positive feedback!" : "Thanks — we'll use this to improve answers.");
    } catch {
      setFeedback(null);
      toast.error("Could not save feedback");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow"><Sparkles size={12} /> Assistant</span>
          <h1>Chat Assistant</h1>
          <p>Ask business questions in plain language. The assistant generates safe SQL, runs it, and explains the answer.</p>
        </div>
        <div className="cluster">
          <Badge variant="info"><Sparkles size={12} /> Schema-RAG enabled</Badge>
        </div>
      </div>

      <div className="grid two">
        <section className="panel">
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label className="field-label" htmlFor="question">
                <Lightbulb size={14} /> Your question
              </label>
              <textarea
                id="question"
                className="textarea"
                placeholder="Try: What are total sales by city last quarter?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={loading}
                rows={4}
              />
              <span className="field-hint">
                Be specific about timeframes and metrics for the best results.
              </span>
            </div>

            <div className="cluster">
              <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>Try:</span>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setQuestion(suggestion);
                      ask(suggestion);
                    }}
                    disabled={loading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="cluster">
              <button className="button" type="submit" disabled={loading || !question.trim()}>
                {loading ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
                {loading ? "Asking the assistant..." : "Ask"}
              </button>
              {answer && !loading && (
                <button
                  className="button ghost sm"
                  type="button"
                  onClick={() => {
                    setAnswer(null);
                    setQuestion("");
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {error && (
            <div style={{ marginTop: 16 }}>
              <Alert variant="error" title="The assistant could not answer" onClose={() => setError("")}>
                {error}
              </Alert>
            </div>
          )}

          {answer && (
            <div className="stack" style={{ marginTop: 22 }}>
              <div className="answer-headline">
                <span className="action-card-icon"><Sparkles size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <strong>{answer.direct_answer}</strong>
                    {!feedback ? (
                      <div className="cluster" style={{ flexShrink: 0 }}>
                        <span className="text-muted" style={{ fontSize: 12 }}>Helpful?</span>
                        <button
                          className="icon-button"
                          onClick={() => submitFeedback(5)}
                          title="This answer was helpful"
                          type="button"
                          style={{ borderColor: "transparent" }}
                        >
                          <ThumbsUp size={15} />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          onClick={() => submitFeedback(1)}
                          title="This answer needs improvement"
                          type="button"
                          style={{ borderColor: "transparent" }}
                        >
                          <ThumbsDown size={15} />
                        </button>
                      </div>
                    ) : (
                      <Badge variant={feedback === "up" ? "success" : "neutral"}>
                        {feedback === "up" ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                        {feedback === "up" ? "Marked helpful" : "Feedback noted"}
                      </Badge>
                    )}
                  </div>
                  <p>{answer.explanation}</p>
                </div>
              </div>

              {answer.business_insight && (
                <Alert variant="info" title="Business insight">
                  {answer.business_insight}
                </Alert>
              )}

              {answer.confidence && (
                <div className="metadata-panel">
                  <div className="section-heading compact">
                    <h2>Confidence & Assumptions</h2>
                    <Badge variant={answer.confidence.score >= 0.8 ? "success" : "warning"}>
                      {answer.confidence.label} - {Math.round(answer.confidence.score * 100)}%
                    </Badge>
                  </div>
                  <ul className="compact-list">
                    {answer.confidence.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {answer.sql && (
                <div>
                  <div className="cluster" style={{ marginBottom: 8, justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 13 }}>Generated SQL</strong>
                    <Badge variant="neutral">Read-only - validated</Badge>
                  </div>
                  <div className="sql-block">
                    <button className="sql-copy" onClick={copySql} type="button">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <pre>{answer.sql}</pre>
                  </div>
                </div>
              )}

              {answer.sql_safety_status && (
                <SqlSafetyStatus status={answer.sql_safety_status} />
              )}

              {answer.schema_sources && (
                <SchemaSources sources={answer.schema_sources} />
              )}

              <div>
                <div className="cluster" style={{ marginBottom: 8, justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 13 }}>Result table</strong>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>{rowCount} {rowCount === 1 ? "row" : "rows"}</span>
                </div>
                <ResultTable result={answer.result_table} />
              </div>

              {answer.follow_up_questions && answer.follow_up_questions.length > 0 && (
                <div className="metadata-panel">
                  <div className="section-heading compact">
                    <h2>Follow-Up Questions</h2>
                    <Lightbulb size={17} className="text-soft" />
                  </div>
                  <div className="follow-up-grid">
                    {answer.follow_up_questions.map((item) => (
                      <button
                        className="follow-up-button"
                        key={item}
                        onClick={() => {
                          setQuestion(item);
                          ask(item);
                        }}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!answer && !loading && !error && (
            <div style={{ marginTop: 22 }}>
              <EmptyState
                icon={<Sparkles size={26} />}
                title="Ready when you are"
                description="Ask a question above. Results will appear here with a chart, summary, and the SQL the assistant ran."
              />
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-heading">
            <h2>Chart View</h2>
            <BarChart3 size={18} className="text-soft" />
          </div>
          {answer ? (
            <Chart response={answer} />
          ) : (
            <EmptyState
              icon={<BarChart3 size={22} />}
              title="No chart yet"
              description="Run a question to see a chart-ready breakdown of the result."
            />
          )}

          <div className="section-heading" style={{ marginTop: 22 }}>
            <h2>Important Numbers</h2>
            <TrendingUp size={18} className="text-soft" />
          </div>
          {answer && Object.entries(answer.important_numbers).length > 0 ? (
            <div className="metric-list">
              {Object.entries(answer.important_numbers).map(([key, value]) => (
                <div className="metric" key={key}>
                  <strong>{key}</strong>
                  <div className="metric-row">
                    <span>Min <strong>{formatMetric(value.min)}</strong></span>
                    <span>Max <strong>{formatMetric(value.max)}</strong></span>
                    <span>Sum <strong>{formatMetric(value.sum)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>No numeric metrics yet.</p>
          )}

          {answer?.run_details && (
            <RunDetails details={answer.run_details} />
          )}
        </aside>
      </div>

      <style jsx>{`
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

function RunDetails({ details }: { details: NonNullable<ChatResponse["run_details"]> }) {
  return (
    <div className="metadata-panel run-details">
      <div className="section-heading compact">
        <h2>Run Details</h2>
        <Badge variant={details.execution_ok ? "success" : "danger"}>
          {details.execution_ok ? "Completed" : "Failed"}
        </Badge>
      </div>
      <div className="detail-grid">
        <Detail icon={<Sparkles size={15} />} label="Model" value={`${details.provider} - ${details.model}`} />
        <Detail icon={<Clock3 size={15} />} label="Latency" value={`${details.latency_ms} ms`} />
        <Detail icon={<Table2 size={15} />} label="Rows" value={`${details.rows_returned} / ${details.max_rows}`} />
        <Detail icon={<RefreshIcon />} label="Auto-fix" value={`${details.auto_fix_attempts}`} />
        <Detail icon={<Database size={15} />} label="Schema tokens" value={String(details.token_usage.schema_context_tokens_estimate)} />
        <Detail icon={<Sparkles size={15} />} label="Total tokens" value={`${details.token_usage.total_tokens_estimate} est.`} />
        <Detail
          icon={<DollarSign size={15} />}
          label="Estimated cost"
          value={details.estimated_cost_usd === null ? "Configure pricing" : `$${details.estimated_cost_usd.toFixed(6)}`}
        />
        <Detail icon={<GitBranch size={15} />} label="LLM calls" value={String(details.llm_calls)} />
      </div>
      {!details.pricing.configured && (
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Set LLM_INPUT_COST_PER_1M_TOKENS and LLM_OUTPUT_COST_PER_1M_TOKENS to calculate dollar cost.
        </p>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="detail-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RefreshIcon() {
  return <Loader2 size={15} />;
}

function SqlSafetyStatus({ status }: { status: NonNullable<ChatResponse["sql_safety_status"]> }) {
  const checks = [
    ["SELECT only", status.is_select_only],
    ["Destructive SQL blocked", status.destructive_sql_blocked],
    ["Single statement", status.multiple_statements_blocked],
    ["Comments blocked", status.comments_blocked],
    ["Identifiers validated", status.identifiers_validated],
    ["Read-only connection", status.read_only_connection],
    ["Timeout enforced", status.timeout_seconds > 0],
    ["Limit applied", status.limit_applied || status.max_limit_enforced],
  ];
  return (
    <div className="metadata-panel">
      <div className="section-heading compact">
        <h2>SQL Safety Status</h2>
        <Badge variant={status.status === "passed" ? "success" : "danger"}>
          <ShieldCheck size={12} /> {status.status}
        </Badge>
      </div>
      <div className="safety-grid">
        {checks.map(([label, passed]) => (
          <span className={passed ? "safety-check passed" : "safety-check muted"} key={String(label)}>
            {passed ? "OK" : "-"} {label}
          </span>
        ))}
      </div>
      {status.used_tables.length > 0 && (
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Used tables: {status.used_tables.join(", ")}
        </p>
      )}
    </div>
  );
}

function SchemaSources({ sources }: { sources: NonNullable<ChatResponse["schema_sources"]> }) {
  return (
    <div className="metadata-panel">
      <div className="section-heading compact">
        <h2>Schema Sources Used</h2>
        <Badge variant="neutral">{sources.schema_hash.slice(0, 12)}</Badge>
      </div>
      <div className="source-tags">
        {sources.tables.length > 0 ? sources.tables.map((table) => <span key={table}>{table}</span>) : <span>No table source detected</span>}
      </div>
      {sources.join_paths.length > 0 && (
        <div className="join-paths">
          {sources.join_paths.map((path, index) => (
            <div className="join-path" key={`${path.tables.join("-")}-${index}`}>
              <strong>{path.tables.join(" -> ")}</strong>
              {path.joins.map((join) => (
                <p key={join.condition}>{join.condition}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {sources.chunks.length > 0 && (
        <details className="source-details">
          <summary>Retrieved schema chunks</summary>
          <div className="chunk-list">
            {sources.chunks.map((chunk) => (
              <div key={chunk.id}>
                <strong>{chunk.type}</strong>
                <span>{chunk.tables.join(", ") || "general"} - score {chunk.score}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function formatMetric(value: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function ResultTable({ result }: { result: ChatResponse["result_table"] }) {
  if (!result.rows.length)
    return (
      <EmptyState
        icon={<Table2 size={22} />}
        title="No rows returned"
        description="The query ran successfully but produced an empty result set."
      />
    );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index}>
              {result.columns.map((column) => (
                <td key={column}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chart({ response }: { response: ChatResponse }) {
  const rows = response.result_table.rows;
  const { x, y, type } = response.chart;
  if (!x || !y || rows.length === 0) {
    return (
      <EmptyState
        icon={<Table2 size={22} />}
        title="Table view fits best"
        description="This result doesn't have an obvious chart shape - see the table below for full detail."
      />
    );
  }
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie dataKey={y} nameKey={x} data={rows} innerRadius={50} outerRadius={95} paddingAngle={2}>
            {rows.map((_, index) => (
              <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
              fontSize: 12.5,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f0" vertical={false} />
        <XAxis dataKey={x} tick={{ fontSize: 11.5, fill: "#64748b" }} axisLine={{ stroke: "#e3e8f0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11.5, fill: "#64748b" }} axisLine={{ stroke: "#e3e8f0" }} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            fontSize: 12.5,
          }}
        />
        <Bar dataKey={y} fill="url(#barFill)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
