import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc,
  orderBy, writeBatch
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { AttendanceChild, AttendanceStaff } from "@/types/database";
import { getTodayDate } from "./utils";

export async function registerSingleChildAttendance(
  childId: string,
  status: "present" | "absent",
  userId: string
) {
  const today = getTodayDate();
  const existingSnap = await getDocs(
    query(
      collection(getFirebaseDb(), "attendance_children"),
      where("child_id", "==", childId),
      where("attendance_date", "==", today)
    )
  );
  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    await updateDoc(existingDoc.ref, {
      status,
      check_in: status === "present" ? new Date().toISOString() : null,
      modified_by: userId,
      modified_at: new Date().toISOString(),
    });
    return existingDoc.id;
  }

  const docRef = await addDoc(collection(getFirebaseDb(), "attendance_children"), {
    child_id: childId,
    attendance_date: today,
    status,
    check_in: status === "present" ? new Date().toISOString() : null,
    registered_by: userId,
    created_at: new Date().toISOString(),
  });
  return docRef.id;
}

export async function registerStaffAttendance(
  staffId: string,
  staffType: "teacher" | "practitioner",
  userId: string,
  signatureUrl: string | null
) {
  const today = getTodayDate();
  const q = query(
    collection(getFirebaseDb(), "attendance_staff"),
    where("staff_id", "==", staffId),
    where("staff_type", "==", staffType),
    where("attendance_date", "==", today)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docRef = snapshot.docs[0].ref;
    await updateDoc(docRef, {
      check_in: new Date().toISOString(),
      check_out: null,
      status: null,
      signature_url: signatureUrl,
      modified_by: userId,
      modified_at: new Date().toISOString(),
    });
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceStaff;
  }

  const docRef = await addDoc(collection(getFirebaseDb(), "attendance_staff"), {
    staff_id: staffId,
    staff_type: staffType,
    attendance_date: today,
    check_in: new Date().toISOString(),
    check_out: null,
    signature_url: signatureUrl,
    registered_by: userId,
    created_at: new Date().toISOString(),
  });

  return { id: docRef.id, staff_id: staffId, staff_type: staffType, attendance_date: today, check_in: new Date().toISOString(), check_out: null, signature_url: signatureUrl, registered_by: userId } as AttendanceStaff;
}

export async function registerStaffAbsent(
  staffId: string,
  staffType: "teacher" | "practitioner",
  userId: string
) {
  const today = getTodayDate();
  const existingSnap = await getDocs(
    query(
      collection(getFirebaseDb(), "attendance_staff"),
      where("staff_id", "==", staffId),
      where("staff_type", "==", staffType),
      where("attendance_date", "==", today)
    )
  );
  if (!existingSnap.empty) {
    const docRef = existingSnap.docs[0].ref;
    await updateDoc(docRef, { status: "absent", check_in: null });
    return existingSnap.docs[0].id;
  }
  const docRef = await addDoc(collection(getFirebaseDb(), "attendance_staff"), {
    staff_id: staffId,
    staff_type: staffType,
    attendance_date: today,
    check_in: null,
    check_out: null,
    status: "absent",
    signature_url: null,
    registered_by: userId,
    created_at: new Date().toISOString(),
  });
  return docRef.id;
}

export async function autoMarkAbsentChildren(userId: string) {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  if (hour < 17 || (hour === 17 && minutes < 50)) return 0;
  const today = getTodayDate();
  const [childrenSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", today))),
  ]);
  const markedIds = new Set(attendanceSnap.docs.map((d) => d.data().child_id));
  const unmarked = childrenSnap.docs.filter((d) => !markedIds.has(d.id));
  if (unmarked.length === 0) return 0;
  const batch = writeBatch(getFirebaseDb());
  for (const childDoc of unmarked) {
    const docRef = doc(collection(getFirebaseDb(), "attendance_children"));
    batch.set(docRef, {
      child_id: childDoc.id,
      attendance_date: today,
      status: "absent",
      registered_by: userId,
      auto_marked: true,
      created_at: now.toISOString(),
    });
  }
  await batch.commit();
  return unmarked.length;
}

export async function autoMarkAbsentStaff(userId: string) {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  if (hour < 16 || (hour === 16 && minutes < 30)) return 0;
  const today = getTodayDate();
  const [teachersSnap, practitionersSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", today))),
  ]);
  const markedIds = new Set(attendanceSnap.docs.map((d) => `${d.data().staff_type}-${d.data().staff_id}`));
  const unmarkedStaff: Array<{ id: string; type: "teacher" | "practitioner" }> = [];
  teachersSnap.docs.forEach((d) => { if (!markedIds.has(`teacher-${d.id}`)) unmarkedStaff.push({ id: d.id, type: "teacher" }); });
  practitionersSnap.docs.forEach((d) => { if (!markedIds.has(`practitioner-${d.id}`)) unmarkedStaff.push({ id: d.id, type: "practitioner" }); });
  if (unmarkedStaff.length === 0) return 0;
  const batch = writeBatch(getFirebaseDb());
  for (const s of unmarkedStaff) {
    const docRef = doc(collection(getFirebaseDb(), "attendance_staff"));
    batch.set(docRef, {
      staff_id: s.id,
      staff_type: s.type,
      attendance_date: today,
      check_in: null,
      check_out: null,
      status: "absent",
      signature_url: null,
      registered_by: userId,
      auto_marked: true,
      created_at: now.toISOString(),
    });
  }
  await batch.commit();
  return unmarkedStaff.length;
}

export async function updateChildAttendance(attendanceId: string, newStatus: "present" | "absent", note: string, userId: string) {
  const attRef = doc(getFirebaseDb(), "attendance_children", attendanceId);
  await updateDoc(attRef, {
    status: newStatus,
    modified_by: userId,
    modification_note: note,
    modified_at: new Date().toISOString(),
  });
}

export async function updateStaffAttendance(attendanceId: string, newCheckIn: string | null, note: string, userId: string) {
  const attRef = doc(getFirebaseDb(), "attendance_staff", attendanceId);
  await updateDoc(attRef, {
    check_in: newCheckIn ? newCheckIn : new Date().toISOString(),
    status: newCheckIn ? null : "absent",
    modified_by: userId,
    modification_note: note,
    modified_at: new Date().toISOString(),
  });
}

export async function deleteImportedAttendance(startDate: string, endDate: string): Promise<number> {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(
      collection(db, "attendance_children"),
      where("registered_by", "==", "csv-import")
    )
  );

  const docsToDelete = snapshot.docs.filter(d => {
    const date = d.data().attendance_date;
    return date >= startDate && date <= endDate;
  });

  if (docsToDelete.length === 0) return 0;

  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < docsToDelete.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = docsToDelete.slice(i, i + batchSize);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}
