import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAuthorizedCron, getBogotaDate, isBogotaWeekend } from "@/lib/cron-auth";
import { sendAutoMarkNotification, sendGuardianAbsenceAlert, resolveEmailConfig } from "@/lib/email";

async function executeAutoMarkChildren(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "No autorizado para ejecutar esta tarea cron" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";
  const today = getBogotaDate();

  if (!force && isBogotaWeekend()) {
    return NextResponse.json({
      skipped: true,
      reason: `Hoy es fin de semana en Colombia (${today}). Auto-cierre omitido.`,
    });
  }

  const adminDb = getAdminDb();

  // Check if today is a registered institutional holiday
  if (!force) {
    const holidaySnap = await adminDb.collection("holidays").where("date", "==", today).get();
    if (!holidaySnap.empty) {
      const holidayName = holidaySnap.docs[0].data().name || "Festivo";
      return NextResponse.json({
        skipped: true,
        reason: `Hoy (${today}) está registrado como día festivo: ${holidayName}. Auto-cierre omitido.`,
      });
    }
  }

  // 1. Fetch active children and existing today's attendance records
  const [childrenSnap, attendanceSnap] = await Promise.all([
    adminDb.collection("children").where("status", "==", "active").get(),
    adminDb.collection("attendance_children").where("attendance_date", "==", today).get(),
  ]);

  const markedChildIds = new Set(attendanceSnap.docs.map((d) => d.data().child_id));

  const unmarkedChildren: Array<{
    id: string;
    name: string;
    code: string;
    guardianEmail?: string;
    guardianName?: string;
    shift?: string;
  }> = [];

  childrenSnap.docs.forEach((d) => {
    if (!markedChildIds.has(d.id)) {
      const data = d.data();
      unmarkedChildren.push({
        id: d.id,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        code: data.child_id_code || d.id.slice(0, 5),
        guardianEmail: data.guardian_email,
        guardianName: data.guardian_name,
        shift: data.shift || "manana",
      });
    }
  });

  if (unmarkedChildren.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      message: `Todos los niños activos (${childrenSnap.size}) ya registraron asistencia para hoy (${today}).`,
    });
  }

  // 2. Commit absent records in batches
  const now = new Date().toISOString();
  const batch = adminDb.batch();

  unmarkedChildren.forEach((child) => {
    const ref = adminDb.collection("attendance_children").doc();
    batch.set(ref, {
      child_id: child.id,
      attendance_date: today,
      status: "absent",
      check_in: null,
      registered_by: "system_cron",
      auto_marked: true,
      created_at: now,
      updated_at: now,
    });
  });

  // Audit Log
  const auditRef = adminDb.collection("audit_logs").doc();
  batch.set(auditRef, {
    action: "auto_mark",
    entity_type: "attendance_children",
    entity_id: null,
    user_id: "system_cron",
    user_email: "cron@casitadetareas.com",
    details: {
      date: today,
      count: unmarkedChildren.length,
      children: unmarkedChildren.map((c) => `${c.code} - ${c.name}`),
    },
    ip_address: "vercel_cron",
    created_at: now,
  });

  await batch.commit();

  // 3. Notify super administrators by email
  try {
    const adminSnap = await adminDb.collection("profiles").where("role", "==", "super_admin").get();
    const adminEmails = adminSnap.docs.map((d) => d.data().email).filter(Boolean);
    if (adminEmails.length > 0) {
      await sendAutoMarkNotification(adminEmails, "children", unmarkedChildren.length);
    }
  } catch (emailErr) {
    console.error("Error sending auto-mark children email notification:", emailErr);
  }

  // 4. Notify guardians of absent children if enabled in system settings
  let guardiansNotified = 0;
  try {
    const emailConfig = await resolveEmailConfig();
    if (emailConfig.notifyGuardiansEnabled && emailConfig.provider !== "none") {
      const childrenWithEmail = unmarkedChildren.filter(
        (c) => c.guardianEmail && c.guardianEmail.includes("@")
      );

      for (const child of childrenWithEmail) {
        try {
          const res = await sendGuardianAbsenceAlert({
            guardianName: child.guardianName,
            guardianEmail: child.guardianEmail!,
            childName: child.name,
            childCode: child.code,
            date: today,
            shift: child.shift,
            reason: "Marcaje automático por límite de horario institucional",
          });
          if (res.success) guardiansNotified++;
        } catch (gErr) {
          console.error(`Error notifying guardian for ${child.name}:`, gErr);
        }
      }
    }
  } catch (batchErr) {
    console.error("Error dispatching guardian absence notifications in cron:", batchErr);
  }

  return NextResponse.json({
    success: true,
    count: unmarkedChildren.length,
    guardiansNotified,
    date: today,
    message: `Se registraron ${unmarkedChildren.length} ausencias automáticas de niños a las 17:50 COT. Se alertó a ${guardiansNotified} acudientes por correo.`,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await executeAutoMarkChildren(req);
  } catch (err: unknown) {
    console.error("Error in cron auto-mark-children:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await executeAutoMarkChildren(req);
  } catch (err: unknown) {
    console.error("Error in cron auto-mark-children:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
