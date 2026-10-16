import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendBackupNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { success, details, adminEmails } = await req.json();

    if (success === undefined) {
      return NextResponse.json({ error: "Campo success requerido" }, { status: 400 });
    }

    let recipients = adminEmails;
    if (!recipients || recipients.length === 0) {
      const adminSnap = await getAdminDb().collection("profiles").where("role", "==", "super_admin").get();
      recipients = adminSnap.docs.map((d) => d.data().email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay administradores con email configurado" }, { status: 400 });
    }

    await sendBackupNotification(recipients, success, details);

    return NextResponse.json({ success: true, sentTo: recipients.length });
  } catch (err: unknown) {
    console.error("Error sending backup notification:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}