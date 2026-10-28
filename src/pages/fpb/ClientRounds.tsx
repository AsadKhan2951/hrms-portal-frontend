import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check, ChevronDown, ChevronUp, Copy, ExternalLink, FileText, Loader2, MoreHorizontal, Paperclip, Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { feedbackUrl } from "@/lib/clientFeedback";
import { FeedbackReport } from "./FeedbackReport";

/**
 * The monthly client work on one project: report, meeting, invoice and
 * payment, all entered by hand, plus the client's feedback link for the month.
 * The project's creator and admins change it; everyone on the project sees it.
 */

type FileRef = { url: string; name: string } | null;
type Round = {
  id: string;
  month: string;
  monthLabel: string;
  reportUrl: string | null;
  reportFile: FileRef;
  reportSentAt: string | Date | null;
  meetingAt: string | Date | null;
  meetingDoneAt: string | Date | null;
  meetingNotes: string;
  invoiceNumber: string;
  invoiceAmount: number | null;
  invoiceCurrency: string;
  invoiceUrl: string | null;
  invoiceFile: FileRef;
  invoiceSentAt: string | Date | null;
  paidAt: string | Date | null;
  paidAmount: number | null;
  paymentNote: string;
  steps: { reportSent: boolean; meetingScheduled: boolean; meetingDone: boolean; invoiceSent: boolean; invoicePaid: boolean; done: number };
  feedbackToken: string | null;
  feedbackSubmittedAt: string | Date | null;
  feedback: null | {
    satisfaction: string; progress: string; communication: string; concerns: string[];
    otherConcern: string; improvement: string; comments: string; name: string; submittedAt: string | Date;
  };
  canEdit: boolean;
};

type StepKind = "report" | "meeting" | "meetingDone" | "invoice" | "paid";

const CURRENCIES = ["PKR", "USD", "CAD", "EUR", "GBP", "AED", "SAR"];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx";
const ALLOWED_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const day = (value: string | Date | null) => (value ? format(new Date(value), "d MMM yyyy") : "");
const dayTime = (value: string | Date | null) => (value ? format(new Date(value), "EEE d MMM, HH:mm") : "");
const money = (amount: number | null, currency: string) =>
  amount === null || amount === undefined ? "" : `${currency} ${amount.toLocaleString("en-US")}`;
/** For <input type="date"> */
const dateInput = (value: string | Date | null) => (value ? format(new Date(value), "yyyy-MM-dd") : "");
/** For <input type="datetime-local"> */
const dateTimeInput = (value: string | Date | null) => (value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : "");
/** A date input's value as noon local time, so it never slips a day across time zones. */
const fromDateInput = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d, 12, 0) : null;
};

