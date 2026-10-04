import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendGuardianAbsenceAlert, resolveEmailConfig } from "@/lib/email";
import { getBogotaDate } from "@/lib/cron-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { childId, childIds, date = getBogotaDate(), reason } = body;

    const idsToProcess: string[] = [];
    if (childId) idsToProcess.push(childId);
    if (Array.isArray(childIds)) idsToProcess.push(...childIds.filter(Boolean));

    if (idsToProcess.length === 0) {
      return NextResponse.json(
        { error: "Debe suministrar childId o childIds para enviar la notificación" },
        { status: 400 }
      );
    }

    const emailConfig = await resolveEmailConfig();
    if (!emailConfig.notifyGuardiansEnabled) {
      return NextResponse.json({
        skipped: true,
        reason: "Las notificaciones automáticas a acudientes están desactivadas en los ajustes del sistema.",
      });
    }

    if (emailConfig.provider === "none") {
      return NextResponse.json({
        skipped: true,
        reason: "Servicio de correo no configurado (SMTP o Resend faltante).",
      });
    }

    const adminDb = getAdminDb();
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results: Array<{ childId: string; name?: string; email?: string; status: string; error?: string }> = [];

    for (const id of idsToProcess) {
      const childDoc = await adminDb.collection("children").doc(id).get();
      if (!childDoc.exists) {
        skippedCount++;
        results.push({ childId: id, status: "not_found" });
        continue;
      }

      const data = childDoc.data()!;
      const childName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      const guardianEmail = (data.guardian_email || "").trim();
      const guardianName = data.guardian_name || "";
      const childCode = data.child_id_code || id.slice(0, 5);
      const shift = data.shift || "manana";

      if (!guardianEmail || !guardianEmail.includes("@")) {
        skippedCount++;
        results.push({ childId: id, name: childName, status: "no_email" });
        continue;
      }

      const sendRes = await sendGuardianAbsenceAlert({
        guardianName,
        guardianEmail,
        childName,
        childCode,
        date,
        shift,
        reason,
      });

      if (sendRes.success) {
        sentCount++;
        results.push({ childId: id, name: childName, email: guardianEmail, status: "sent" });
      } else {
        failedCount++;
        results.push({ childId: id, name: childName, email: guardianEmail, status: "failed", error: sendRes.error });
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      failedCount,
      results,
      message: `Se enviaron ${sentCount} alertas a acudientes (${skippedCount} omitidos sin correo, ${failedCount} fallidos).`,
    });
  } catch (err: unknown) {
    console.error("Error in send-guardian-absence route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
