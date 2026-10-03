import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAuthorizedCron, getBogotaDate, isBogotaWeekend } from "@/lib/cron-auth";
import { sendAutoMarkNotification } from "@/lib/email";

async function executeAutoMarkStaff(req: NextRequest) {
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

  // 1. Fetch active teachers and practitioners
  const [teachersSnap, practitionersSnap, attendanceSnap] = await Promise.all([
    adminDb.collection("teachers").where("status", "==", "active").get(),
    adminDb.collection("practitioners").where("status", "==", "active").get(),
    adminDb.collection("attendance_staff").where("attendance_date", "==", today).get(),
  ]);

  // Track existing marked staff
  const markedKeys = new Set(
    attendanceSnap.docs.map((d) => `${d.data().staff_type}-${d.data().staff_id}`)
  );

  const unmarked: Array<{ id: string; type: "teacher" | "practitioner"; name: string }> = [];

  teachersSnap.docs.forEach((d) => {
    const data = d.data();
    if (!markedKeys.has(`teacher-${d.id}`)) {
      unmarked.push({ id: d.id, type: "teacher", name: `${data.first_name || ""} ${data.last_name || ""}`.trim() });
    }
  });

  practitionersSnap.docs.forEach((d) => {
    const data = d.data();
    if (!markedKeys.has(`practitioner-${d.id}`)) {
      unmarked.push({ id: d.id, type: "practitioner", name: `${data.first_name || ""} ${data.last_name || ""}`.trim() });
    }
  });

  if (unmarked.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      message: `Todo el personal activo (${teachersSnap.size + practitionersSnap.size}) ya registró asistencia para hoy (${today}).`,
    });
  }

  // 2. Commit absent records in batches (Firestore allows up to 500 writes per batch)
  const now = new Date().toISOString();
  const batch = adminDb.batch();

  unmarked.forEach((item) => {
    const ref = adminDb.collection("attendance_staff").doc();
    batch.set(ref, {
      staff_id: item.id,
      staff_type: item.type,
      attendance_date: today,
      check_in: null,
      check_out: null,
      status: "absent",
      signature_url: null,
      registered_by: "system_cron",
      auto_marked: true,
      created_at: now,
    });
  });

  // Audit Log
  const auditRef = adminDb.collection("audit_logs").doc();
  batch.set(auditRef, {
    action: "auto_mark",
    entity_type: "attendance_staff",
    entity_id: null,
    user_id: "system_cron",
    user_email: "cron@casitadetareas.com",
    details: {
      date: today,
      count: unmarked.length,
      staff_names: unmarked.map((u) => `${u.type}: ${u.name}`),
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
      await sendAutoMarkNotification(adminEmails, "staff", unmarked.length);
    }
  } catch (emailErr) {
    console.error("Error sending auto-mark staff email notification:", emailErr);
  }

  return NextResponse.json({
    success: true,
    count: unmarked.length,
    date: today,
    message: `Se registraron ${unmarked.length} ausencias automáticas de personal a las 16:30 COT.`,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await executeAutoMarkStaff(req);
  } catch (err: unknown) {
    console.error("Error in cron auto-mark-staff:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await executeAutoMarkStaff(req);
  } catch (err: unknown) {
    console.error("Error in cron auto-mark-staff:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
