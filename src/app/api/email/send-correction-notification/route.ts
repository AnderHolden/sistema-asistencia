import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendCorrectionNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { childName, childCode, date, reason, newStatus, adminEmails } = await req.json();

    if (!childName || !childCode || !date || !reason) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    let recipients = adminEmails;
    if (!recipients || recipients.length === 0) {
      const adminSnap = await getAdminDb().collection("profiles").where("role", "==", "super_admin").get();
      recipients = adminSnap.docs.map((d) => d.data().email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay administradores con email configurado" }, { status: 400 });
    }

    await sendCorrectionNotification(recipients, childName, childCode, date, reason, newStatus);

    return NextResponse.json({ success: true, sentTo: recipients.length });
  } catch (err: unknown) {
    console.error("Error sending correction notification:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}