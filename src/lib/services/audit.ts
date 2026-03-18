import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

interface AuditEventParams {
  actorId:    string;
  actorRole:  string;
  action:     string;
  targetType: string;
  targetId:   string;
}

/**
 * Fire-and-forget audit log. Never throws — errors are swallowed and logged only.
 * Call inline at admin write sites. Awaiting is fine — the insert is fast.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogs).values(params);
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
