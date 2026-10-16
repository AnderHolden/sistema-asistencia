import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendAbsenceReport } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { date, adminEmails } = await req.json();

    if (!date) {
      return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
    }

    let recipients = adminEmails;
    if (!recipients || recipients.length === 0) {
      const adminSnap = await getAdminDb().collection("profiles").where("role", "==", "super_admin").get();
      recipients = adminSnap.docs.map((d) => d.data().email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No hay administradores con email configurado" }, { status: 400 });
    }

    // Get absent children and staff for the date
    const [childrenSnap, attendanceChildrenSnap, teachersSnap, practitionersSnap, attendanceStaffSnap] = await Promise.all([
      getAdminDb().collection("children").where("status", "==", "active").get(),
      getAdminDb().collection("attendance_children").where("attendance_date", "==", date).get(),
      getAdminDb().collection("teachers").where("status", "==", "active").get(),
      getAdminDb().collection("practitioners").where("status", "==", "active").get(),
      getAdminDb().collection("attendance_staff").where("attendance_date", "==", date).get(),
    ]);

    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; first_name: string; last_name: string; child_id_code: string; status: string }));
    const attendanceChildren = attendanceChildrenSnap.docs.map((d) => d.data());
const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; first_name: string; last_name: string; email: string; status: string }));
const practitioners = practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; first_name: string; last_name: string; email: string; status: string }));
    const attendanceStaff = attendanceStaffSnap.docs.map((d) => d.data());

    const absentChildren = children
      .filter((c) => {
        const att = attendanceChildren.find((a) => a.child_id === c.id);
        return !att || att.status === "absent";
      })
      .map((c) => ({ name: `${c.first_name} ${c.last_name}`, code: c.child_id_code || "" }));

    const allStaff = [
      ...teachers.map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, type: "teacher" as const, email: t.email })),
      ...practitioners.map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, type: "practitioner" as const, email: p.email })),
    ];

    const absentStaff = allStaff
      .filter((s) => {
        const att = attendanceStaff.find((a) => a.staff_id === s.id && a.staff_type === (s.type === "teacher" ? "teacher" : "practitioner"));
        return !att || att.status === "absent" || !att.check_in;
      })
      .map((s) => ({ name: s.name, role: s.type === "teacher" ? "Profesor" : "Practicante" }));

    await sendAbsenceReport(recipients, date, absentChildren, absentStaff);

    return NextResponse.json({ success: true, sentTo: recipients.length, absentChildren: absentChildren.length, absentStaff: absentStaff.length });
  } catch (err: unknown) {
    console.error("Error sending absence report:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}