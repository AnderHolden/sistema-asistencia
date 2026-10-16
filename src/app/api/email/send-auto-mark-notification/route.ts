import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendAutoMarkNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { type, count, adminEmails } = await req.json();

    if (!type || count === undefined) {
      return NextResponse.json({ error: "Campos type y count requeridos" }, { status: 400 });
    }

    if (!["children", "staff"].includes(type)) {
      return NextResponse.json({ error: "Type debe ser 'children' o 'staff'" }, { status: 400 });
    }

    let recipients = adminEmails;
    if (!recipients || recipients.length === 0) {
      const adminSnap = await getAdminDb().collection("profiles").where("role", "==", "super_admin").get();
      recipients = adminSnap.docs.map((d) => d.data().email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay administradores con email configurado" }, { status: 400 });
    }

    await sendAutoMarkNotification(recipients, type, count);

    return NextResponse.json({ success: true, sentTo: recipients.length });
  } catch (err: unknown) {
    console.error("Error sending auto-mark notification:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}