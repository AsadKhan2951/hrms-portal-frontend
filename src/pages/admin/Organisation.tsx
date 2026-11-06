import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import {
  Crown, KanbanSquare, Loader2, Plus, Shield, Trash2, Users,
} from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isOrgWide, isSuperAdmin, roleLabel } from "@/lib/roles";
import { NowPageHeader } from "@/components/now/NowPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import "./adminB.css";

const NO_ONE = "__none__";

/**
 * Where the hierarchy is actually set up.
 *
 * Departments, who leads them, who may open projects, and everyone's role -
 * all of which existed only as API calls until now, so none of it could be
 * used without a console.
 */
export default function Organisation() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const superAdmin = isSuperAdmin(user?.role);

  const [newDeptName, setNewDeptName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: departments = [], isLoading: deptsLoading } =
    trpc.admin.getDepartments.useQuery();
  const { data: employees = [], isLoading: peopleLoading } =
    trpc.employees.list.useQuery();
  const { data: assignableRoles = [] } = trpc.admin.getAssignableRoles.useQuery();

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const refresh = async () => {
    await Promise.all([
      utils.admin.getDepartments.invalidate(),
      utils.employees.list.invalidate(),
    ]);
  };

  const createDept = trpc.admin.createDepartment.useMutation({
    onSuccess: async () => { await refresh(); setNewDeptName(""); toast.success("Department created"); },
    onError,
  });
  const setHead = trpc.admin.setDepartmentHead.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Head updated"); },
    onError,
  });
  // Who may open projects: people the admin names (the project manager).
  const { data: creators = [] } = trpc.admin.getProjectCreators.useQuery();
  const [newCreator, setNewCreator] = useState<string>(NO_ONE);
  const setCreator = trpc.admin.setUserProjectRights.useMutation({
    onSuccess: async (_: unknown, vars: { allowed: boolean }) => {
      await utils.admin.getProjectCreators.invalidate();
      setNewCreator(NO_ONE);
      toast.success(vars.allowed ? "Can now create projects" : "Project rights removed");
    },
    onError,
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Role updated"); },
    onError,
  });
  const setDept = trpc.admin.setUserDepartment.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Moved"); },
    onError,
  });
  const deleteDept = trpc.admin.deleteDepartment.useMutation({
    onSuccess: async (removed: any) => {
      await refresh();
      toast.success(`${removed?.name ?? "Department"} deleted`);
    },
    onError,
  });

  const people = useMemo(
    () => [...(employees as any[])].sort((a, b) => (a?.name ?? "").localeCompare(b?.name ?? "")),
    [employees]
  );

  // Anyone without a department has nowhere for their leave to go, so they are
  // worth calling out rather than leaving to be noticed.
  const unassigned = people.filter(p => !p?.department);

  if (user && !isOrgWide(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const withBusy = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    try { await run(); } finally { setBusyId(null); }
  };

  return (
    <AdminLayout>
      <div className="now-page">
        <NowPageHeader
          title="Organisation"
          subtitle="Departments, who leads them, and what each person is allowed to do."
        />

        <div className="now-stat-strip">
          <div>
            <div className="now-stat-label">Departments</div>
            <div className="now-stat-value">{departments.length}</div>
            <div className="now-stat-label">
              {(departments as any[]).filter(d => !d.headName).length} without a head
            </div>
          </div>
          <div>
            <div className="now-stat-label">People</div>
            <div className="now-stat-value">{people.length}</div>
            <div className="now-stat-label">in the organisation</div>
          </div>
          <div>
            <div className="now-stat-label">No department</div>
            <div className={`now-stat-value${unassigned.length > 0 ? " now-warn" : ""}`}>{unassigned.length}</div>
            <div className="now-stat-label">leave has nowhere to go</div>
          </div>
          <div>
            <div className="now-stat-label">Project managers</div>
            <div className="now-stat-value">{(creators as any[]).length}</div>
            <div className="now-stat-label">may create projects</div>
          </div>
        </div>

        {!superAdmin && (
          <section className="now-card tinted">
            <p className="now-body-2">
              Appointing heads, granting project rights and changing roles are
              a super admin's to do. You can see the structure and move people
              between departments.
            </p>
          </section>
        )}

        {unassigned.length > 0 && (
          <section className="now-card nb-notice">
            <p className="text-sm">
              <span className="font-bold">{unassigned.length} without a department:</span>{" "}
              {unassigned.map(p => p.name).join(", ")}.
            </p>
            <p className="now-row-sub">
              Their leave requests have no head to go to and will fall to a head
              of operations or an admin.
            </p>
          </section>
        )}

        <Tabs defaultValue="departments" className="gap-4">
          <TabsList>
            <TabsTrigger value="departments">
              Departments ({departments.length})
            </TabsTrigger>
            <TabsTrigger value="people">People ({people.length})</TabsTrigger>
            <TabsTrigger value="projects">Project managers ({(creators as any[]).length})</TabsTrigger>
          </TabsList>

          {/* ───────────────────────────────────────────── Project managers */}
          <TabsContent value="projects" className="flex flex-col gap-4">
            <section className="now-card">
              <p className="now-body-2">
                Only the people listed here (and admins) can create projects. Department heads
                receive tasks for their departments; they do not open projects.
              </p>
              {superAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={newCreator} onValueChange={setNewCreator}>
                    <SelectTrigger className="w-full sm:w-72" aria-label="Person to allow">
                      <SelectValue placeholder="Choose a person" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ONE}>Choose a person</SelectItem>
                      {people
                        .filter(p => !(creators as any[]).some(c => c.id === String(p.id)))
                        .map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                            {p.position ? ` · ${p.position}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="now-btn sm ink"
                    disabled={newCreator === NO_ONE || setCreator.isPending}
                    onClick={() => setCreator.mutate({ userId: newCreator, allowed: true })}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Allow to create projects
                  </button>
                </div>
              ) : (
                <p className="now-row-sub">Only an admin can change this list.</p>
              )}
            </section>

            <section className="now-card flush" aria-label="Project managers">
              <h2 className="now-h2 pb-2">Project managers</h2>
              {(creators as any[]).length === 0 && (
                <div className="now-row now-muted">
                  Nobody yet. Until someone is added, only admins can create projects.
                </div>
              )}
              {(creators as any[]).map(c => (
                <div key={c.id} className="now-row wrap">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="now-icon-btn ground" aria-hidden="true" style={{ width: 40, height: 40, flex: "0 0 40px" }}>
                      <KanbanSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="now-row-title">{c.name}</div>
                      <div className="now-row-sub">
                        {[c.position, c.department].filter(Boolean).join(" · ") || "No designation"}
                      </div>
                    </div>
                  </div>
                  {superAdmin && (
                    <button
                      type="button"
                      className="now-btn sm ground"
                      disabled={setCreator.isPending}
                      onClick={() => setCreator.mutate({ userId: c.id, allowed: false })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </section>
          </TabsContent>

          {/* ───────────────────────────────────────────── Departments */}
          <TabsContent value="departments" className="flex flex-col gap-4">
            {superAdmin && (
              <section className="now-card">
                <Label htmlFor="new-dept-name" className="nb-label" style={{ marginBottom: 0 }}>New department</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="new-dept-name"
                    className="min-w-0"
                    style={{ flex: "1 1 220px" }}
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    placeholder="e.g. Customer Success"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newDeptName.trim()) {
                        createDept.mutate({ name: newDeptName.trim() });
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="now-btn sm ink"
                    onClick={() => createDept.mutate({ name: newDeptName.trim() })}
                    disabled={!newDeptName.trim() || createDept.isPending}
                  >
                    {createDept.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Adding" />
                      : <><Plus className="h-4 w-4" aria-hidden="true" /> Add</>}
                  </button>
                </div>
              </section>
            )}

            <section className="now-card flush" aria-label="Departments">
              <h2 className="now-h2 pb-2">Departments</h2>
              {deptsLoading && (
                <div className="now-row now-muted">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...
                  </span>
                </div>
              )}
              {!deptsLoading && departments.length === 0 && (
                <div className="now-row now-muted">No departments yet.</div>
              )}

              {(departments as any[]).map(dept => (
                <div key={dept.id} className="now-row wrap" style={{ alignItems: "flex-end", padding: "16px 0" }}>
                  <div className="min-w-0" style={{ flex: "1 1 220px", alignSelf: "center" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="now-row-title">{dept.name}</h3>
                      <span className="now-pill nb-plain inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {dept.memberCount}
                      </span>
                    </div>
                    <p className="now-row-sub mt-1 flex items-center gap-1.5">
                      <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {dept.headName
                        ? <>Led by <span className="font-semibold text-foreground">{dept.headName}</span></>
                        : <span className="now-warn">No head — leave escalates upwards</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0">
                      <Label className="nb-label">Head</Label>
                      <Select
                        value={dept.headUserId ?? NO_ONE}
                        disabled={!superAdmin || busyId === dept.id}
                        onValueChange={value =>
                          withBusy(dept.id, () =>
                            setHead.mutateAsync({
                              departmentId: dept.id,
                              userId: value === NO_ONE ? null : value,
                            })
                          )
                        }
                      >
                        <SelectTrigger className="w-56 max-w-full" aria-label={`Head of ${dept.name}`}>
                          <SelectValue placeholder="Nobody" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ONE}>Nobody</SelectItem>
                          {people.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.department ? ` · ${p.department}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {superAdmin && (
                      <button
                        type="button"
                        className="now-icon-btn ground nb-bad"
                        aria-label={`Delete ${dept.name}`}
                        // An empty department is the only one safe to remove:
                        // anyone left pointing at a deleted one would have no
                        // head, and their leave would stop routing anywhere.
                        // The server refuses it too, with the same reason.
                        disabled={dept.memberCount > 0 || busyId === dept.id}
                        title={
                          dept.memberCount > 0
                            ? `Move its ${dept.memberCount} ${dept.memberCount === 1 ? "person" : "people"} out first`
                            : "Delete this department"
                        }
                        onClick={() => {
                          if (!window.confirm(`Delete ${dept.name}?`)) return;
                          withBusy(dept.id, () =>
                            deleteDept.mutateAsync({ departmentId: dept.id })
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </TabsContent>

          {/* ────────────────────────────────────────────────── People */}
          <TabsContent value="people">
            <section className="now-card flush" aria-label="People">
              <h2 className="now-h2 pb-2">People</h2>
              {peopleLoading && (
                <div className="now-row now-muted">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...
                  </span>
                </div>
              )}

              {people.map(person => {
                const isSelf = person.id === user?.id;
                return (
                  <div key={person.id} className="now-row wrap" style={{ alignItems: "flex-end", padding: "16px 0" }}>
                    <div className="min-w-0" style={{ flex: "1 1 220px", alignSelf: "center" }}>
                      <p className="now-row-title flex flex-wrap items-center gap-2">
                        {person.name}
                        {person.role !== "user" && (
                          <span className="now-pill nb-info-soft nb-plain inline-flex items-center gap-1">
                            <Shield className="h-3 w-3" aria-hidden="true" />
                            {roleLabel(person.role)}
                          </span>
                        )}
                      </p>
                      <p className="now-row-sub">
                        {person.position || "—"}
                        {person.department ? ` · ${person.department}` : " · no department"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0">
                        <Label className="nb-label">Department</Label>
                        <Select
                          value={
                            (departments as any[]).find(d => d.name === person.department)?.id
                            ?? NO_ONE
                          }
                          disabled={busyId === person.id}
                          onValueChange={value =>
                            withBusy(person.id, () =>
                              setDept.mutateAsync({
                                userId: person.id,
                                departmentId: value === NO_ONE ? null : value,
                              })
                            )
                          }
                        >
                          <SelectTrigger className="w-44 max-w-full" aria-label={`Department of ${person.name}`}>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ONE}>None</SelectItem>
                            {(departments as any[]).map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0">
                        <Label className="nb-label">Role</Label>
                        <Select
                          value={person.role ?? "user"}
                          // Nobody edits their own role: locking yourself out
                          // of your own portal should not be one click away.
                          disabled={isSelf || assignableRoles.length === 0 || busyId === person.id}
                          onValueChange={value =>
                            withBusy(person.id, () =>
                              setRole.mutateAsync({ userId: person.id, role: value })
                            )
                          }
                        >
                          <SelectTrigger className="w-48 max-w-full" aria-label={`Role of ${person.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* The caller's own level and above are absent:
                                getAssignableRoles only returns what they may
                                hand out. The current value is shown so the
                                picker is not blank for someone senior. */}
                            {!(assignableRoles as any[]).some(r => r.value === person.role) && (
                              <SelectItem value={person.role ?? "user"} disabled>
                                {roleLabel(person.role)}
                              </SelectItem>
                            )}
                            {(assignableRoles as any[]).map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
