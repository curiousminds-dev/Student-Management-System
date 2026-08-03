import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, CheckCircle2, Eye, KeyRound, Mail, Search, ShieldCheck, Smartphone, UserCog, UserPlus, UserX, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staffService, deviceService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { PermissionKey, Role, Staff } from "@/types";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff — accounts, roles and device assignment" },
      {
        name: "description",
        content: "Manage staff accounts, roles, permissions, assigned classes and devices at Nile Crest Secondary School.",
      },
      { property: "og:title", content: "Staff — accounts, roles and device assignment" },
      { property: "og:description", content: "Staff accounts, roles, permissions and device assignment." },
    ],
  }),
  component: StaffPage,
});

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "dashboard.view": "View dashboard",
  "learners.view": "View learners",
  "learners.manage": "Manage learners",
  "learners.identity_only": "Identity-only learner view",
  "attendance.view": "View attendance",
  "attendance.record": "Record attendance",
  "occasions.manage": "Manage occasions",
  "observations.view": "View observations",
  "observations.create": "Create observations",
  "cases.view": "View conduct cases",
  "cases.manage": "Manage conduct cases",
  "welfare.view": "View welfare records",
  "welfare.manage": "Manage welfare records",
  "health.view": "View health records",
  "academics.view": "View academics",
  "academics.manage": "Manage academics",
  "reports.view": "Generate reports",
  "communication.view": "Send communication",
  "staff.manage": "Manage staff",
  "devices.view": "View devices",
  "devices.manage": "Manage devices",
  "audit.view": "View audit log",
  "settings.manage": "Manage settings",
};
const PERMISSION_ORDER = Object.keys(PERMISSION_LABELS) as PermissionKey[];

