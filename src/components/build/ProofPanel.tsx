"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  addProof,
  deleteProof,
  loadProofs,
} from "@/lib/actions/proof";
import {
  IMAGE_MIME_ALLOWLIST,
  FILE_MIME_ALLOWLIST,
  PROOF_TITLE_MAX,
  type ProofItem,
  type ProofType,
} from "@/lib/build/proofTypes";

export interface ProofPanelTask {
  id: string;
  title: string;
  stage: string;
}

interface ProofPanelProps {
  projectId: string;
  tasks: ProofPanelTask[];
}

const TYPE_META: Record<ProofType, { labelKey: string; icon: string }> = {
  url: { labelKey: "proofTypeUrl", icon: "🔗" },
  image: { labelKey: "proofTypeImage", icon: "🖼️" },
  file: { labelKey: "proofTypeFile", icon: "📄" },
  note: { labelKey: "proofTypeNote", icon: "📝" },
};

// Lazily-loaded proof-of-work panel: a timeline of real evidence plus an add
// action. Proofs are fetched on mount (this component itself is dynamically
// imported, so nothing loads until the panel is opened).
export function ProofPanel({ projectId, tasks }: ProofPanelProps) {
  const t = useTranslations("build");
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [proofs, setProofs] = useState<ProofItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProofs(projectId).then((res) => {
      if (cancelled) return;
      setAvailable(res.available);
      setProofs(res.proofs);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {t("proofTitle")}
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full border border-border bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-white"
        >
          + {t("proofAdd")}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-ink-muted">…</p>
      ) : !available ? (
        <p className="text-xs tracking-tight text-ink-secondary">{t("proofUnavailable")}</p>
      ) : proofs.length === 0 ? (
        <p className="text-xs italic tracking-tight text-ink-muted">{t("proofEmpty")}</p>
      ) : (
        <ProofTimeline
          proofs={proofs}
          onDeleted={(id) => setProofs((prev) => prev.filter((p) => p.id !== id))}
        />
      )}

      {modalOpen && (
        <ProofModal
          projectId={projectId}
          tasks={tasks}
          onClose={() => setModalOpen(false)}
          onAdded={(proof) => {
            setProofs((prev) => [proof, ...prev]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ProofTimeline({
  proofs,
  onDeleted,
}: {
  proofs: ProofItem[];
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("build");
  const locale = useLocale();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
  });

  function handleDelete(id: string) {
    if (isDeleting) return;
    setPendingId(id);
    startDeleting(async () => {
      const res = await deleteProof(id);
      setPendingId(null);
      if (!res.error) onDeleted(id);
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {proofs.map((proof) => {
        const meta = TYPE_META[proof.type];
        return (
          <li
            key={proof.id}
            className="flex gap-2.5 rounded-xl border border-border/50 bg-white/60 px-3 py-2"
          >
            {proof.type === "image" && proof.fileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.fileUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-base" aria-hidden>
                {meta.icon}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  {fmt.format(new Date(proof.createdAt))}
                </span>
                <span className="text-[10px] text-ink-muted" aria-hidden>·</span>
                <span className="text-[10px] font-semibold text-ink-muted">{t(meta.labelKey as Parameters<typeof t>[0])}</span>
              </div>
              <span className="truncate text-[13px] font-semibold text-ink">{proof.title}</span>
              {proof.description && (
                <span className="line-clamp-2 text-[11px] text-ink-secondary">{proof.description}</span>
              )}
              <div className="mt-0.5 flex items-center gap-3">
                {(proof.linkUrl || proof.fileUrl) && (
                  <a
                    href={proof.linkUrl ?? proof.fileUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    {proof.type === "file" ? t("proofDownload") : t("proofOpen")}
                  </a>
                )}
                <button
                  type="button"
                  disabled={isDeleting && pendingId === proof.id}
                  onClick={() => handleDelete(proof.id)}
                  className="text-[11px] font-semibold text-ink-muted transition-colors hover:text-danger disabled:opacity-50"
                >
                  {t("proofDelete")}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ProofModal({
  projectId,
  tasks,
  onClose,
  onAdded,
}: {
  projectId: string;
  tasks: ProofPanelTask[];
  onClose: () => void;
  onAdded: (proof: ProofItem) => void;
}) {
  const t = useTranslations("build");
  const [type, setType] = useState<ProofType>("url");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const accept =
    type === "image" ? IMAGE_MIME_ALLOWLIST.join(",") : FILE_MIME_ALLOWLIST.join(",");

  function handleSubmit() {
    if (isSaving) return;
    setError(null);
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("type", type);
    form.set("title", title);
    form.set("description", description);
    form.set("url", url);
    if (taskId) {
      form.set("taskId", taskId);
      const task = tasks.find((tk) => tk.id === taskId);
      if (task) form.set("stage", task.stage);
    }
    const file = fileRef.current?.files?.[0];
    if ((type === "image" || type === "file") && file) {
      form.set("file", file);
    }
    startSaving(async () => {
      const res = await addProof(form);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.proof) onAdded(res.proof);
    });
  }

  const types: ProofType[] = ["url", "image", "file", "note"];

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={t("assistantClose")}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,15,23,0.45)]"
      />
      <div className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight text-ink">{t("proofAddTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("assistantClose")}
            className="rounded-full px-2 py-1 text-ink-muted transition-colors hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* Type selector */}
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {types.map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => {
                setType(tp);
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                type === tp
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-white text-ink-secondary hover:bg-surface-hover"
              )}
            >
              <span aria-hidden>{TYPE_META[tp].icon}</span>
              {t(TYPE_META[tp].labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-secondary">{t("proofFieldTitle")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={PROOF_TITLE_MAX}
              placeholder={t("proofFieldTitlePlaceholder")}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          {type === "url" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-secondary">{t("proofFieldUrl")}</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                placeholder="https://"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
          )}

          {(type === "image" || type === "file") && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-secondary">
                {type === "image" ? t("proofFieldImage") : t("proofFieldFile")}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="text-xs text-ink-secondary file:mr-3 file:rounded-full file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-secondary"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-secondary">
              {type === "note" ? t("proofFieldNote") : t("proofFieldNoteOptional")}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          {tasks.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-secondary">{t("proofFieldAttach")}</span>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="">{t("proofAttachProject")}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="mt-1 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {isSaving ? t("proofSaving") : t("proofSave")}
          </button>
        </div>

        <ComingSoonTools />
      </div>
    </div>
  );
}

// Honest, visually secondary preview of future integrations. Nothing here is
// clickable — these are clearly labelled as not yet available.
function ComingSoonTools() {
  const t = useTranslations("build");
  const tools = ["GitHub", "Vercel", "Figma", "Google Drive"];
  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          {t("proofConnectTitle")}
        </span>
        <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
          {t("proofComingSoon")}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t("proofConnectSubtitle")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <span
            key={tool}
            aria-disabled="true"
            className="cursor-not-allowed rounded-full border border-border/60 bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted opacity-70"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
