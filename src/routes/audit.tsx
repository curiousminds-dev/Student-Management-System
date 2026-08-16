import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { ErrorState, TableSkeleton } from "@/components/common/States";
import { auditService } from "@/services";

export const Route = createFileRoute("/audit")({ component: AuditPage });

function AuditPage() {
  const query = useQuery({ queryKey: ["audit-log"], queryFn: () => auditService.list() });
  return (
    <AppShell permission="audit.view" area="the audit log">
      <PageHeader
        title="Audit log"
        description="Immutable security and operational activity across the school."
      />
      <SectionCard>
        {query.isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(query.data ?? []).map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-2">{event.at}</td>
                    <td className="px-3 py-2">{event.user}</td>
                    <td className="px-3 py-2 font-medium">{event.action}</td>
                    <td className="px-3 py-2">{event.module}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{event.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
