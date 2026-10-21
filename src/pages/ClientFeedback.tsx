import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Check, Loader2 } from "lucide-react";
import {
  COMMUNICATION, CONCERNS, IMPROVEMENT, PROGRESS, SATISFACTION, questionText, type Choice,
} from "@/lib/clientFeedback";

/**
 * The page a client opens from their feedback link. No sign-in: the link
 * itself is the key, and it takes one answer.
 */
type Info = { company: string; projectTitle: string; monthLabel: string; submitted: boolean };
type Phase = "loading" | "missing" | "error" | "form" | "sending" | "done" | "already";

export default function ClientFeedback() {
  const [, params] = useRoute("/feedback/:token");
  const token = params?.token ?? "";
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [problem, setProblem] = useState("");

  const [satisfaction, setSatisfaction] = useState("");
  const [progress, setProgress] = useState("");
  const [communication, setCommunication] = useState("");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [otherConcern, setOtherConcern] = useState("");
  const [improvement, setImprovement] = useState("");
  const [comments, setComments] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    document.title = "Client feedback";
    let cancelled = false;
    fetch(`/api/client-feedback/${encodeURIComponent(token)}`)
      .then(async response => {
        if (cancelled) return;
        if (response.status === 404) return setPhase("missing");
        if (!response.ok) return setPhase("error");
        const data = (await response.json()) as Info & { ok: boolean };
        setInfo(data);
        setPhase(data.submitted ? "already" : "form");
      })
      .catch(() => !cancelled && setPhase("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleConcern = (value: string) => {
    setConcerns(current => {
      if (current.includes(value)) return current.filter(item => item !== value);
      // "No major concerns" and a real concern cannot both be true.
      if (value === "no_major_concerns") return [value];
      return [...current.filter(item => item !== "no_major_concerns"), value];
    });
  };

  const missing = [
    !satisfaction && "question 1",
    !progress && "question 2",
    !communication && "question 3",
    concerns.length === 0 && "question 4",
    concerns.includes("other") && !otherConcern.trim() && "the other concern",
    !improvement && "question 5",
  ].filter(Boolean) as string[];

  const submit = async () => {
    if (missing.length > 0) {
      setProblem(`Please answer ${missing.join(", ")}.`);
      return;
    }
    setProblem("");
    setPhase("sending");
    try {
      const response = await fetch(`/api/client-feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satisfaction, progress, communication, concerns,
          otherConcern: otherConcern.trim(), improvement,
          comments: comments.trim(), name: name.trim(), website,
        }),
      });
      if (response.ok) return setPhase("done");
      if (response.status === 409) return setPhase("already");
      setPhase("form");
      setProblem(
        response.status === 429
          ? "Too many tries from this connection. Please wait a few minutes and send again."
          : "That did not go through. Please check your answers and send again."
      );
    } catch {
      setPhase("form");
      setProblem("We could not reach the server. Check your connection and send again.");
    }
  };

  const q = questionText(info?.company ?? "us");

  return (
    <div className="cf-page">
      <div className="cf-wrap">
        <header className="cf-head">
          <div className="cf-eyebrow">{info ? `${info.company} · Client feedback` : "Client feedback"}</div>
          {info ? (
            <>
              <h1 className="cf-title">How are we doing?</h1>
              <p className="cf-sub">
                {info.projectTitle ? <strong>{info.projectTitle}</strong> : null}
                {info.projectTitle ? " · " : null}
                {info.monthLabel}. Six quick questions, about two minutes.
              </p>
            </>
          ) : null}
        </header>

        {phase === "loading" && (
          <div className="cf-card cf-center"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading</div>
        )}
        {phase === "missing" && (
          <div className="cf-card cf-center">
            <h2 className="cf-q">This link does not work</h2>
            <p className="cf-muted">It may have been replaced with a newer one. Ask your account manager for the current link.</p>
          </div>
        )}
        {phase === "error" && (
          <div className="cf-card cf-center">
            <h2 className="cf-q">We could not load the form</h2>
            <p className="cf-muted">Please refresh the page in a minute.</p>
          </div>
        )}
        {(phase === "done" || phase === "already") && (
          <div className="cf-card cf-center">
            <span className="cf-tick"><Check className="h-6 w-6" aria-hidden="true" /></span>
            <h2 className="cf-q">{phase === "done" ? "Thank you" : "Already answered"}</h2>
            <p className="cf-muted">
              {phase === "done"
                ? "Your feedback went straight to the team running your account."
                : "This month's feedback has already been sent. Thank you."}
            </p>
          </div>
        )}

        {(phase === "form" || phase === "sending") && info && (
          <form
            className="cf-form"
            onSubmit={event => {
              event.preventDefault();
              void submit();
            }}
            noValidate
          >
            <section className="cf-card">
              <div className="cf-section">General feedback</div>
              <Radios n={1} legend={q.satisfaction} name="satisfaction" choices={SATISFACTION} value={satisfaction} onChange={setSatisfaction} />
            </section>
            <section className="cf-card">
              <Radios n={2} legend={q.progress} name="progress" choices={PROGRESS} value={progress} onChange={setProgress} />
            </section>
            <section className="cf-card">
              <Radios n={3} legend={q.communication} name="communication" choices={COMMUNICATION} value={communication} onChange={setCommunication} />
            </section>
            <section className="cf-card">
              <fieldset>
                <legend className="cf-q"><span className="cf-n">4</span>{q.concerns}</legend>
                <p className="cf-hint">Tick all that apply.</p>
                <div className="cf-options">
                  {CONCERNS.map(choice => {
                    const checked = concerns.includes(choice.value);
                    return (
                      <label key={choice.value} className={`cf-option${checked ? " on" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleConcern(choice.value)} />
                        <span className="cf-box" aria-hidden="true">{checked ? <Check className="h-3.5 w-3.5" /> : null}</span>
                        <span>{choice.label}</span>
                      </label>
                    );
                  })}
                </div>
                {concerns.includes("other") && (
                  <label className="cf-field">
                    <span>What is the other concern?</span>
                    <textarea value={otherConcern} onChange={e => setOtherConcern(e.target.value)} maxLength={1000} rows={3} />
                  </label>
                )}
              </fieldset>
            </section>
            <section className="cf-card">
              <Radios n={5} legend={q.improvement} name="improvement" choices={IMPROVEMENT} value={improvement} onChange={setImprovement} />
            </section>
            <section className="cf-card">
              <label className="cf-field">
                <span className="cf-q"><span className="cf-n">6</span>{q.comments}</span>
                <span className="cf-hint">Optional.</span>
                <textarea value={comments} onChange={e => setComments(e.target.value)} maxLength={4000} rows={5} />
              </label>
              <label className="cf-field">
                <span>Your name <span className="cf-hint">(optional)</span></span>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" />
              </label>
              {/* Hidden from people; only form-filling bots fill it in. */}
              <input
                className="cf-trap"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                name="website"
              />
            </section>

            {problem && <p className="cf-problem" role="alert">{problem}</p>}
            <button type="submit" className="cf-send" disabled={phase === "sending"}>
              {phase === "sending" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              {phase === "sending" ? "Sending" : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Radios({
  n, legend, name, choices, value, onChange,
}: {
  n: number; legend: string; name: string; choices: Choice[]; value: string; onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="cf-q"><span className="cf-n">{n}</span>{legend}</legend>
      <div className="cf-options">
        {choices.map(choice => (
          <label key={choice.value} className={`cf-option${value === choice.value ? " on" : ""}`}>
            <input type="radio" name={name} value={choice.value} checked={value === choice.value} onChange={() => onChange(choice.value)} />
            <span className="cf-dot" aria-hidden="true" />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
