import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { trpc } from "@/lib/trpc";

/** Same limit as the server (fpbAttachments.ts). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Where a card's file is opened (images inline) or downloaded. */
export function attachmentUrl(id: string, download = false) {
  return apiUrl(`/api/fpb/attachments/${id}${download ? "?download=1" : ""}`);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Uploads one file to a card. Throws with the server's message on failure. */
export async function uploadTaskFile(taskId: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than 10 MB`);
  }
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(apiUrl(`/api/fpb/tasks/${taskId}/attachments`), {
    method: "POST",
    body,
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not upload ${file.name}`);
  return data;
}

/** The input id the task sidebar's "Attachment" button clicks. */
export const attachmentInputId = (taskId: string) => `fpb-attach-${taskId}`;

/**
 * A card's files: drop or pick files (any format, up to 10 MB each), see image
 * previews, open, download, and remove them.
 */
export function TaskAttachments({
  taskId, attachments, users, tokens, myId, canManage, onChanged,
}: {
  taskId: string;
  attachments: any[];
  users: any[];
  tokens: any;
  myId: string | null;
  /** Project managers can remove anyone's file; others only their own. */
  canManage: boolean;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const remove = trpc.fpb.deleteAttachment.useMutation({
    onSuccess: () => { onChanged(); toast.success("Attachment removed"); },
    onError: (e: any) => toast.error(e?.message || "Could not remove it"),
  });

  const send = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(n => n + list.length);
    let ok = 0;
    for (const file of list) {
      try {
        await uploadTaskFile(taskId, file);
        ok += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Could not upload ${file.name}`);
      } finally {
        setUploading(n => n - 1);
      }
    }
    if (ok > 0) {
      toast.success(ok === 1 ? "File attached" : `${ok} files attached`);
      onChanged();
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void send(e.dataTransfer.files);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>
          <Paperclip className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        <label
          htmlFor={attachmentInputId(taskId)}
          className={`cursor-pointer rounded px-2 py-1 text-xs font-semibold ${tokens.tagBg} hover:brightness-95`}
        >
          Add
        </label>
        <input
          id={attachmentInputId(taskId)}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) void send(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-2 transition-colors ${
          dragging ? "border-[#4233e0] bg-[var(--now-indigo-tint)]" : tokens.border
        }`}
      >
        {attachments.length === 0 && uploading === 0 ? (
          <label
            htmlFor={attachmentInputId(taskId)}
            className={`block cursor-pointer py-3 text-center text-xs ${tokens.textMuted}`}
          >
            Drop files here or click to attach (any format, up to 10 MB)
          </label>
        ) : (
          <ul className="space-y-1.5">
            {attachments.map(a => {
              const uploader = users.find(u => u.id === a.uploadedBy);
              const mayRemove = canManage || a.uploadedBy === myId;
              return (
                <li key={a.id} className="flex items-center gap-3 group rounded-md p-1 hover:bg-background">
                  <a
                    href={attachmentUrl(a.id, !a.isImage)}
                    target={a.isImage ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-background"
                    title={a.isImage ? "Open" : "Download"}
                  >
                    {a.isImage ? (
                      <img
                        src={attachmentUrl(a.id)}
                        alt={a.fileName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className={`h-5 w-5 ${tokens.textMuted}`} />
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${tokens.textPrimary}`}>{a.fileName}</p>
                    <p className={`text-[11px] ${tokens.textMuted}`}>
                      {formatBytes(Number(a.size) || 0)}
                      {" · "}{uploader?.name ?? "Someone"}
                      {" · "}{new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={attachmentUrl(a.id, true)}
                    aria-label={`Download ${a.fileName}`}
                    title="Download"
                    className={`p-1 ${tokens.textMuted} hover:text-[#8f86ff]`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {mayRemove && (
                    <button
                      type="button"
                      aria-label={`Remove ${a.fileName}`}
                      title="Remove"
                      disabled={remove.isPending}
                      onClick={() => confirm(`Remove ${a.fileName}?`) && remove.mutate({ id: a.id })}
                      className="p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
            {uploading > 0 && (
              <li className={`flex items-center gap-2 p-1 text-xs ${tokens.textMuted}`}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading {uploading} file{uploading === 1 ? "" : "s"}...
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
