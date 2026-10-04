import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAuthorizedCron, getBogotaDate, isBogotaWeekend } from "@/lib/cron-auth";
import { sendAbsenceReport, resolveEmailConfig } from "@/lib/email";

async function executeDailyAbsenceReport(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "No autorizado para ejecutar esta tarea cron" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";
  const today = getBogotaDate();

  if (!force && isBogotaWeekend()) {
    return NextResponse.json({
      skipped: true,
      reason: `Hoy es fin de semana en Colombia (${today}). Reporte diario omitido.`,
    });
  }

  const emailConfig = await resolveEmailConfig();
  if (!force && !emailConfig.notifyDailyReportEnabled) {
    return NextResponse.json({
      skipped: true,
      reason: "El envío del reporte diario consolidado está desactivado en la configuración del sistema.",
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
        reason: `Hoy (${today}) es día festivo institucional (${holidayName}). Reporte omitido.`,
      });
    }
  }

  // 1. Fetch absent children for today
  const absentChildrenSnap = await adminDb
    .collection("attendance_children")
    .where("attendance_date", "==", today)
    .where("status", "==", "absent")
    .get();

  const childIds = absentChildrenSnap.docs.map((d) => d.data().child_id).filter(Boolean);

  const absentChildrenList: Array<{ name: string; code: string }> = [];

  if (childIds.length > 0) {
    const childrenDocs = await Promise.all(
      childIds.map((id) => adminDb.collection("children").doc(id).get())
    );

    childrenDocs.forEach((docSnap) => {
      if (docSnap.exists) {
        const data = docSnap.data()!;
        absentChildrenList.push({
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          code: data.child_id_code || docSnap.id.slice(0, 5),
        });
      }
    });
  }

  // 2. Fetch absent staff for today
  const absentStaffSnap = await adminDb
    .collection("attendance_staff")
    .where("attendance_date", "==", today)
    .where("status", "==", "absent")
    .get();

  const absentStaffList: Array<{ name: string; role: string }> = [];

  if (!absentStaffSnap.empty) {
    const staffQueries = absentStaffSnap.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const coll = data.staff_type === "teacher" ? "teachers" : "practitioners";
      const personSnap = await adminDb.collection(coll).doc(data.staff_id).get();
      if (personSnap.exists) {
        const pData = personSnap.data()!;
        return {
          name: `${pData.first_name || ""} ${pData.last_name || ""}`.trim(),
          role: data.staff_type === "teacher" ? (pData.job_title || "Profesor") : "Practicante",
        };
      }
      return null;
    });

    const results = await Promise.all(staffQueries);
    results.forEach((r) => {
      if (r) absentStaffList.push(r);
    });
  }

  // 3. Fetch admin & director emails
  const adminSnap = await adminDb.collection("profiles").where("role", "==", "super_admin").get();
  const recipientSet = new Set<string>();

  adminSnap.docs.forEach((d) => {
    const email = d.data().email;
    if (email && email.includes("@")) recipientSet.add(email.trim().toLowerCase());
  });

  if (emailConfig.directorEmail && emailConfig.directorEmail.includes("@")) {
    recipientSet.add(emailConfig.directorEmail.trim().toLowerCase());
  }

  const finalRecipients = Array.from(recipientSet);

  if (finalRecipients.length === 0) {
    return NextResponse.json(
      {
        error: "No se encontraron administradores ni correo de dirección registrado para recibir el reporte.",
        absentChildren: absentChildrenList.length,
        absentStaff: absentStaffList.length,
      },
      { status: 400 }
    );
  }

  // 4. Send report
  await sendAbsenceReport(finalRecipients, today, absentChildrenList, absentStaffList);

  return NextResponse.json({
    success: true,
    date: today,
    sentTo: finalRecipients,
    absentChildrenCount: absentChildrenList.length,
    absentStaffCount: absentStaffList.length,
    message: `Reporte diario de ausencias enviado exitosamente a ${finalRecipients.length} destinatarios (${finalRecipients.join(", ")}).`,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await executeDailyAbsenceReport(req);
  } catch (err: unknown) {
    console.error("Error in cron daily-absence-report:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await executeDailyAbsenceReport(req);
  } catch (err: unknown) {
    console.error("Error in cron daily-absence-report:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
