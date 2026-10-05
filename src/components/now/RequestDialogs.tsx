import { useEffect, useState, type ReactNode } from "react";
import { format, subDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Every "start a request" form in one place, so Home, Time and Requests all
 * open the same dialog for the same job.
 */
type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

const today = () => format(new Date(), "yyyy-MM-dd");

/** A date and a time typed into two inputs, as one local Date. */
function buildDateTime(dateValue: string, timeValue: string): Date | null {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return new Date(year, month - 1, day, hour, minute);
}

function Shell({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  pending,
  disabled,
  onSubmit,
}: DialogProps & {
  title: string;
  description?: string;
  children: ReactNode;
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="space-y-4 py-2"
          onSubmit={event => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || disabled}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- leave

export function LeaveDialog({ open, onOpenChange }: DialogProps) {
  const utils = trpc.useUtils();
  const [leaveType, setLeaveType] = useState("casual");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setLeaveType("casual");
    setStartDate(today());
    setEndDate(today());
    setReason("");
  }, [open]);

  const submit = trpc.leaves.submit.useMutation({
    onSuccess: () => {
      toast.success("Leave request sent");
      onOpenChange(false);
      utils.leaves.getMyLeaves.invalidate();
      utils.time.getLeaveBalance.invalidate();
      utils.wingman.getOverview.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not send the leave request"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title="Apply for leave"
      description="It goes to your department head for approval."
      submitLabel="Send request"
      pending={submit.isPending}
      onSubmit={() => {
        if (!startDate || !endDate || !reason.trim()) return toast.error("Fill in the dates and the reason");
        if (endDate < startDate) return toast.error("The last day cannot be before the first day");
        submit.mutate({
          leaveType,
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T00:00:00`),
          reason: reason.trim(),
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="leave-type">Leave type</Label>
        <Select value={leaveType} onValueChange={setLeaveType}>
          <SelectTrigger id="leave-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="sick">Sick</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leave-start">First day</Label>
          <Input id="leave-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leave-end">Last day</Label>
          <Input id="leave-end" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="leave-reason">Reason</Label>
        <Textarea
          id="leave-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="For a half day, say morning or afternoon"
          className="min-h-[90px]"
        />
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- overtime

export function OvertimeDialog({ open, onOpenChange }: DialogProps) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState("1");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [] } = trpc.projects.getMyProjects.useQuery(undefined, { enabled: open });
  const { data: tasks = [] } = trpc.projects.getTasks.useQuery({ projectId }, { enabled: open && Boolean(projectId) });

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setHours("1");
    setTaskId("");
    setDescription("");
  }, [open]);

  useEffect(() => {
    if (open && !projectId && projects.length > 0) setProjectId(String(projects[0].id));
  }, [open, projectId, projects]);

  useEffect(() => {
    if (projectId && tasks.length > 0 && !taskId) setTaskId(String(tasks[0].id));
  }, [projectId, tasks, taskId]);

  const submit = trpc.timeTracking.addOvertime.useMutation({
    onSuccess: () => {
      toast.success("Overtime added");
      onOpenChange(false);
      utils.timeTracking.getOvertimeByRange.invalidate();
      utils.time.getFourWeeks.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not add overtime"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title="Add overtime"
      description="For today or yesterday, against the task you worked on."
      submitLabel="Add overtime"
      pending={submit.isPending}
      disabled={!projectId || !taskId}
      onSubmit={() => {
        const value = Number(hours);
        if (!value || Number.isNaN(value) || value <= 0) return toast.error("Enter the hours worked");
        submit.mutate({
          workDate: new Date(`${date}T00:00:00`),
          hours: value,
          projectId,
          taskId,
          description: description.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ot-date">Date</Label>
          <Input
            id="ot-date"
            type="date"
            value={date}
            min={format(subDays(new Date(), 1), "yyyy-MM-dd")}
            max={today()}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ot-hours">Hours</Label>
          <Input id="ot-hours" type="number" min="0.25" step="0.25" value={hours} onChange={e => setHours(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ot-project">Project</Label>
        <Select
          value={projectId}
          onValueChange={value => {
            setProjectId(value);
            setTaskId("");
          }}
        >
          <SelectTrigger id="ot-project">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.length > 0 ? (
              projects.map((project: any) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No projects yet
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ot-task">Task</Label>
        <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
          <SelectTrigger id="ot-task">
            <SelectValue placeholder={projectId ? "Select task" : "Select a project first"} />
          </SelectTrigger>
          <SelectContent>
            {tasks.length > 0 ? (
              tasks.map((task: any) => (
                <SelectItem key={task.id} value={String(task.id)}>
                  {task.title}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No tasks in this project
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ot-note">What was it for? (optional)</Label>
        <Textarea id="ot-note" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px]" />
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------ work session

export function WorkSessionDialog({ open, onOpenChange }: DialogProps) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(today());
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [sessionType, setSessionType] = useState<"remote" | "onsite">("remote");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setSessionType("remote");
    setDescription("");
  }, [open]);

  const submit = trpc.timeTracking.addWorkSession.useMutation({
    onSuccess: () => {
      toast.success("Work session added");
      onOpenChange(false);
      utils.time.getFourWeeks.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not add the work session"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title="Add work session"
      description="For time worked while you were clocked out. Clock out first if you are clocked in."
      submitLabel="Add session"
      pending={submit.isPending}
      onSubmit={() => {
        const startTime = buildDateTime(date, start);
        const endTime = buildDateTime(date, end);
        if (!startTime || !endTime) return toast.error("Choose the date and both times");
        if (endTime <= startTime) return toast.error("The end time must be after the start time");
        submit.mutate({ startTime, endTime, sessionType, description: description.trim() || undefined });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ws-date">Date</Label>
        <Input id="ws-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ws-start">Start</Label>
          <Input id="ws-start" type="time" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-end">End</Label>
          <Input id="ws-end" type="time" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ws-type">Where</Label>
        <Select value={sessionType} onValueChange={value => setSessionType(value as "remote" | "onsite")}>
          <SelectTrigger id="ws-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="onsite">Onsite</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ws-note">What did you work on? (optional)</Label>
        <Textarea id="ws-note" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px]" />
      </div>
    </Shell>
  );
}

// --------------------------------------------------- attendance correction

export function CorrectionDialog({
  open,
  onOpenChange,
  defaultDate,
}: DialogProps & {
  /** "yyyy-MM-dd" of the day to fix, when the dialog was opened from one. */
  defaultDate?: string;
}) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(defaultDate ?? today());
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate ?? today());
    setTimeIn("");
    setTimeOut("");
    setDetails("");
  }, [open, defaultDate]);

  const submit = trpc.requests.create.useMutation({
    onSuccess: () => {
      toast.success("Correction sent for approval");
      onOpenChange(false);
      utils.requests.getMine.invalidate();
      utils.wingman.getOverview.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not send the correction"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title="Attendance correction"
      description="Give the time you actually clocked in or out. Your record changes once it is approved."
      submitLabel="Send correction"
      pending={submit.isPending}
      onSubmit={() => {
        if (!date) return toast.error("Choose the day to correct");
        if (!timeIn && !timeOut) return toast.error("Give the clock-in time, the clock-out time, or both");
        const requestedTimeIn = timeIn ? buildDateTime(date, timeIn) : null;
        const requestedTimeOut = timeOut ? buildDateTime(date, timeOut) : null;
        if (requestedTimeIn && requestedTimeOut && requestedTimeOut <= requestedTimeIn) {
          return toast.error("Clock-out must be after clock-in");
        }
        const label = format(new Date(`${date}T00:00:00`), "d MMMM");
        submit.mutate({
          kind: "attendance_correction",
          subject: `${timeIn && timeOut ? "Clock-in and clock-out" : timeIn ? "Clock-in" : "Clock-out"} correction, ${label}`,
          details: details.trim() || undefined,
          workDate: new Date(`${date}T00:00:00`),
          requestedTimeIn: requestedTimeIn ?? undefined,
          requestedTimeOut: requestedTimeOut ?? undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="fix-date">Day</Label>
        <Input id="fix-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fix-in">Clocked in at</Label>
          <Input id="fix-in" type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fix-out">Clocked out at</Label>
          <Input id="fix-out" type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Leave a time empty if that one is already right.</p>
      <div className="space-y-2">
        <Label htmlFor="fix-note">Note for the approver (optional)</Label>
        <Textarea id="fix-note" value={details} onChange={e => setDetails(e.target.value)} className="min-h-[80px]" />
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------- support ticket

export function TicketDialog({ open, onOpenChange }: DialogProps) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState("it");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory("it");
    setSubject("");
    setDetails("");
  }, [open]);

  const submit = trpc.requests.create.useMutation({
    onSuccess: () => {
      toast.success("Support ticket raised");
      onOpenChange(false);
      utils.requests.getMine.invalidate();
      utils.wingman.getOverview.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not raise the ticket"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title="Support ticket"
      description="IT, equipment or portal problems."
      submitLabel="Raise ticket"
      pending={submit.isPending}
      onSubmit={() => {
        if (subject.trim().length < 3) return toast.error("Say what the problem is");
        submit.mutate({ kind: "support_ticket", subject: subject.trim(), details: details.trim() || undefined, category });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ticket-category">About</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="ticket-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="it">IT</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="portal">This portal</SelectItem>
            <SelectItem value="other">Something else</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Problem</Label>
        <Input id="ticket-subject" value={subject} maxLength={160} onChange={e => setSubject(e.target.value)} placeholder="Laptop charger stopped working" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-details">Details (optional)</Label>
        <Textarea id="ticket-details" value={details} onChange={e => setDetails(e.target.value)} className="min-h-[90px]" />
      </div>
    </Shell>
  );
}

// ------------------------------------- grievance, feedback and resignation

const FORM_COPY = {
  grievance: { title: "Grievance", description: "Report a workplace issue in confidence. Only HR sees it.", submit: "Send to HR", done: "Grievance sent to HR" },
  feedback: { title: "Feedback", description: "Share an idea or suggestion.", submit: "Send feedback", done: "Feedback sent" },
  resignation: { title: "Resignation", description: "This starts your resignation with HR. They will contact you about notice and handover.", submit: "Submit resignation", done: "Resignation submitted" },
} as const;

export type FormKind = keyof typeof FORM_COPY;

export function FormDialog({ open, onOpenChange, kind }: DialogProps & { kind: FormKind }) {
  const utils = trpc.useUtils();
  const copy = FORM_COPY[kind];
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setContent("");
    setPriority("medium");
  }, [open, kind]);

  const submit = trpc.forms.submit.useMutation({
    onSuccess: () => {
      toast.success(copy.done);
      onOpenChange(false);
      utils.forms.getMyForms.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not send it"),
  });

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      submitLabel={copy.submit}
      pending={submit.isPending}
      onSubmit={() => {
        if (!subject.trim() || !content.trim()) return toast.error("Add a subject and the details");
        submit.mutate({ formType: kind, subject: subject.trim(), content: content.trim(), priority });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="form-subject">Subject</Label>
        <Input id="form-subject" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-content">Details</Label>
        <Textarea id="form-content" value={content} onChange={e => setContent(e.target.value)} className="min-h-[120px]" />
      </div>
      {kind !== "resignation" && (
        <div className="space-y-2">
          <Label htmlFor="form-priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="form-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </Shell>
  );
}
