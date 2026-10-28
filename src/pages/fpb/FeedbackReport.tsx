import { format } from "date-fns";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Check, Copy, Quote } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  COMMUNICATION, CONCERNS, IMPROVEMENT, PROGRESS, SATISFACTION, labelOf, type Choice,
} from "@/lib/clientFeedback";

/**
 * One month's client feedback laid out as a report: the overall score up top,
 * each rated question on its scale, then concerns, the one improvement asked
 * for, and the client's own words.
 */
export type FeedbackAnswers = {
  satisfaction: string;
  progress: string;
  communication: string;
  concerns: string[];
  otherConcern: string;
  improvement: string;
  comments: string;
  name: string;
  submittedAt: string | Date;
};

type Tone = "good" | "ok" | "bad" | "neutral";

/** Best to worst; the position decides the colour. */
const SATISFACTION_TONE: Record<string, Tone> = {
  exceptional: "good", excellent: "good", good: "ok", average: "bad", poor: "bad",
};
const PROGRESS_TONE: Record<string, Tone> = {
  ahead_of_expectations: "good", mostly_on_track: "good", some_gaps_or_delays: "ok",
  significantly_off_track: "bad", too_early_to_assess: "neutral",
};
const COMMUNICATION_TONE: Record<string, Tone> = { excellent: "good", good: "good", fair: "ok", poor: "bad" };

const HEADLINE: Record<Tone, string> = {
  good: "Happy client",
  ok: "Room to improve",
  bad: "Needs attention",
  neutral: "Early days",
};

/** "Excellent: proactive and timely" → ["Excellent", "proactive and timely"] */
function splitLabel(label: string) {
  const at = label.indexOf(": ");
  return at === -1 ? [label, ""] : [label.slice(0, at), label.slice(at + 2)];
}

function Scale({ choices, value, tone }: { choices: Choice[]; value: string; tone: Tone }) {
  // Shown worst to best, left to right, so "further right" always reads as better.
  const ordered = [...choices].reverse();
  return (
    <div className="fr-scale" role="img" aria-label={`${labelOf(choices, value)}, on a scale of ${choices.length}`}>
      {ordered.map(choice => (
        <span key={choice.value} className={`fr-seg${choice.value === value ? ` on ${tone}` : ""}`} title={choice.label} />
      ))}
    </div>
  );
}


type RowTone = Tone | "focus";

function Question({
  n, title, answer, sub, tone, children,
}: {
  n: number; title: string; answer: string; sub?: string; tone: RowTone; children: ReactNode;
}) {
  return (
    <section className="fr-card">
      <div className="fr-q"><span className="fr-n">{n}</span>{title}</div>
      <div className={`fr-a ${tone}`}>{answer}</div>
      {sub ? <div className="fr-note">{sub}</div> : null}
      {children}
    </section>
  );
}

