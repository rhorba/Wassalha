import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditLogsPage() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") redirect("/dashboard");

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          100 dernières actions admin
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Acteur</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Cible</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Aucune action enregistrée
              </TableCell>
            </TableRow>
          )}
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("fr-MA", {
                  day:    "2-digit",
                  month:  "short",
                  hour:   "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell className="font-mono text-xs">{log.actorId}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                  {log.action}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span className="font-medium">{log.targetType}</span>
                {" / "}
                <span className="font-mono">{log.targetId.slice(0, 8)}…</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