/** "2026-10" for this month in the browser's time zone. */
function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ClientRounds({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clientRounds.list.useQuery({ projectId });
  const rounds = (data?.rounds ?? []) as Round[];
  const canEdit = Boolean(data?.canEdit);
  const [month, setMonth] = useState(thisMonth());
  const [editing, setEditing] = useState<{ round: Round; kind: StepKind } | null>(null);

  const refresh = () => {
    utils.clientRounds.list.invalidate({ projectId });
    utils.clientRounds.meetings.invalidate();
  };
  const onError = (error: any) => toast.error(error?.message || "Something went wrong");

  const create = trpc.clientRounds.create.useMutation({ onSuccess: refresh, onError });
  const remove = trpc.clientRounds.delete.useMutation({
    onSuccess: () => { refresh(); toast.success("Month deleted"); },
    onError,
  });
  const resetLink = trpc.clientRounds.resetFeedbackLink.useMutation({
    onSuccess: () => { refresh(); toast.success("New link made. The old one no longer works."); },
    onError,
  });

  const hasMonth = rounds.some(round => round.month === month);
  const current = thisMonth();

  return (
    <section className="now-client" aria-label="Monthly client work">
      <div className="now-client-head">
        <div>
          <div className="now-h2">Monthly client work</div>
          <div className="now-row-sub">Report, meeting, invoice and payment for {projectTitle}, month by month.</div>
        </div>
        {canEdit && (
          <div className="now-client-open">
            <Input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              aria-label="Month"
              className="h-11 w-[170px] rounded-xl bg-card"
            />
            <button
              type="button"
              className="now-btn ink sm"
              disabled={!month || hasMonth || create.isPending}
              onClick={() => create.mutate({ projectId, month })}
            >
              {hasMonth ? "Already open" : month === current ? "Start this month" : "Start month"}
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="now-card items-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading
        </div>
      )}

      {!isLoading && rounds.length === 0 && (
        <div className="now-card items-center py-10 text-center">
          <div className="now-lede">No months yet</div>
          <p className="now-muted" style={{ maxWidth: 440 }}>
            {canEdit
              ? "Start this month to track the report, meeting, invoice and payment, and to get the client's feedback link."
              : "The project owner has not started tracking client months yet."}
          </p>
        </div>
      )}

      {rounds.map((round, index) => (
        <RoundCard
          key={round.id}
          round={round}
          projectTitle={projectTitle}
          defaultOpen={index === 0 || round.month === current}
          onEdit={kind => setEditing({ round, kind })}
          onDelete={() => {
            if (confirm(`Delete ${round.monthLabel}? Its files and the client's feedback for it are removed too.`)) {
              remove.mutate({ roundId: round.id });
            }
          }}
          onResetLink={() => {
            if (confirm("Make a new feedback link? The link you sent before will stop working.")) {
              resetLink.mutate({ roundId: round.id });
            }
          }}
        />
      ))}

      {editing && (
        <StepDialog
          round={rounds.find(r => r.id === editing.round.id) ?? editing.round}
          kind={editing.kind}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────── One month
function RoundCard({
  round, projectTitle, defaultOpen, onEdit, onDelete, onResetLink,
}: {
  round: Round;
  projectTitle: string;
  defaultOpen: boolean;
  onEdit: (kind: StepKind) => void;
  onDelete: () => void;
  onResetLink: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAnswers, setShowAnswers] = useState(false);
  const { steps } = round;

  const rows: { kind: StepKind; n: number; title: string; done: boolean; detail: ReactNode; action: string; locked?: string }[] = [
    {
      kind: "report", n: 1, title: "Report sent", done: steps.reportSent,
      detail: steps.reportSent ? (
        <>Sent {day(round.reportSentAt)} · <Attachments url={round.reportUrl} file={round.reportFile} /></>
      ) : "Add the report link or file",
      action: steps.reportSent ? "Edit" : "Add report",
    },
    {
      kind: "meeting", n: 2, title: "Meeting scheduled", done: steps.meetingScheduled,
      detail: steps.meetingScheduled ? dayTime(round.meetingAt) : "Set the date once the meeting is fixed",
      action: steps.meetingScheduled ? "Change" : "Set date",
    },
    {
      kind: "meetingDone", n: 3, title: "Meeting done", done: steps.meetingDone,
      detail: steps.meetingDone
        ? `Done ${day(round.meetingDoneAt)}${round.meetingNotes ? ` · ${round.meetingNotes}` : ""}`
        : "Mark it once the meeting has happened",
      action: steps.meetingDone ? "Edit" : "Mark done",
      locked: steps.meetingScheduled ? undefined : "Set the meeting date first",
    },
    {
      kind: "invoice", n: 4, title: "Invoice sent", done: steps.invoiceSent,
      detail: steps.invoiceSent ? (
        <>
          Sent {day(round.invoiceSentAt)}
          {round.invoiceNumber ? ` · ${round.invoiceNumber}` : ""}
          {round.invoiceAmount !== null ? ` · ${money(round.invoiceAmount, round.invoiceCurrency)}` : ""}
          {" · "}<Attachments url={round.invoiceUrl} file={round.invoiceFile} />
        </>
      ) : "Upload the invoice",
      action: steps.invoiceSent ? "Edit" : "Add invoice",
    },
    {
      kind: "paid", n: 5, title: "Invoice paid", done: steps.invoicePaid,
      detail: steps.invoicePaid
        ? `Paid ${day(round.paidAt)}${round.paidAmount !== null ? ` · ${money(round.paidAmount, round.invoiceCurrency)}` : ""}${round.paymentNote ? ` · ${round.paymentNote}` : ""}`
        : "Enter it once the payment arrives",
      action: steps.invoicePaid ? "Edit" : "Mark paid",
      locked: steps.invoiceSent ? undefined : "Send the invoice first",
    },
  ];

  return (
    <article className="now-card flush now-round">
      <div className="now-round-head">
        <button
          type="button"
          className="now-round-toggle"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
        >
          <span className="now-h2">{round.monthLabel}</span>
          <span className={`now-pill${steps.done === 5 ? " lime" : ""}`}>{steps.done} of 5 done</span>
          {round.feedbackSubmittedAt && <span className="now-pill ink">Feedback in</span>}
          {open ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </button>
        {round.canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="now-board-more" aria-label={`${round.monthLabel} options`}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-500 focus:text-red-500">
                <Trash2 className="mr-2 h-4 w-4" /> Delete month
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
      <div className="now-steps">
        {rows.map(row => (
          <div key={row.kind} className={`now-step${row.done ? " done" : ""}`}>
            <span className="now-step-n" aria-hidden="true">{row.done ? <Check className="h-4 w-4" /> : row.n}</span>
            <div className="min-w-0 flex-1">
              <div className="now-row-title">{row.title}</div>
              <div className="now-row-sub">{row.locked && !row.done ? row.locked : row.detail}</div>
            </div>
            {round.canEdit && (
              <button
                type="button"
                className={`now-btn sm ${row.done ? "ground" : "tint"}`}
                disabled={Boolean(row.locked) && !row.done}
                onClick={() => onEdit(row.kind)}
              >
                {row.action}
              </button>
            )}
          </div>
        ))}
      </div>
      )}

      {open && (
        <div className="now-feedback">
          <div className="min-w-0 flex-1">
            <div className="now-row-title">Client feedback</div>
            <div className="now-row-sub">
              {round.feedbackSubmittedAt
                ? `Answered ${day(round.feedbackSubmittedAt)}${round.feedback?.name ? ` by ${round.feedback.name}` : ""}`
                : round.canEdit
                  ? "Send this link to the client. It takes one answer."
                  : "Not answered yet"}
            </div>
            {round.canEdit && round.feedbackToken && !round.feedbackSubmittedAt && (
              <code className="now-link-box">{feedbackUrl(round.feedbackToken)}</code>
            )}
          </div>
          {round.canEdit && round.feedbackToken && !round.feedbackSubmittedAt && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="now-btn indigo sm"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(feedbackUrl(round.feedbackToken!))
                    .then(() => toast.success("Link copied"))
                    .catch(() => toast.error("Could not copy. Select the link and copy it."));
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy link
              </button>
              <button type="button" className="now-btn text sm" onClick={onResetLink}>New link</button>
            </div>
          )}
          {round.feedback && (
            <button type="button" className="now-btn ink sm" onClick={() => setShowAnswers(true)}>
              View feedback
            </button>
          )}
        </div>
      )}

      {round.feedback && (
        <FeedbackReport
          open={showAnswers}
          onOpenChange={setShowAnswers}
          projectTitle={projectTitle}
          monthLabel={round.monthLabel}
          feedback={round.feedback}
        />
      )}
    </article>
  );
}

function Attachments({ url, file }: { url: string | null; file: FileRef }) {
  return (
    <span className="now-attach">
      {file && (
        <a href={file.url} target="_blank" rel="noreferrer">
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> {file.name}
        </a>
      )}
      {url && (
        <a href={url} target="_blank" rel="noreferrer noopener">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open link
        </a>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────── Edit a step
const STEP_COPY: Record<StepKind, { title: string; description: string }> = {
  report: { title: "Report sent", description: "Paste the report link, upload the file, or both." },
  meeting: { title: "Meeting scheduled", description: "The date and time the meeting is fixed for." },
  meetingDone: { title: "Meeting done", description: "When it happened, and anything worth noting." },
  invoice: { title: "Invoice sent", description: "Upload the invoice, or paste a link to it." },
  paid: { title: "Invoice paid", description: "When the payment arrived." },
};

function StepDialog({
  round, kind, onClose, onSaved,
}: { round: Round; kind: StepKind; onClose: () => void; onSaved: () => void }) {
  const [link, setLink] = useState("");
  const [sentOn, setSentOn] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [doneOn, setDoneOn] = useState("");
  const [notes, setNotes] = useState("");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [paidOn, setPaidOn] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setLink((kind === "report" ? round.reportUrl : round.invoiceUrl) ?? "");
    setSentOn(dateInput((kind === "report" ? round.reportSentAt : round.invoiceSentAt) ?? null) || dateInput(new Date()));
    setMeetingAt(dateTimeInput(round.meetingAt));
    setDoneOn(dateInput(round.meetingDoneAt) || dateInput(new Date()));
    setNotes(round.meetingNotes ?? "");
    setNumber(round.invoiceNumber ?? "");
    setAmount(round.invoiceAmount !== null ? String(round.invoiceAmount) : "");
    setCurrency(round.invoiceCurrency || "PKR");
    setPaidOn(dateInput(round.paidAt) || dateInput(new Date()));
    setPaidAmount(round.paidAmount !== null ? String(round.paidAmount) : round.invoiceAmount !== null ? String(round.invoiceAmount) : "");
    setPaymentNote(round.paymentNote ?? "");
    setFile(null);
    // Only when the dialog opens for a step, not on every refresh behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, kind]);

  const update = trpc.clientRounds.update.useMutation();
  const attach = trpc.clientRounds.attachFile.useMutation();
  const detach = trpc.clientRounds.removeFile.useMutation();
  const [busy, setBusy] = useState(false);
  const copy = STEP_COPY[kind];
  const existingFile = kind === "report" ? round.reportFile : kind === "invoice" ? round.invoiceFile : null;
  const isDone =
    kind === "report" ? round.steps.reportSent
      : kind === "meeting" ? round.steps.meetingScheduled
        : kind === "meetingDone" ? round.steps.meetingDone
          : kind === "invoice" ? round.steps.invoiceSent
            : round.steps.invoicePaid;

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      onSaved();
      toast.success(done);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Could not save it");
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const parseAmount = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
  };

  const save = () => {
    if (kind === "report" || kind === "invoice") {
      const sent = fromDateInput(sentOn);
      if (!link.trim() && !file && !existingFile) return toast.error("Add a link or upload a file");
      if (!sent) return toast.error("Pick the date it was sent");
      if (file && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
        return toast.error("Upload a PDF, image, Word, Excel or PowerPoint file of 10MB or less");
      }
      const invoiceAmount = parseAmount(amount);
      if (Number.isNaN(invoiceAmount)) return toast.error("Enter the amount as a number");
      return run(async () => {
        if (file) {
          await attach.mutateAsync({
            roundId: round.id, kind, fileName: file.name, fileBase64: await readAsBase64(file), mimeType: file.type,
          });
        }
        await update.mutateAsync(
          kind === "report"
            ? { roundId: round.id, reportUrl: link.trim() || null, reportSentAt: sent }
            : {
                roundId: round.id, invoiceUrl: link.trim() || null, invoiceSentAt: sent,
                invoiceNumber: number.trim(), invoiceAmount, invoiceCurrency: currency,
              }
        );
      }, kind === "report" ? "Report saved" : "Invoice saved");
    }
    if (kind === "meeting") {
      if (!meetingAt) return toast.error("Pick the date and time");
      const at = new Date(meetingAt);
      if (Number.isNaN(at.getTime())) return toast.error("Pick the date and time");
      return run(() => update.mutateAsync({ roundId: round.id, meetingAt: at }), "Meeting date saved");
    }
    if (kind === "meetingDone") {
      const on = fromDateInput(doneOn);
      if (!on) return toast.error("Pick the date it happened");
      return run(() => update.mutateAsync({ roundId: round.id, meetingDoneAt: on, meetingNotes: notes.trim() }), "Marked done");
    }
    const on = fromDateInput(paidOn);
    if (!on) return toast.error("Pick the date it was paid");
    const received = parseAmount(paidAmount);
    if (Number.isNaN(received)) return toast.error("Enter the amount as a number");
    return run(
      () => update.mutateAsync({ roundId: round.id, paidAt: on, paidAmount: received, paymentNote: paymentNote.trim() }),
      "Marked paid"
    );
  };

  const clear = () => {
    const message: Record<StepKind, string> = {
      report: "Remove the report link and file? The step goes back to not sent.",
      meeting: "Clear the meeting date? 'Meeting done' is cleared with it.",
      meetingDone: "Mark the meeting as not done?",
      invoice: "Remove the invoice? 'Invoice paid' is cleared with it.",
      paid: "Mark the invoice as not paid?",
    };
    if (!confirm(message[kind])) return;
    return run(async () => {
      if (kind === "report" || kind === "invoice") {
        if (existingFile) await detach.mutateAsync({ roundId: round.id, kind });
        await update.mutateAsync(
          kind === "report"
            ? { roundId: round.id, reportUrl: null, reportSentAt: null }
            : { roundId: round.id, invoiceUrl: null, invoiceSentAt: null }
        );
      } else if (kind === "meeting") {
        await update.mutateAsync({ roundId: round.id, meetingAt: null });
      } else if (kind === "meetingDone") {
        await update.mutateAsync({ roundId: round.id, meetingDoneAt: null });
      } else {
        await update.mutateAsync({ roundId: round.id, paidAt: null });
      }
    }, "Cleared");
  };

  return (
    <Dialog open onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title} · {round.monthLabel}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 py-2"
          onSubmit={event => {
            event.preventDefault();
            save();
          }}
        >
          {(kind === "report" || kind === "invoice") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="step-file">File</Label>
                {existingFile && !file && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{existingFile.name}</span>
                    </span>
                    <span className="text-muted-foreground">Choose a file below to replace it</span>
                  </div>
                )}
                <Input id="step-file" type="file" accept={ACCEPT} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">PDF, image, Word, Excel or PowerPoint, up to 10MB.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-link">Link</Label>
                <Input id="step-link" type="url" placeholder="https://" value={link} onChange={e => setLink(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-sent">Sent on</Label>
                <Input id="step-sent" type="date" value={sentOn} onChange={e => setSentOn(e.target.value)} />
              </div>
            </>
          )}

          {kind === "invoice" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
              <div className="space-y-2">
                <Label htmlFor="step-number">Invoice number</Label>
                <Input id="step-number" value={number} onChange={e => setNumber(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-amount">Amount</Label>
                <Input id="step-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {kind === "meeting" && (
            <div className="space-y-2">
              <Label htmlFor="step-meeting">Date and time</Label>
              <Input id="step-meeting" type="datetime-local" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
            </div>
          )}

          {kind === "meetingDone" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="step-done">Happened on</Label>
                <Input id="step-done" type="date" value={doneOn} onChange={e => setDoneOn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-notes">Notes (optional)</Label>
                <Textarea id="step-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={3} />
              </div>
            </>
          )}

          {kind === "paid" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="step-paid">Paid on</Label>
                <Input id="step-paid" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-received">Amount received ({round.invoiceCurrency || "PKR"}, optional)</Label>
                <Input id="step-received" inputMode="decimal" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-note">Note (optional)</Label>
                <Input id="step-note" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} maxLength={500} placeholder="e.g. bank transfer" />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div>
              {isDone && (
                <Button type="button" variant="ghost" className="text-red-500 hover:text-red-600" onClick={clear} disabled={busy}>
                  Clear
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { thisMonth };