function StaffPage() {
  const { can } = useAuth();
  const manage = can("staff.manage");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [roleDialogFor, setRoleDialogFor] = useState<Staff | null>(null);
  const [deviceDialogFor, setDeviceDialogFor] = useState<Staff | null>(null);
  const [permsFor, setPermsFor] = useState<Staff | null>(null);
  const [activityFor, setActivityFor] = useState<Staff | null>(null);
  const [suspendFor, setSuspendFor] = useState<Staff | null>(null);

  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: () => staffService.list() });
  const rolesQuery = useQuery({ queryKey: ["staff-roles"], queryFn: () => staffService.roles() });
  const devicesQuery = useQuery({ queryKey: ["devices-for-staff"], queryFn: () => deviceService.list() });

  const roles = (rolesQuery.data ?? []) as Role[];
  const departments = useMemo(() => Array.from(new Set((staffQuery.data ?? []).map((s) => s.department))), [staffQuery.data]);

  const rows = useMemo(() => {
    let list = staffQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => `${s.name} ${s.staffNumber} ${s.email}`.toLowerCase().includes(q));
    if (department !== "all") list = list.filter((s) => s.department === department);
    if (status !== "all") list = list.filter((s) => s.accountStatus === status);
    return list;
  }, [staffQuery.data, search, department, status]);

  const selected = rows.find((s) => s.id === selectedId) ?? null;

  return (
    <AppShell permission="staff.manage" area="staff management">
      <PageHeader
        title="Staff"
        description={staffQuery.isLoading ? "Loading staff accounts…" : `${rows.length} staff members match the current filters.`}
        actions={
          manage ? (
            <Button size="sm" className="h-8 text-[12px]" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add staff member
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search staff"
                placeholder="Search by name, staff number or email"
                className="h-8 pl-8 text-[13px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] text-[12px]" aria-label="Department">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] text-[12px]" aria-label="Account status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {staffQuery.isError ? (
            <ErrorState onRetry={() => void staffQuery.refetch()} />
          ) : staffQuery.isLoading ? (
            <TableSkeleton rows={9} columns={8} />
          ) : rows.length === 0 ? (
            <EmptyState title="No staff match these filters" description="Adjust the search or filters to see more staff members." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead className="sticky top-14 z-10 bg-card">
                  <tr className="border-b border-border">
                    <Th>Staff member</Th>
                    <Th>Staff number</Th>
                    <Th>Department</Th>
                    <Th>Role</Th>
                    <Th>Assigned classes</Th>
                    <Th>Assigned device</Th>
                    <Th>Account status</Th>
                    <Th>Last login</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const isSelected = s.id === selectedId;
                    return (
                      <tr
                        key={s.id}
                        tabIndex={0}
                        onClick={() => { setSelectedId(s.id); setPanelOpen(true); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(s.id); setPanelOpen(true); } }}
                        className={cn(
                          "cursor-pointer border-b border-border/70 text-[12.5px] transition-colors outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          isSelected ? "bg-cyan text-white" : "hover:bg-accent/60",
                        )}
                      >
                        <td className="px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <LearnerAvatar name={s.name} hue={(s.staffNumber.charCodeAt(0) * 7) % 360} size={30} ring={isSelected} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{s.name}</p>
                              <p className={cn("truncate text-[11px]", isSelected ? "text-white/80" : "text-muted-foreground")}>{s.staffNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.staffNumber}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.department}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.roleName}</td>
                        <td className="px-3 py-2">{s.assignedClasses.length ? s.assignedClasses.join(", ") : "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.assignedDeviceName ?? "None"}</td>
                        <td className="px-3 py-2">
                          {isSelected ? <span className="text-[11px] font-medium capitalize">{s.accountStatus}</span> : <StatusBadge status={s.accountStatus} />}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.lastLogin ?? "Never logged in"}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className={cn("h-7 w-7", isSelected && "text-white hover:bg-white/20")} aria-label={`Actions for ${s.name}`}>
                                <UserCog className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedId(s.id); setPanelOpen(true); }}>
                                <Eye className="h-3.5 w-3.5" /> View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPermsFor(s)}>
                                <ShieldCheck className="h-3.5 w-3.5" /> View permissions
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setActivityFor(s)}>
                                <Activity className="h-3.5 w-3.5" /> View activity
                              </DropdownMenuItem>
                              {manage ? (
                                <>
                                  <DropdownMenuSeparator />
                                  {s.accountStatus === "invited" ? (
                                    <DropdownMenuItem onClick={() => toast.success("Invitation resent", { description: `A new invitation email was sent to ${s.email}.` })}>
                                      <Mail className="h-3.5 w-3.5" /> Invite account
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => toast.success("Password reset sent", { description: `A reset link was sent to ${s.email}.` })}>
                                      <KeyRound className="h-3.5 w-3.5" /> Reset password
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setRoleDialogFor(s)}>
                                    <UserCog className="h-3.5 w-3.5" /> Change role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDeviceDialogFor(s)}>
                                    <Smartphone className="h-3.5 w-3.5" /> Assign device
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {s.accountStatus === "suspended" ? (
                                    <DropdownMenuItem onClick={() => toast.success("Account reactivated", { description: `${s.name}'s account can now sign in.` })}>
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate account
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="text-danger" onClick={() => setSuspendFor(s)}>
                                      <UserX className="h-3.5 w-3.5" /> Suspend account
                                    </DropdownMenuItem>
                                  )}
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="hidden xl:block">
          {panelOpen ? (
            <div className="sticky top-[72px]">
              <StaffPanel staff={selected} onClose={() => setPanelOpen(false)} onPermissions={() => selected && setPermsFor(selected)} onActivity={() => selected && setActivityFor(selected)} />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setPanelOpen(true)}>
              Show details panel
            </Button>
          )}
        </aside>
      </div>

      <Sheet open={!!selected && panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md xl:hidden">
          <SheetTitle className="sr-only">Staff details</SheetTitle>
          <StaffPanel staff={selected} onClose={() => setPanelOpen(false)} onPermissions={() => selected && setPermsFor(selected)} onActivity={() => selected && setActivityFor(selected)} embedded />
        </SheetContent>
      </Sheet>

      <SectionCard title="Permissions matrix" description="Permissions granted to each staff role" className="mt-4">
        {rolesQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-20 bg-card px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Permission</th>
                  {roles.map((r) => (
                    <th key={r.key} className="px-3 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase whitespace-nowrap">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ORDER.map((p) => (
                  <tr key={p} className="border-b border-border/70">
                    <td className="sticky left-0 bg-card px-3 py-1.5 font-medium whitespace-nowrap">{PERMISSION_LABELS[p]}</td>
                    {roles.map((r) => (
                      <td key={r.key} className="px-3 py-1.5 text-center">
                        {r.permissions.includes(p) ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-success" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add staff dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>Create a new staff account and send an invitation email.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setAddOpen(false);
              toast.success("Staff member added", { description: "An invitation email has been sent to set up their account." });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full name</Label>
              <Input id="staff-name" required placeholder="e.g. Patricia Nabukalu" className="h-8 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email address</Label>
              <Input id="staff-email" type="email" required placeholder="p.nabukalu@nilecrest.ac.ug" className="h-8 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select defaultValue={roles[0]?.key ?? "teacher"}>
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit">Add and invite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={!!roleDialogFor} onOpenChange={(o) => !o && setRoleDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>Update the role assigned to {roleDialogFor?.name}. This changes their permissions immediately.</DialogDescription>
          </DialogHeader>
          <Select defaultValue={roleDialogFor?.role ?? "teacher"}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogFor(null)}>Cancel</Button>
            <Button
              onClick={() => {
                toast.success("Role updated", { description: `${roleDialogFor?.name}'s role has been changed.` });
                setRoleDialogFor(null);
              }}
            >
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign device dialog */}
      <Dialog open={!!deviceDialogFor} onOpenChange={(o) => !o && setDeviceDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign device</DialogTitle>
            <DialogDescription>Assign a registered device to {deviceDialogFor?.name}.</DialogDescription>
          </DialogHeader>
          <Select defaultValue={deviceDialogFor?.assignedDeviceId ?? ""}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Choose a device" /></SelectTrigger>
            <SelectContent>
              {(devicesQuery.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceDialogFor(null)}>Cancel</Button>
            <Button
              onClick={() => {
                toast.success("Device assigned", { description: `A device has been assigned to ${deviceDialogFor?.name}.` });
                setDeviceDialogFor(null);
              }}
            >
              Assign device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions view */}
      <Dialog open={!!permsFor} onOpenChange={(o) => !o && setPermsFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permissions for {permsFor?.name}</DialogTitle>
            <DialogDescription>Granted through the {permsFor?.roleName} role.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {(roles.find((r) => r.key === permsFor?.role)?.permissions ?? []).map((p) => (
              <div key={p} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[12.5px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {PERMISSION_LABELS[p]}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity view */}
      <Dialog open={!!activityFor} onOpenChange={(o) => !o && setActivityFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recent activity — {activityFor?.name}</DialogTitle>
            <DialogDescription>Latest actions recorded for this staff member.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-[12.5px]">
            <li className="rounded-md bg-muted px-2.5 py-1.5">Signed in from {activityFor?.assignedDeviceName ?? "a school device"} — {activityFor?.lastLogin ?? "no recent sign-in"}</li>
            <li className="rounded-md bg-muted px-2.5 py-1.5">Recorded attendance for {activityFor?.assignedClasses.join(", ") || "assigned duties"}</li>
            <li className="rounded-md bg-muted px-2.5 py-1.5">Viewed learner records within {activityFor?.department}</li>
          </ul>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm */}
      <AlertDialog open={!!suspendFor} onOpenChange={(o) => !o && setSuspendFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspendFor?.name}'s account?</AlertDialogTitle>
            <AlertDialogDescription>
              They will immediately lose access to the system until the account is reactivated by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                toast.success("Account suspended", { description: `${suspendFor?.name} can no longer sign in.` });
                setSuspendFor(null);
              }}
            >
              Suspend account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>{children}</th>;
}

function StaffPanel({
  staff, onClose, onPermissions, onActivity, embedded,
}: { staff: Staff | null; onClose: () => void; onPermissions: () => void; onActivity: () => void; embedded?: boolean }) {
  if (!staff) {
    return (
      <div className={cn(!embedded && "surface-card")}>
        <EmptyState icon={UserCog} title="No staff member selected" description="Select a row to see the staff member's profile, role and assigned device." />
      </div>
    );
  }
  return (
    <div className={cn("overflow-hidden", !embedded && "surface-card")}>
      <div className="relative border-b border-border px-4 pt-6 pb-4 text-center">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" aria-label="Close details panel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{staff.staffNumber}</p>
        <div className="mt-3 flex justify-center">
          <LearnerAvatar name={staff.name} hue={(staff.staffNumber.charCodeAt(0) * 7) % 360} size={96} />
        </div>
        <h2 className="mt-3 text-[16px] font-semibold">{staff.name}</h2>
        <p className="text-[12px] text-muted-foreground">{staff.roleName} · {staff.department}</p>
        <div className="mt-3 flex justify-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="View permissions" onClick={onPermissions}>
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="View activity" onClick={onActivity}>
            <Activity className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">About</p>
        <dl className="grid grid-cols-2 gap-y-2.5">
          {([
            ["Phone", staff.phone],
            ["Email", staff.email],
            ["Gender", staff.gender],
            ["Joined on", staff.joinedOn],
            ["Assigned device", staff.assignedDeviceName ?? "None"],
            ["Status", staff.accountStatus],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="text-[12.5px] font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Assigned classes</p>
        <p className="text-[12.5px]">{staff.assignedClasses.length ? staff.assignedClasses.join(", ") : "No classes assigned"}</p>
      </div>
    </div>
  );
}