/** Every option of a question, with the client's choice marked. */
function Options({
  choices, selected, tone, multiple = false,
}: {
  choices: Choice[]; selected: string[]; tone: (value: string) => RowTone; multiple?: boolean;
}) {
  return (
    <ul className="fr-opts">
      {choices.map(choice => {
        const on = selected.includes(choice.value);
        return (
          <li key={choice.value} className={`fr-opt${on ? ` on ${tone(choice.value)}` : ""}`}>
            <span className={`fr-mark${multiple ? " box" : ""}`} aria-hidden="true">
              {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0">{choice.label}</span>
            {on && <span className="sr-only"> (chosen)</span>}
          </li>
        );
      })}
    </ul>
  );
}

function summaryText(projectTitle: string, monthLabel: string, f: FeedbackAnswers) {
  const concerns = f.concerns
    .map(c => (c === "other" && f.otherConcern ? `Other: ${f.otherConcern}` : labelOf(CONCERNS, c)))
    .join(", ");
  return [
    `Client feedback: ${projectTitle}, ${monthLabel}`,
    `Answered ${format(new Date(f.submittedAt), "d MMM yyyy")}${f.name ? ` by ${f.name}` : ""}`,
    "",
    `Overall satisfaction: ${labelOf(SATISFACTION, f.satisfaction)}`,
    `Progress against goals: ${labelOf(PROGRESS, f.progress)}`,
    `Communication: ${labelOf(COMMUNICATION, f.communication)}`,
    `Concerns: ${concerns}`,
    `Most valuable improvement: ${labelOf(IMPROVEMENT, f.improvement)}`,
    `Anything else: ${f.comments || "Nothing added"}`,
  ].join("\n");
}

export function FeedbackReport({
  open, onOpenChange, projectTitle, monthLabel, feedback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  monthLabel: string;
  feedback: FeedbackAnswers;
}) {
  const overallTone = SATISFACTION_TONE[feedback.satisfaction] ?? "neutral";
  const progressTone = PROGRESS_TONE[feedback.progress] ?? "neutral";
  const communicationTone = COMMUNICATION_TONE[feedback.communication] ?? "neutral";
  const noConcerns = feedback.concerns.length === 1 && feedback.concerns[0] === "no_major_concerns";
  const realConcerns = feedback.concerns.filter(c => c !== "no_major_concerns");
  const [commHead, commDetail] = splitLabel(labelOf(COMMUNICATION, feedback.communication));
  const satisfactionIndex = SATISFACTION.findIndex(c => c.value === feedback.satisfaction);
  const score = satisfactionIndex === -1 ? null : SATISFACTION.length - satisfactionIndex;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fr-dialog max-h-[92vh] overflow-y-auto p-0 sm:max-w-[880px]">
        {/* ───────── Header */}
        <header className={`fr-hero ${overallTone}`}>
          <div className="fr-eyebrow">Client feedback · {monthLabel}</div>
          <DialogTitle className="fr-title">{projectTitle}</DialogTitle>
          <DialogDescription className="fr-meta">
            Answered {format(new Date(feedback.submittedAt), "EEEE d MMMM yyyy, HH:mm")}
            {feedback.name ? ` by ${feedback.name}` : ""}
          </DialogDescription>

          <div className="fr-score">
            <div className="fr-score-num" aria-hidden="true">
              {score ?? "–"}<span>/5</span>
            </div>
            <div className="min-w-0">
              <div className="fr-score-label">Overall satisfaction</div>
              <div className="fr-score-value">{labelOf(SATISFACTION, feedback.satisfaction)}</div>
              <span className={`fr-badge ${overallTone}`}>{HEADLINE[overallTone]}</span>
            </div>
          </div>
        </header>

        <div className="fr-body">
          <div className="fr-grid">
            {/* 1 */}
            <Question n={1} title="Overall satisfaction" answer={labelOf(SATISFACTION, feedback.satisfaction)} tone={overallTone}>
              <Scale choices={SATISFACTION} value={feedback.satisfaction} tone={overallTone} />
              <Options choices={SATISFACTION} selected={[feedback.satisfaction]} tone={() => overallTone} />
            </Question>

            {/* 2 */}
            <Question n={2} title="Progress against agreed goals" answer={labelOf(PROGRESS, feedback.progress)} tone={progressTone}>
              {feedback.progress === "too_early_to_assess" ? (
                <div className="fr-note">Too early to judge results yet.</div>
              ) : (
                <Scale choices={PROGRESS.filter(c => c.value !== "too_early_to_assess")} value={feedback.progress} tone={progressTone} />
              )}
              <Options choices={PROGRESS} selected={[feedback.progress]} tone={() => progressTone} />
            </Question>

            {/* 3 */}
            <Question n={3} title="Communication and responsiveness" answer={commHead} sub={commDetail} tone={communicationTone}>
              <Scale choices={COMMUNICATION} value={feedback.communication} tone={communicationTone} />
              <Options choices={COMMUNICATION} selected={[feedback.communication]} tone={() => communicationTone} />
            </Question>

            {/* 4 */}
            <Question
              n={4}
              title="Concerns right now"
              answer={noConcerns ? "No major concerns" : `${realConcerns.length} concern${realConcerns.length === 1 ? "" : "s"} raised`}
              tone={noConcerns ? "good" : "bad"}
            >
              <Options
                choices={CONCERNS}
                selected={feedback.concerns}
                multiple
                tone={value => (value === "no_major_concerns" ? "good" : "bad")}
              />
              {feedback.concerns.includes("other") && feedback.otherConcern && (
                <blockquote className="fr-quote small">
                  <Quote className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span><strong>Other concern:</strong> {feedback.otherConcern}</span>
                </blockquote>
              )}
            </Question>

            {/* 5 */}
            <Question n={5} title="The one improvement that would add most value" answer={labelOf(IMPROVEMENT, feedback.improvement)} tone="focus">
              <Options choices={IMPROVEMENT} selected={[feedback.improvement]} tone={() => "focus"} />
            </Question>

            {/* 6 */}
            <Question n={6} title="Anything else they wanted us to know" answer={feedback.comments ? "In their words" : "Nothing added"} tone="neutral">
              {feedback.comments ? (
                <blockquote className="fr-quote">
                  <Quote className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{feedback.comments}</span>
                </blockquote>
              ) : (
                <div className="fr-note">The client left this blank.</div>
              )}
            </Question>
          </div>

          <footer className="fr-foot">
            <button
              type="button"
              className="now-btn ground sm"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(summaryText(projectTitle, monthLabel, feedback))
                  .then(() => toast.success("Summary copied"))
                  .catch(() => toast.error("Could not copy"));
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> Copy as text
            </button>
            <button type="button" className="now-btn ink sm" onClick={() => onOpenChange(false)}>Close</button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
