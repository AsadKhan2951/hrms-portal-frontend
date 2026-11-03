import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Users } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/pages/fpb/shared";

/**
 * Whose boards are showing: "My projects", or one employee's. Department heads
 * get the people in their departments, admins everyone.
 */
export function EmployeePicker({
  people, value, onChange, meLabel,
}: {
  people: any[];
  /** The chosen employee's id, or null for the viewer's own projects. */
  value: string | null;
  onChange: (id: string | null) => void;
  meLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const chosen = people.find(p => p.id === value);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p =>
      [p.name, p.designation, p.department].some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }, [people, search]);

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`now-pick${chosen ? " now-pick-on" : ""}`}
          aria-label="Choose whose projects to show"
        >
          {chosen ? <Avatar user={chosen} size={22} /> : <Users className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="truncate">{chosen ? chosen.name : meLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-32px))] rounded-2xl border-border bg-card p-3">
        <div className="now-input-wrap" style={{ minHeight: 44 }}>
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees"
            aria-label="Search employees"
          />
        </div>
        <div className="mt-2 max-h-[340px] overflow-y-auto">
          <button
            type="button"
            className="now-pick-row"
            aria-current={value === null}
            onClick={() => pick(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate font-semibold">{meLabel}</span>
            </span>
            {value === null && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
          </button>
          {shown.map(p => (
            <button
              key={p.id}
              type="button"
              className="now-pick-row"
              aria-current={p.id === value}
              onClick={() => pick(p.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar user={p} size={26} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  {(p.designation || p.department) && (
                    <span className="now-row-sub block truncate">
                      {[p.designation, p.department].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </span>
              {p.id === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
          ))}
          {shown.length === 0 && (
            <p className="now-muted now-small px-2 py-4 text-center">
              {search ? "Nobody matches that." : "No employees in your department yet."}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
