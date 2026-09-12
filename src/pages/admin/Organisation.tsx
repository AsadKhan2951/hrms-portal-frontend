import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import {
  Building2, Check, Crown, KanbanSquare, Loader2, Plus, Shield, UserCog, Users,
} from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isOrgWide, isSuperAdmin, roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
  const setRights = trpc.admin.setDepartmentProjectRights.useMutation({
    onSuccess: async () => { await refresh(); },
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Organisation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Departments, who leads them, and what each person is allowed to do.
          </p>
        </div>

        {!superAdmin && (
          <Card className="p-4 bg-muted/40">
            <p className="text-sm text-muted-foreground">
              Appointing heads, granting project rights and changing roles are
              a super admin's to do. You can see the structure and move people
              between departments.
            </p>
          </Card>
        )}

        {unassigned.length > 0 && (
          <Card className="p-4 border-amber-500/40 bg-amber-500/5">
            <p className="text-sm">
              <span className="font-medium">{unassigned.length} without a department:</span>{" "}
              {unassigned.map(p => p.name).join(", ")}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Their leave requests have no head to go to and will fall to a head
              of operations or an admin.
            </p>
          </Card>
        )}

        <Tabs defaultValue="departments">
          <TabsList>
            <TabsTrigger value="departments">
              Departments ({departments.length})
            </TabsTrigger>
            <TabsTrigger value="people">People ({people.length})</TabsTrigger>
          </TabsList>

          {/* ───────────────────────────────────────────── Departments */}
          <TabsContent value="departments" className="mt-4 space-y-3">
            {superAdmin && (
              <Card className="p-4">
                <Label className="text-xs text-muted-foreground">New department</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    placeholder="e.g. Customer Success"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newDeptName.trim()) {
                        createDept.mutate({ name: newDeptName.trim() });
                      }
                    }}
                  />
                  <Button
                    onClick={() => createDept.mutate({ name: newDeptName.trim() })}
                    disabled={!newDeptName.trim() || createDept.isPending}
                  >
                    {createDept.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><Plus className="h-4 w-4 mr-1.5" /> Add</>}
                  </Button>
                </div>
              </Card>
            )}

            {deptsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            )}

            {(departments as any[]).map(dept => (
              <Card key={dept.id} className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{dept.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {dept.memberCount}
                      </Badge>
                      {dept.canCreateProjects && (
                        <Badge className="text-xs bg-violet-600/20 text-violet-300 border-violet-500/40">
                          <KanbanSquare className="h-3 w-3 mr-1" /> Can open projects
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Crown className="h-3 w-3" />
                      {dept.headName
                        ? <>Led by <span className="text-foreground">{dept.headName}</span></>
                        : <span className="text-amber-500">No head — leave escalates upwards</span>}
                    </p>
                  </div>

                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <Label className="text-xs text-muted-foreground">Head</Label>
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
                        <SelectTrigger className="w-56 h-9 mt-1">
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

                    <div className="pb-1.5">
                      <Label className="text-xs text-muted-foreground block mb-2">
                        Project board
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(dept.canCreateProjects)}
                          disabled={!superAdmin || busyId === dept.id}
                          onCheckedChange={checked =>
                            withBusy(dept.id, () =>
                              setRights.mutateAsync({
                                departmentId: dept.id,
                                allowed: checked,
                              })
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          Head may open projects
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* ────────────────────────────────────────────────── People */}
          <TabsContent value="people" className="mt-4">
            {peopleLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            )}

            <div className="space-y-2">
              {people.map(person => {
                const isSelf = person.id === user?.id;
                return (
                  <Card key={person.id} className="p-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {person.name}
                          {person.role !== "user" && (
                            <Badge variant="outline" className="text-[10px]">
                              <Shield className="h-2.5 w-2.5 mr-1" />
                              {roleLabel(person.role)}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {person.position || "—"}
                          {person.department ? ` · ${person.department}` : " · no department"}
                        </p>
                      </div>

                      <div className="flex items-end gap-3 flex-wrap">
                        <div>
                          <Label className="text-xs text-muted-foreground">Department</Label>
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
                            <SelectTrigger className="w-44 h-9 mt-1">
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

                        <div>
                          <Label className="text-xs text-muted-foreground">Role</Label>
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
                            <SelectTrigger className="w-48 h-9 mt-1">
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
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
