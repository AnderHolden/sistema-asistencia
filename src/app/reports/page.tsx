"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  exportToExcel,
  exportToCsv,
  exportToPDF,
  exportToPDFDetail,
  exportPersonAttendanceRangePDF,
  type PDFDetailRow,
} from "@/lib/export";
import { getTodayDate, isWeekday, formatTime, getBusinessDaysBetween } from "@/lib/utils";
import { toast } from "react-hot-toast";
import {
  DocumentArrowDownIcon,
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  TableCellsIcon,
  UserIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { DynamicBarChart, DynamicPieChart } from "@/components/charts/DynamicCharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Child, Group, AttendanceChild, Teacher, Practitioner, AttendanceStaff } from "@/types/database";

interface ReportRow {
  childName: string;
  childCode: string;
  groupName: string;
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
}
interface StaffReportRow {
  staffName: string;
  type: string;
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
}
interface SpecificRow {
  id: string;
  code?: string;
  name: string;
  groupId: string | null;
  groupOrType: string;
  date: string;
  status: string;
  statusLabel: string;
  checkIn: string | null;
  signatureUrl: string | null;
  totalPresent: number;
  totalAbsent: number;
  totalBusinessDays: number;
  percentage: number;
}
interface PersonDayRow {
  date: string;
  dateFormatted: string;
  dayName: string;
  status: "present" | "absent";
  statusLabel: string;
  checkIn: string | null;
  signatureUrl: string | null;
}
interface PersonOption {
  id: string;
  code?: string;
  name: string;
  groupId?: string | null;
  groupOrRole: string;
  subtitle: string;
  type: "child" | "teacher" | "practitioner";
}

function buildBusinessDaysRows(
  businessDays: string[],
  rawAtt: Array<Record<string, unknown>>,
  isChild: boolean
): PersonDayRow[] {
  const attMap = new Map<string, Record<string, unknown>>();
  for (const rec of rawAtt) {
    const dStr = rec.attendance_date as string;
    if (dStr) attMap.set(dStr, rec);
  }

  return businessDays
    .map((dateStr) => {
      const rec = attMap.get(dateStr);
      const date = new Date(dateStr + "T12:00:00");
      const isPresent = rec
        ? isChild
          ? (rec.status as string) === "present"
          : (rec.status as string) !== "absent" || Boolean(rec.check_in)
        : false;

      return {
        date: dateStr,
        dateFormatted: date.toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        dayName: date.toLocaleDateString("es-CO", { weekday: "long" }),
        status: (isPresent ? "present" : "absent") as "present" | "absent",
        statusLabel: isPresent ? "Asistió" : "No asistió",
        checkIn: isPresent && (rec?.check_in as string) ? formatTime(rec?.check_in as string) : null,
        signatureUrl: (rec?.signature_url as string) || null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const today = getTodayDate();
  const firstDayOfMonth = `${today.slice(0, 7)}-01`;

  // Catálogos base cargados una sola vez al montar la vista
  const [initialLoading, setInitialLoading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);

  const [catalogChildren, setCatalogChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalogTeachers, setCatalogTeachers] = useState<Teacher[]>([]);
  const [catalogPractitioners, setCatalogPractitioners] = useState<Practitioner[]>([]);
  const [customHolidays, setCustomHolidays] = useState<string[]>([]);

  // Navegación general de reportes
  const [reportTab, setReportTab] = useState<"children" | "staff">("children");
  const [reportType, setReportType] = useState<"aggregate" | "specific" | "person">("aggregate");
  const [groupId, setGroupId] = useState("all");
  const [tableSearch, setTableSearch] = useState("");

  // Estados "Consolidado" (aggregate)
  const [filter, setFilter] = useState<"day" | "week" | "month" | "year" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState(firstDayOfMonth);
  const [customEndDate, setCustomEndDate] = useState(today);
  const [aggChildAtt, setAggChildAtt] = useState<AttendanceChild[]>([]);
  const [aggStaffAtt, setAggStaffAtt] = useState<AttendanceStaff[]>([]);
  const [aggPeriodRange, setAggPeriodRange] = useState<{ startDate: string; endDate: string }>({
    startDate: firstDayOfMonth,
    endDate: today,
  });

  // Estados "Por Fecha" (specific): Rango Desde - Hasta + Selección de Niño/Persona
  const [specificStartDate, setSpecificStartDate] = useState(firstDayOfMonth);
  const [specificEndDate, setSpecificEndDate] = useState(today);
  const [specificPersonId, setSpecificPersonId] = useState<string>("");
  const [specificPersonSearch, setSpecificPersonSearch] = useState("");
  const [specificPersonDropdownOpen, setSpecificPersonDropdownOpen] = useState(false);
  const [specificAttChild, setSpecificAttChild] = useState<AttendanceChild[]>([]);
  const [specificAttStaff, setSpecificAttStaff] = useState<AttendanceStaff[]>([]);

  // Estados "Por Persona" (person): Buscador + Rango Desde - Hasta
  const [personSearch, setPersonSearch] = useState("");
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [personStartDate, setPersonStartDate] = useState(firstDayOfMonth);
  const [personEndDate, setPersonEndDate] = useState(today);
  const [personRawAtt, setPersonRawAtt] = useState<Array<Record<string, unknown>>>([]);

  const generatedByName = useMemo(() => {
    return profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "Usuario";
  }, [profile, user]);

  const generatedByRole = useMemo(() => {
    if (profile?.role === "super_admin") return "SuperAdmin";
    if (profile?.role === "operator") return "Operador";
    return "Usuario Autorizado";
  }, [profile]);

  // 1. Cargar catálogos estáticos UNA sola vez al entrar a Reportes
  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      setInitialLoading(true);
      try {
        const db = getFirebaseDb();
        const [childrenSnap, groupsSnap, teachersSnap, practitionersSnap, holidaysSnap] = await Promise.all([
          getDocs(query(collection(db, "children"), where("status", "==", "active"))).catch(() => null),
          getDocs(collection(db, "groups")).catch(() => null),
          getDocs(query(collection(db, "teachers"), where("status", "==", "active"))).catch(() => null),
          getDocs(query(collection(db, "practitioners"), where("status", "==", "active"))).catch(() => null),
          getDocs(collection(db, "holidays")).catch(() => null),
        ]);

        if (cancelled) return;

        if (groupsSnap) {
          setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
        }
        if (childrenSnap) {
          setCatalogChildren(childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child)));
        }
        if (teachersSnap) {
          setCatalogTeachers(teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)));
        }
        if (practitionersSnap) {
          setCatalogPractitioners(practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner)));
        }
        if (holidaysSnap) {
          setCustomHolidays(
            holidaysSnap.docs.map((d) => String(d.data().holiday_date || "")).filter(Boolean)
          );
        }
      } catch (err) {
        console.error("Error cargando catálogos de reportes:", err);
        toast.error("Error al cargar datos iniciales");
      } finally {
        if (!cancelled) {
          setCatalogLoaded(true);
          setInitialLoading(false);
        }
      }
    }
    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lista unificada de personas derivada en memoria (0 llamadas extra)
  const allPeople = useMemo<PersonOption[]>(() => {
    return [
      ...catalogChildren
        .map((c) => {
          const gName = groups.find((g) => g.id === c.group_id)?.name || "Sin grupo";
          return {
            id: c.id,
            code: c.child_id_code || "",
            name: `${c.first_name} ${c.last_name}`,
            groupId: c.group_id,
            groupOrRole: gName,
            subtitle: `${c.child_id_code ? `${c.child_id_code} · ` : ""}${gName}`,
            type: "child" as const,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...catalogTeachers
        .map((t) => ({
          id: t.id,
          code: t.document || "",
          name: `${t.first_name} ${t.last_name}`,
          groupId: null,
          groupOrRole: "Profesor",
          subtitle: `Profesor · ${t.document || ""}`,
          type: "teacher" as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...catalogPractitioners
        .map((p) => ({
          id: p.id,
          code: p.document || "",
          name: `${p.first_name} ${p.last_name}`,
          groupId: null,
          groupOrRole: "Practicante",
          subtitle: `Practicante · ${p.document || ""}`,
          type: "practitioner" as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [catalogChildren, catalogTeachers, catalogPractitioners, groups]);

  // 2. Cargar asistencias de "Consolidado" solo cuando cambie el filtro de período
  useEffect(() => {
    if (!catalogLoaded || reportType !== "aggregate") return;
    let cancelled = false;

    async function fetchAggregateAttendance() {
      setSectionLoading(true);
      try {
        const now = new Date();
        let startDate: string, endDate: string;
        if (filter === "day") {
          startDate = endDate = getTodayDate();
        } else if (filter === "week") {
          const day = now.getDay();
          const monday = new Date(now);
          monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
          endDate = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
        } else if (filter === "month") {
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          endDate = getTodayDate();
        } else if (filter === "custom") {
          startDate = customStartDate || `${now.getFullYear()}-01-01`;
          endDate = customEndDate || getTodayDate();
        } else {
          startDate = `${now.getFullYear()}-01-01`;
          endDate = getTodayDate();
        }

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const sixMonthsStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
        const queryStart = startDate < sixMonthsStart ? startDate : sixMonthsStart;
        const queryEnd = endDate > getTodayDate() ? endDate : getTodayDate();

        const db = getFirebaseDb();
        const [attendanceSnap, staffAttendanceSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "attendance_children"),
              where("attendance_date", ">=", queryStart),
              where("attendance_date", "<=", queryEnd)
            )
          ),
          getDocs(
            query(
              collection(db, "attendance_staff"),
              where("attendance_date", ">=", queryStart),
              where("attendance_date", "<=", queryEnd)
            )
          ),
        ]);

        if (cancelled) return;
        setAggPeriodRange({ startDate, endDate });
        setAggChildAtt(
          attendanceSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as AttendanceChild))
            .filter((a) => isWeekday(a.attendance_date))
        );
        setAggStaffAtt(
          staffAttendanceSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff))
            .filter((a) => isWeekday(a.attendance_date))
        );
      } catch (err) {
        console.error("Error cargando reporte consolidado:", err);
        toast.error("No se pudo actualizar el reporte consolidado");
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    }

    fetchAggregateAttendance();
    return () => {
      cancelled = true;
    };
  }, [catalogLoaded, reportType, filter, customStartDate, customEndDate]);

  // 3. Cargar asistencias de "Por Fecha" (Desde - Hasta) SIN ciclos de estado
  useEffect(() => {
    if (!catalogLoaded || reportType !== "specific") return;
    if (!specificStartDate || !specificEndDate || specificStartDate > specificEndDate) {
      setSpecificAttChild([]);
      setSpecificAttStaff([]);
      return;
    }

    let cancelled = false;
    async function fetchSpecificRangeAttendance() {
      setSectionLoading(true);
      try {
        const db = getFirebaseDb();
        const [attChildSnap, attStaffSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "attendance_children"),
              where("attendance_date", ">=", specificStartDate),
              where("attendance_date", "<=", specificEndDate)
            )
          ),
          getDocs(
            query(
              collection(db, "attendance_staff"),
              where("attendance_date", ">=", specificStartDate),
              where("attendance_date", "<=", specificEndDate)
            )
          ),
        ]);

        if (cancelled) return;
        setSpecificAttChild(attChildSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild)));
        setSpecificAttStaff(attStaffSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff)));
      } catch (err) {
        console.error("Error cargando reporte por rango de fechas:", err);
        toast.error("No se pudo consultar el rango de fechas");
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    }

    fetchSpecificRangeAttendance();
    return () => {
      cancelled = true;
    };
  }, [catalogLoaded, reportType, specificStartDate, specificEndDate]);

  // 4. Cargar asistencias en "Por Persona" solo cuando cambia la persona elegida
  const selectedPersonObj = useMemo(
    () => allPeople.find((p) => p.id === selectedPersonId) || null,
    [allPeople, selectedPersonId]
  );
  const selectedPersonType = selectedPersonObj?.type || null;

  useEffect(() => {
    if (!catalogLoaded || reportType !== "person" || !selectedPersonId || !selectedPersonType) return;
    let cancelled = false;

    async function fetchPersonRecords() {
      setSectionLoading(true);
      try {
        const isChild = selectedPersonType === "child";
        const db = getFirebaseDb();
        const attSnap = await getDocs(
          query(
            collection(db, isChild ? "attendance_children" : "attendance_staff"),
            isChild ? where("child_id", "==", selectedPersonId) : where("staff_id", "==", selectedPersonId)
          )
        );
        if (cancelled) return;
        setPersonRawAtt(attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>)));
      } catch (err) {
        console.error("Error cargando historial individual:", err);
        toast.error("No se pudo cargar el historial de la persona");
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    }

    fetchPersonRecords();
    return () => {
      cancelled = true;
    };
  }, [catalogLoaded, reportType, selectedPersonId, selectedPersonType]);

  // Cálculos derivados en memoria para "Consolidado"
  const { reportData, staffReportData, childrenMonthlyData, staffMonthlyData } = useMemo(() => {
    const { startDate, endDate } = aggPeriodRange;
    const periodChildAtt = aggChildAtt.filter(
      (a) => a.attendance_date >= startDate && a.attendance_date <= endDate
    );
    const filteredChildren =
      groupId === "all" ? catalogChildren : catalogChildren.filter((c) => c.group_id === groupId);

    const rData: ReportRow[] = filteredChildren
      .map((child) => {
        const childAtt = periodChildAtt.filter((a) => a.child_id === child.id);
        const present = childAtt.filter((a) => a.status === "present").length;
        const absent = childAtt.filter((a) => a.status === "absent").length;
        const total = present + absent;
        return {
          childName: `${child.first_name} ${child.last_name}`,
          childCode: child.child_id_code || "",
          groupName: groups.find((g) => g.id === child.group_id)?.name || "Sin grupo",
          totalPresent: present,
          totalAbsent: absent,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      })
      .sort((a, b) => a.childName.localeCompare(b.childName));

    const periodStaffAtt = aggStaffAtt.filter(
      (a) => a.attendance_date >= startDate && a.attendance_date <= endDate
    );
    const allStaff = [
      ...catalogTeachers.map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, type: "Profesor" })),
      ...catalogPractitioners.map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        type: "Practicante",
      })),
    ];

    const sData: StaffReportRow[] = allStaff
      .map((s) => {
        const sAtt = periodStaffAtt.filter((a) => a.staff_id === s.id);
        const present = sAtt.filter((a) => a.status !== "absent" || a.check_in).length;
        const absent = sAtt.filter((a) => a.status === "absent" && !a.check_in).length;
        const total = present + absent;
        return {
          staffName: s.name,
          type: s.type,
          totalPresent: present,
          totalAbsent: absent,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      })
      .sort((a, b) => a.staffName.localeCompare(b.staffName));

    const now = new Date();
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const cMonthly: { month: string; presentes: number; ausentes: number }[] = [];
    const sMonthly: { month: string; presentes: number; ausentes: number }[] = [];
    const allowedChildIds = new Set(filteredChildren.map((c) => c.id));

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const sDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const eDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const monthChildAtt = aggChildAtt.filter(
        (a) => a.attendance_date >= sDate && a.attendance_date < eDate && allowedChildIds.has(a.child_id)
      );
      cMonthly.push({
        month: monthNames[d.getMonth()],
        presentes: monthChildAtt.filter((a) => a.status === "present").length,
        ausentes: monthChildAtt.filter((a) => a.status === "absent").length,
      });

      const monthStaffAtt = aggStaffAtt.filter(
        (a) => a.attendance_date >= sDate && a.attendance_date < eDate
      );
      sMonthly.push({
        month: monthNames[d.getMonth()],
        presentes: monthStaffAtt.filter((a) => a.status !== "absent" || a.check_in).length,
        ausentes: monthStaffAtt.filter((a) => a.status === "absent" && !a.check_in).length,
      });
    }

    return {
      reportData: rData,
      staffReportData: sData,
      childrenMonthlyData: cMonthly,
      staffMonthlyData: sMonthly,
    };
  }, [aggPeriodRange, aggChildAtt, aggStaffAtt, catalogChildren, catalogTeachers, catalogPractitioners, groups, groupId]);

  // Cálculos derivados en memoria para "Por Fecha" (Lunes a Viernes excluyendo sábados, domingos y festivos)
  const specificBusinessInfo = useMemo(() => {
    return getBusinessDaysBetween(specificStartDate, specificEndDate, customHolidays);
  }, [specificStartDate, specificEndDate, customHolidays]);

  const specificHolidaysCount = specificBusinessInfo.holidaysInPeriod.length;
  const hasBusinessDaysInSpecificRange = specificBusinessInfo.businessDays.length > 0;

  const { specificData, specificPersonDays } = useMemo(() => {
    const { businessDays } = specificBusinessInfo;
    if (businessDays.length === 0) {
      return { specificData: [] as SpecificRow[], specificPersonDays: [] as PersonDayRow[] };
    }

    const businessDaySet = new Set(businessDays);
    const validChildAtt = specificAttChild.filter((a) => businessDaySet.has(a.attendance_date));
    const validStaffAtt = specificAttStaff.filter((a) => businessDaySet.has(a.attendance_date));

    let pDays: PersonDayRow[] = [];
    if (specificPersonId) {
      if (reportTab === "children") {
        const personRecords = validChildAtt
          .filter((a) => a.child_id === specificPersonId)
          .map((a) => ({ ...a } as unknown as Record<string, unknown>));
        pDays = buildBusinessDaysRows(businessDays, personRecords, true);
      } else {
        const personRecords = validStaffAtt
          .filter((a) => a.staff_id === specificPersonId)
          .map((a) => ({ ...a } as unknown as Record<string, unknown>));
        pDays = buildBusinessDaysRows(businessDays, personRecords, false);
      }
    }

    const isSingleDay = specificStartDate === specificEndDate;
    const singleDateFormatted = isSingleDay
      ? new Date(specificStartDate + "T12:00:00").toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : `${specificStartDate} a ${specificEndDate}`;

    if (reportTab === "children") {
      const childRows: SpecificRow[] = catalogChildren
        .map((child) => {
          const groupName = groups.find((g) => g.id === child.group_id)?.name || "Sin grupo";
          const childAtt = validChildAtt.filter((a) => a.child_id === child.id);
          const presentCount = childAtt.filter((a) => a.status === "present").length;
          const totalBDays = businessDays.length;
          const absentCount = Math.max(0, totalBDays - presentCount);
          const pct = totalBDays > 0 ? Math.round((presentCount / totalBDays) * 100) : 0;
          const singleAtt = isSingleDay ? childAtt[0] : undefined;

          return {
            id: child.id,
            code: child.child_id_code || "",
            name: `${child.first_name} ${child.last_name}`,
            groupId: child.group_id,
            groupOrType: groupName,
            date: singleDateFormatted,
            status: isSingleDay ? singleAtt?.status || "absent" : pct >= 50 ? "present" : "absent",
            statusLabel: isSingleDay
              ? singleAtt?.status === "present"
                ? "Asistió"
                : "No asistió"
              : `${presentCount} asistió / ${absentCount} no asistió`,
            checkIn: isSingleDay && singleAtt?.check_in ? formatTime(singleAtt.check_in) : null,
            signatureUrl: null,
            totalPresent: presentCount,
            totalAbsent: absentCount,
            totalBusinessDays: totalBDays,
            percentage: pct,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return { specificData: childRows, specificPersonDays: pDays };
    } else {
      const staffRows: SpecificRow[] = [
        ...catalogTeachers.map((t) => {
          const sAtt = validStaffAtt.filter((a) => a.staff_id === t.id && a.staff_type === "teacher");
          const presentCount = sAtt.filter((a) => !(a.status === "absent" && !a.check_in)).length;
          const totalBDays = businessDays.length;
          const absentCount = Math.max(0, totalBDays - presentCount);
          const pct = totalBDays > 0 ? Math.round((presentCount / totalBDays) * 100) : 0;
          const singleAtt = isSingleDay ? sAtt[0] : undefined;
          const isPres = singleAtt ? !(singleAtt.status === "absent" && !singleAtt.check_in) : false;

          return {
            id: t.id,
            code: t.document || "",
            name: `${t.first_name} ${t.last_name}`,
            groupId: null,
            groupOrType: "Profesor",
            date: singleDateFormatted,
            status: isSingleDay ? (isPres ? "present" : "absent") : pct >= 50 ? "present" : "absent",
            statusLabel: isSingleDay
              ? isPres
                ? "Asistió"
                : "No asistió"
              : `${presentCount} asistió / ${absentCount} no asistió`,
            checkIn: isSingleDay && singleAtt?.check_in ? formatTime(singleAtt.check_in) : null,
            signatureUrl: isSingleDay ? singleAtt?.signature_url || null : null,
            totalPresent: presentCount,
            totalAbsent: absentCount,
            totalBusinessDays: totalBDays,
            percentage: pct,
          };
        }),
        ...catalogPractitioners.map((p) => {
          const sAtt = validStaffAtt.filter((a) => a.staff_id === p.id && a.staff_type === "practitioner");
          const presentCount = sAtt.filter((a) => !(a.status === "absent" && !a.check_in)).length;
          const totalBDays = businessDays.length;
          const absentCount = Math.max(0, totalBDays - presentCount);
          const pct = totalBDays > 0 ? Math.round((presentCount / totalBDays) * 100) : 0;
          const singleAtt = isSingleDay ? sAtt[0] : undefined;
          const isPres = singleAtt ? !(singleAtt.status === "absent" && !singleAtt.check_in) : false;

          return {
            id: p.id,
            code: p.document || "",
            name: `${p.first_name} ${p.last_name}`,
            groupId: null,
            groupOrType: "Practicante",
            date: singleDateFormatted,
            status: isSingleDay ? (isPres ? "present" : "absent") : pct >= 50 ? "present" : "absent",
            statusLabel: isSingleDay
              ? isPres
                ? "Asistió"
                : "No asistió"
              : `${presentCount} asistió / ${absentCount} no asistió`,
            checkIn: isSingleDay && singleAtt?.check_in ? formatTime(singleAtt.check_in) : null,
            signatureUrl: isSingleDay ? singleAtt?.signature_url || null : null,
            totalPresent: presentCount,
            totalAbsent: absentCount,
            totalBusinessDays: totalBDays,
            percentage: pct,
          };
        }),
      ].sort((a, b) => a.name.localeCompare(b.name));
      return { specificData: staffRows, specificPersonDays: pDays };
    }
  }, [
    specificBusinessInfo,
    specificAttChild,
    specificAttStaff,
    specificPersonId,
    reportTab,
    specificStartDate,
    specificEndDate,
    catalogChildren,
    catalogTeachers,
    catalogPractitioners,
    groups,
  ]);

  // Cálculos derivados en memoria para "Por Persona"
  const { personHistory, personHolidaysCount } = useMemo(() => {
    if (!selectedPersonId || !selectedPersonType) {
      return { personHistory: [] as PersonDayRow[], personHolidaysCount: 0 };
    }
    const { businessDays, holidaysInPeriod } = getBusinessDaysBetween(
      personStartDate,
      personEndDate,
      customHolidays
    );
    const filteredRaw = personRawAtt.filter((a) => {
      const d = a.attendance_date as string;
      return d && d >= personStartDate && d <= personEndDate;
    });
    const rows = buildBusinessDaysRows(businessDays, filteredRaw, selectedPersonType === "child");
    return { personHistory: rows, personHolidaysCount: holidaysInPeriod.length };
  }, [selectedPersonId, selectedPersonType, personStartDate, personEndDate, customHolidays, personRawAtt]);

  const peopleForCurrentTab = useMemo(() => {
    return allPeople
      .filter((p) => (reportTab === "children" ? p.type === "child" : p.type !== "child"))
      .filter((p) => reportTab !== "children" || groupId === "all" || p.groupId === groupId);
  }, [allPeople, reportTab, groupId]);

  const specificPersonResults = useMemo(() => {
    if (!specificPersonDropdownOpen) return [];
    const term = specificPersonSearch.trim().toLowerCase();
    const list = peopleForCurrentTab;
    if (!term) return list.slice(0, 25);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.subtitle.toLowerCase().includes(term) ||
          (p.code && p.code.toLowerCase().includes(term))
      )
      .slice(0, 25);
  }, [specificPersonSearch, peopleForCurrentTab, specificPersonDropdownOpen]);

  const selectedSpecificPerson = useMemo(() => {
    if (!specificPersonId) return null;
    return allPeople.find((p) => p.id === specificPersonId) || null;
  }, [specificPersonId, allPeople]);

  const personResults = useMemo(() => {
    if (!personDropdownOpen || personSearch.trim().length === 0 || allPeople.length === 0) return [];
    const term = personSearch.toLowerCase();
    return allPeople
      .filter((p) => (reportTab === "children" ? p.type === "child" : p.type !== "child"))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.subtitle.toLowerCase().includes(term) ||
          (p.code && p.code.toLowerCase().includes(term))
      )
      .slice(0, 20);
  }, [personSearch, allPeople, personDropdownOpen, reportTab]);

  const filteredAggregateChildren = useMemo(() => {
    if (!tableSearch.trim()) return reportData;
    const term = tableSearch.toLowerCase();
    return reportData.filter(
      (r) =>
        r.childName.toLowerCase().includes(term) ||
        r.childCode.toLowerCase().includes(term) ||
        r.groupName.toLowerCase().includes(term)
    );
  }, [reportData, tableSearch]);

  const filteredAggregateStaff = useMemo(() => {
    if (!tableSearch.trim()) return staffReportData;
    const term = tableSearch.toLowerCase();
    return staffReportData.filter(
      (r) => r.staffName.toLowerCase().includes(term) || r.type.toLowerCase().includes(term)
    );
  }, [staffReportData, tableSearch]);

  const filteredSpecificData = useMemo(() => {
    return specificData
      .filter((r) => reportTab !== "children" || groupId === "all" || r.groupId === groupId)
      .filter((r) => {
        if (!tableSearch.trim()) return true;
        const term = tableSearch.toLowerCase();
        return (
          r.name.toLowerCase().includes(term) ||
          r.groupOrType.toLowerCase().includes(term) ||
          Boolean(r.code && r.code.toLowerCase().includes(term))
        );
      });
  }, [specificData, reportTab, groupId, tableSearch]);

  function getExportRows() {
    if (reportType === "specific" && selectedSpecificPerson) {
      return specificPersonDays.map((r) => ({
        "Nombre Completo": selectedSpecificPerson.name,
        "Código / ID": selectedSpecificPerson.code || "—",
        [reportTab === "children" ? "Grupo" : "Cargo"]: selectedSpecificPerson.groupOrRole,
        "Fecha": r.dateFormatted,
        "Día Hábil": r.dayName,
        "Estado": r.statusLabel,
      }));
    } else if (reportType === "person" && selectedPersonId) {
      return personHistory.map((r) => ({
        "Persona": selectedPersonName,
        "Fecha": r.dateFormatted,
        "Día": r.dayName,
        "Asistencia": r.statusLabel,
        "Hora de llegada": r.checkIn || "—",
      }));
    } else if (reportType === "specific") {
      const isSingleDay = specificStartDate === specificEndDate;
      if (isSingleDay) {
        return filteredSpecificData.map((r) => ({
          "Nombre Completo": r.name,
          [reportTab === "children" ? "Grupo" : "Cargo"]: r.groupOrType,
          "Fecha": r.date,
          "Asistencia": r.statusLabel,
          "Hora de llegada": r.checkIn || "—",
        }));
      }
      return filteredSpecificData.map((r) => ({
        "Código": r.code || "—",
        "Nombre Completo": r.name,
        [reportTab === "children" ? "Grupo" : "Cargo"]: r.groupOrType,
        "Desde": specificStartDate,
        "Hasta": specificEndDate,
        "Días Hábiles (L-V)": r.totalBusinessDays,
        "Días que Asistió": r.totalPresent,
        "Días que No Asistió": r.totalAbsent,
        "% Asistencia": `${r.percentage}%`,
      }));
    } else {
      if (reportTab === "children") {
        return filteredAggregateChildren.map((r) => ({
          "Código": r.childCode || "—",
          "Nombre": r.childName,
          "Grupo": r.groupName,
          "Presentes": r.totalPresent,
          "Ausentes": r.totalAbsent,
          "% Asistencia": `${r.percentage}%`,
        }));
      } else {
        return filteredAggregateStaff.map((r) => ({
          "Nombre": r.staffName,
          "Cargo": r.type,
          "Presentes": r.totalPresent,
          "Ausentes": r.totalAbsent,
          "% Asistencia": `${r.percentage}%`,
        }));
      }
    }
  }

  function getExportFilename() {
    if (reportType === "specific" && selectedSpecificPerson) {
      return `reporte_asistencia_${selectedSpecificPerson.name.replace(/\s+/g, "_")}_${specificStartDate}_a_${specificEndDate}`;
    }
    if (reportType === "person" && selectedPersonId) {
      return `reporte_asistencia_${selectedPersonName.replace(/\s+/g, "_")}_${personStartDate}_a_${personEndDate}`;
    }
    if (reportType === "specific") {
      return `reporte_asistencia_${reportTab}_${specificStartDate}_a_${specificEndDate}`;
    }
    return `reporte_asistencia_${reportTab}_${filter}`;
  }

  function handleExportExcel() {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    exportToExcel(rows, getExportFilename());
    toast.success("Reporte Excel descargado");
  }

  function handleExportCsv() {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    exportToCsv(rows, getExportFilename());
    toast.success("Reporte CSV descargado");
  }

  async function handleDownloadChildRangePDF(
    person: PersonOption,
    start: string,
    end: string,
    daysRows: PersonDayRow[],
    holidaysExcluded: number
  ) {
    if (daysRows.length === 0) {
      toast.error("No hay días hábiles (Lunes a Viernes) en el rango seleccionado");
      return;
    }
    await exportPersonAttendanceRangePDF({
      personName: person.name,
      personCode: person.code || undefined,
      groupOrRole: person.groupOrRole,
      personTypeLabel: person.type === "child" ? "Niño(a) / Estudiante" : "Personal Institucional",
      startDate: start,
      endDate: end,
      holidaysExcludedCount: holidaysExcluded,
      rows: daysRows,
      generatedByName,
      generatedByRole,
      filename: `reporte_asistencia_${person.name.replace(/\s+/g, "_")}_${start}_a_${end}`,
    });
    toast.success("Reporte PDF de asistencia descargado");
  }

  async function handleExportPDF() {
    if (reportType === "specific" && selectedSpecificPerson) {
      await handleDownloadChildRangePDF(
        selectedSpecificPerson,
        specificStartDate,
        specificEndDate,
        specificPersonDays,
        specificHolidaysCount
      );
      return;
    }

    if (reportType === "person" && selectedPersonId && selectedPersonObj) {
      if (personHistory.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }
      await handleDownloadChildRangePDF(
        selectedPersonObj,
        personStartDate,
        personEndDate,
        personHistory,
        personHolidaysCount
      );
      return;
    }

    if (reportType === "specific") {
      if (filteredSpecificData.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }
      const isSingleDay = specificStartDate === specificEndDate;
      const isStaff = reportTab === "staff";
      if (isSingleDay) {
        const headers = isStaff
          ? ["Nombre Completo", "Cargo", "Fecha", "Asistencia", "Hora", "Firma"]
          : ["Nombre Completo", "Grupo", "Fecha", "Asistencia", "Hora"];
        const rows: PDFDetailRow[] = filteredSpecificData.map((r) => ({
          name: r.name,
          groupOrType: r.groupOrType,
          date: r.date,
          status: r.statusLabel,
          checkIn: r.checkIn || "—",
          signatureDataUrl: isStaff ? r.signatureUrl : undefined,
        }));
        const title = isStaff
          ? `Reporte de Asistencia Personal - ${filteredSpecificData[0]?.date || specificStartDate}`
          : `Reporte de Asistencia Infantil - ${filteredSpecificData[0]?.date || specificStartDate}`;
        await exportToPDFDetail(title, headers, rows, getExportFilename(), isStaff);
      } else {
        await exportToPDF(
          `Reporte por Fechas (${specificStartDate} a ${specificEndDate})`,
          [
            "Código",
            "Nombre Completo",
            isStaff ? "Cargo" : "Grupo",
            "Días Hábiles",
            "Asistió",
            "No Asistió",
            "% Asistencia",
          ],
          filteredSpecificData.map((r) => [
            r.code || "—",
            r.name,
            r.groupOrType,
            String(r.totalBusinessDays),
            String(r.totalPresent),
            String(r.totalAbsent),
            `${r.percentage}%`,
          ]),
          getExportFilename()
        );
      }
      toast.success("Reporte PDF descargado");
    } else {
      if (reportTab === "children") {
        if (filteredAggregateChildren.length === 0) {
          toast.error("No hay datos para exportar");
          return;
        }
        await exportToPDF(
          "Reporte Consolidado de Asistencia Infantil",
          ["Código", "Nombre Completo", "Grupo", "Presentes", "Ausentes", "% Asistencia"],
          filteredAggregateChildren.map((r) => [
            r.childCode || "—",
            r.childName,
            r.groupName,
            String(r.totalPresent),
            String(r.totalAbsent),
            `${r.percentage}%`,
          ]),
          getExportFilename()
        );
      } else {
        if (filteredAggregateStaff.length === 0) {
          toast.error("No hay datos para exportar");
          return;
        }
        await exportToPDF(
          "Reporte Consolidado de Asistencia Personal",
          ["Nombre Completo", "Cargo", "Presentes", "Ausentes", "% Asistencia"],
          filteredAggregateStaff.map((r) => [
            r.staffName,
            r.type,
            String(r.totalPresent),
            String(r.totalAbsent),
            `${r.percentage}%`,
          ]),
          getExportFilename()
        );
      }
      toast.success("Reporte PDF descargado");
    }
  }

  function selectPerson(person: PersonOption) {
    setSelectedPersonId(person.id);
    setSelectedPersonName(person.name);
    setPersonSearch(person.name);
    setPersonDropdownOpen(false);
  }

  function selectSpecificPerson(person: PersonOption) {
    setSpecificPersonId(person.id);
    setSpecificPersonSearch(person.name);
    setSpecificPersonDropdownOpen(false);
  }

  function clearSpecificPerson() {
    setSpecificPersonId("");
    setSpecificPersonSearch("");
  }

  const totalPresent = filteredAggregateChildren.reduce((acc, r) => acc + r.totalPresent, 0);
  const totalAbsent = filteredAggregateChildren.reduce((acc, r) => acc + r.totalAbsent, 0);
  const staffTotalPresent = filteredAggregateStaff.reduce((acc, r) => acc + r.totalPresent, 0);
  const staffTotalAbsent = filteredAggregateStaff.reduce((acc, r) => acc + r.totalAbsent, 0);
  const currentPresent = reportTab === "children" ? totalPresent : staffTotalPresent;
  const currentAbsent = reportTab === "children" ? totalAbsent : staffTotalAbsent;
  const currentMonthly = reportTab === "children" ? childrenMonthlyData : staffMonthlyData;

  const specificPersonPresent = specificPersonDays.filter((r) => r.status === "present").length;
  const specificPersonAbsent = specificPersonDays.filter((r) => r.status === "absent").length;
  const specificPersonTotal = specificPersonDays.length;
  const specificPersonPct =
    specificPersonTotal > 0 ? Math.round((specificPersonPresent / specificPersonTotal) * 100) : 0;

  const specificPresent = filteredSpecificData.reduce((acc, r) => acc + r.totalPresent, 0);
  const specificAbsent = filteredSpecificData.reduce((acc, r) => acc + r.totalAbsent, 0);

  const personPresent = personHistory.filter((r) => r.status === "present").length;
  const personAbsent = personHistory.filter((r) => r.status === "absent").length;
  const personTotal = personPresent + personAbsent;
  const personPercentage = personTotal > 0 ? Math.round((personPresent / personTotal) * 100) : 0;
  const selectedPersonIsStaff = selectedPersonObj ? selectedPersonObj.type !== "child" : false;

  if (initialLoading) return <LoadingSpinner label="Cargando módulo de reportes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md">
            <ChartBarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Reportes y Estadísticas
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Análisis detallado de asistencia (Lunes a Viernes, excluyendo sábados, domingos y festivos)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 shadow-sm flex items-center gap-2 transition-all"
          >
            <DocumentArrowDownIcon className="w-4 h-4" /> Excel (.xlsx)
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2 transition-all"
          >
            <DocumentArrowDownIcon className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 shadow-sm flex items-center gap-2 transition-all"
          >
            <DocumentArrowDownIcon className="w-4 h-4" /> PDF Oficial
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setReportTab("children");
            setSelectedPersonId(null);
            setPersonSearch("");
            setPersonRawAtt([]);
            clearSpecificPerson();
            setTableSearch("");
          }}
          className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            reportTab === "children"
              ? "gradient-primary text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4" /> Niños
          </span>
        </button>
        <button
          onClick={() => {
            setReportTab("staff");
            setSelectedPersonId(null);
            setPersonSearch("");
            setPersonRawAtt([]);
            clearSpecificPerson();
            setTableSearch("");
          }}
          className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            reportTab === "staff"
              ? "gradient-primary text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <AcademicCapIcon className="w-4 h-4" /> Personal
          </span>
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button
          onClick={() => setReportType("aggregate")}
          className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            reportType === "aggregate"
              ? "gradient-success text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <TableCellsIcon className="w-4 h-4" /> Consolidado
          </span>
        </button>
        <button
          onClick={() => setReportType("specific")}
          className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            reportType === "specific"
              ? "gradient-success text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <CalendarDaysIcon className="w-4 h-4" /> Por Fecha
          </span>
        </button>
        <button
          onClick={() => setReportType("person")}
          className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            reportType === "person"
              ? "gradient-success text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" /> Por Persona
          </span>
        </button>
        {sectionLoading && (
          <span className="ml-2 inline-flex items-center gap-2 text-xs font-semibold text-primary animate-pulse">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Consultando registros...
          </span>
        )}
      </div>

      {reportType === "aggregate" && (
        <>
          <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-[#1a2438] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            {(["day", "week", "month", "year", "custom"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                  filter === f
                    ? "gradient-primary text-white shadow-md"
                    : "bg-gray-50 dark:bg-[#0c1220] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
                }`}
              >
                {f === "day" ? "Hoy" : f === "week" ? "Semana" : f === "month" ? "Mes" : f === "year" ? "Año" : "Rango personalizado"}
              </button>
            ))}
            {filter === "custom" && (
              <div className="flex flex-wrap items-center gap-2 ml-1">
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  aria-label="Fecha desde"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                />
                <span className="text-xs text-gray-400">a</span>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  max={today}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  aria-label="Fecha hasta"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
            {reportTab === "children" && (
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor="reports-group-filter" className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Grupo:
                </label>
                <select
                  id="reports-group-filter"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  aria-label="Filtrar por grupo"
                  className="px-3.5 py-2 rounded-xl text-[13px] font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                >
                  <option value="all">Todos los grupos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {reportTab === "children" ? filteredAggregateChildren.length : filteredAggregateStaff.length}
              </p>
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {reportTab === "children" ? "Niños evaluados" : "Personal evaluado"}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-500">{currentPresent}</p>
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Total asistencias</p>
            </div>
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <p className="text-3xl font-bold text-red-500">{currentAbsent}</p>
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Total ausencias</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Tendencia Mensual (Últimos 6 meses)</h3>
              <div className="h-64">
                <DynamicBarChart data={currentMonthly} />
              </div>
            </div>
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Distribución del Período</h3>
              <div className="h-64 flex items-center justify-center">
                <DynamicPieChart present={currentPresent} absent={currentAbsent} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Detalle por {reportTab === "children" ? "Estudiante" : "Miembro del Personal"}
              </h3>
              <div className="relative w-full sm:w-72">
                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filtrar en la tabla..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {reportTab === "children" && (
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Código</th>
                    )}
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Nombre</th>
                    {reportTab === "children" && (
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Grupo</th>
                    )}
                    {reportTab === "staff" && (
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Cargo</th>
                    )}
                    <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Presentes</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Ausentes</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">% Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {reportTab === "children"
                    ? filteredAggregateChildren.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
                              {r.childCode || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.childName}</td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{r.groupName}</td>
                          <td className="px-5 py-3.5 text-center font-bold text-emerald-500">{r.totalPresent}</td>
                          <td className="px-5 py-3.5 text-center font-bold text-red-500">{r.totalAbsent}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                r.percentage >= 80
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : r.percentage >= 60
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {r.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))
                    : filteredAggregateStaff.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.staffName}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                r.type === "Profesor"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                              }`}
                            >
                              {r.type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-emerald-500">{r.totalPresent}</td>
                          <td className="px-5 py-3.5 text-center font-bold text-red-500">{r.totalAbsent}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                r.percentage >= 80
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : r.percentage >= 60
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {r.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {(reportTab === "children" ? filteredAggregateChildren.length === 0 : filteredAggregateStaff.length === 0) && (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                No hay datos para mostrar en este período.
              </div>
            )}
          </div>
        </>
      )}

      {reportType === "specific" && (
        <>
          {/* Panel de filtros Por Fecha: Rango Desde - Hasta + Selección de Niño/Persona */}
          <div className="bg-white dark:bg-[#1a2438] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Rango de fechas Desde - Hasta */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="specific-start-date"
                    className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                  >
                    Fecha Desde
                  </label>
                  <input
                    id="specific-start-date"
                    type="date"
                    value={specificStartDate}
                    max={specificEndDate || today}
                    onChange={(e) => setSpecificStartDate(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label
                    htmlFor="specific-end-date"
                    className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                  >
                    Fecha Hasta
                  </label>
                  <input
                    id="specific-end-date"
                    type="date"
                    value={specificEndDate}
                    min={specificStartDate}
                    max={today}
                    onChange={(e) => setSpecificEndDate(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Filtro por grupo */}
              {reportTab === "children" && (
                <div>
                  <label
                    htmlFor="specific-group-select"
                    className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                  >
                    Grupo
                  </label>
                  <select
                    id="specific-group-select"
                    value={groupId}
                    onChange={(e) => {
                      setGroupId(e.target.value);
                      clearSpecificPerson();
                    }}
                    className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                  >
                    <option value="all">Todos los grupos</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selector buscador de Niño / Persona dentro de "Por Fecha" */}
              <div className="relative flex-1 min-w-[260px]">
                <label
                  htmlFor="specific-person-search"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                >
                  {reportTab === "children" ? "Niño(a) / Estudiante a Consultar" : "Persona a Consultar"}
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="specific-person-search"
                    type="text"
                    value={specificPersonSearch}
                    onFocus={() => setSpecificPersonDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setSpecificPersonDropdownOpen(false), 180)}
                    onChange={(e) => {
                      setSpecificPersonSearch(e.target.value);
                      setSpecificPersonDropdownOpen(true);
                      if (!e.target.value.trim()) {
                        setSpecificPersonId("");
                      }
                    }}
                    placeholder={
                      reportTab === "children"
                        ? "Buscar y seleccionar niño por nombre o código (CT001)..."
                        : "Buscar y seleccionar personal..."
                    }
                    className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {(specificPersonId || specificPersonSearch) && (
                    <button
                      type="button"
                      onClick={clearSpecificPerson}
                      title="Ver todos"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {specificPersonDropdownOpen && specificPersonResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        clearSpecificPerson();
                        setSpecificPersonDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-primary hover:bg-gray-50 dark:hover:bg-[#1e293b] border-b border-gray-100 dark:border-gray-800"
                    >
                      Ver listado general ({peopleForCurrentTab.length})
                    </button>
                    {specificPersonResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSpecificPerson(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Se evalúan exclusivamente los días de <strong>Lunes a Viernes</strong> (exceptuando sábados, domingos y festivos).
                {specificHolidaysCount > 0 && (
                  <strong className="ml-1 text-amber-600 dark:text-amber-400">
                    · {specificHolidaysCount} día(s) festivo(s) excluido(s) en este rango.
                  </strong>
                )}
              </span>
              {selectedSpecificPerson && (
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Reporte generado por: <strong>{generatedByName}</strong> ({generatedByRole})
                </span>
              )}
            </div>
          </div>

          {!hasBusinessDaysInSpecificRange ? (
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                No hay días hábiles (Lunes a Viernes sin festivos) en el rango seleccionado
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Los sábados, domingos y días festivos están excluidos del reporte.
              </p>
            </div>
          ) : selectedSpecificPerson ? (
            /* Vista detallada del Niño / Persona seleccionado en el rango Desde - Hasta */
            <>
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedSpecificPerson.name}
                    </h2>
                    {selectedSpecificPerson.code && (
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary">
                        ID: {selectedSpecificPerson.code}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {selectedSpecificPerson.groupOrRole}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Período filtrado: <strong>{specificStartDate}</strong> hasta <strong>{specificEndDate}</strong> · Solo Lunes a Viernes (sin sábados, domingos ni festivos)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadChildRangePDF(
                        selectedSpecificPerson,
                        specificStartDate,
                        specificEndDate,
                        specificPersonDays,
                        specificHolidaysCount
                      )
                    }
                    className="px-4 py-2.5 rounded-xl text-sm font-bold gradient-primary text-white shadow-md hover:opacity-95 flex items-center gap-2 transition-all"
                  >
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    Descargar PDF (Días que Asistió y No Asistió)
                  </button>
                  <button
                    type="button"
                    onClick={clearSpecificPerson}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Cambiar niño / Ver todos
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{specificPersonTotal}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Días Hábiles (Lun - Vie)
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-emerald-200/60 dark:border-emerald-800/50 shadow-sm text-center">
                  <p className="text-3xl font-bold text-emerald-500">{specificPersonPresent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Días que Asistió
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-red-200/60 dark:border-red-800/50 shadow-sm text-center">
                  <p className="text-3xl font-bold text-red-500">{specificPersonAbsent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Días que No Asistió
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p
                    className={`text-3xl font-bold ${
                      specificPersonPct >= 80
                        ? "text-emerald-500"
                        : specificPersonPct >= 60
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {specificPersonPct}%
                  </p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">% de Asistencia</p>
                </div>
              </div>

              {/* Resumen visual rápido de fechas en que Asistió vs No Asistió */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-200/70 dark:border-emerald-800/50">
                  <div className="flex items-center gap-2 mb-2.5">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                      Días que Asistió ({specificPersonPresent})
                    </h4>
                  </div>
                  {specificPersonPresent > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {specificPersonDays
                        .filter((d) => d.status === "present")
                        .map((d) => (
                          <span
                            key={d.date}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a2438] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm capitalize"
                          >
                            {d.dayName} {d.date}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                      Ninguna asistencia registrada en este rango de fechas.
                    </p>
                  )}
                </div>

                <div className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-4 border border-red-200/70 dark:border-red-800/50">
                  <div className="flex items-center gap-2 mb-2.5">
                    <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-300">
                      Días que No Asistió ({specificPersonAbsent})
                    </h4>
                  </div>
                  {specificPersonAbsent > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {specificPersonDays
                        .filter((d) => d.status === "absent")
                        .map((d) => (
                          <span
                            key={d.date}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a2438] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 shadow-sm capitalize"
                          >
                            {d.dayName} {d.date}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-red-700/70 dark:text-red-400/70">
                      Sin inasistencias en este rango de fechas. ¡Asistencia perfecta!
                    </p>
                  )}
                </div>
              </div>

              {/* Tabla detallada día por día */}
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Detalle Día por Día — {selectedSpecificPerson.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Listado completo de Lunes a Viernes (sin sábados, domingos ni festivos)
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-center px-4 py-3.5 font-semibold text-gray-500 dark:text-gray-400 w-14">N°</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Fecha</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Día Hábil</th>
                        <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specificPersonDays.map((r, i) => (
                        <tr
                          key={r.date}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors"
                        >
                          <td className="px-4 py-3.5 text-center text-xs font-semibold text-gray-400">
                            {i + 1}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.dateFormatted}</td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 capitalize">{r.dayName}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                r.status === "present"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {r.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Vista general del rango de fechas cuando aún no se ha elegido un niño específico */
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{filteredSpecificData.length}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    {reportTab === "children" ? "Niños en el listado" : "Personal en el listado"}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-emerald-500">{specificPresent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Total Días Asistidos en el Rango
                  </p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-red-500">{specificAbsent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Total Días No Asistidos en el Rango
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Resumen por {reportTab === "children" ? "Niño(a)" : "Personal"} ({specificStartDate} a {specificEndDate})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Haz clic en <strong>&quot;Ver días / PDF&quot;</strong> en cualquier fila para ver el detalle día a día y descargar su PDF individual.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Filtrar en la tabla..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        {reportTab === "children" && (
                          <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Código</th>
                        )}
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Nombre Completo</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">
                          {reportTab === "children" ? "Grupo" : "Cargo"}
                        </th>
                        <th className="text-center px-4 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Días Hábiles</th>
                        <th className="text-center px-4 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Asistió</th>
                        <th className="text-center px-4 py-3.5 font-semibold text-gray-500 dark:text-gray-400">No Asistió</th>
                        <th className="text-center px-4 py-3.5 font-semibold text-gray-500 dark:text-gray-400">%</th>
                        <th className="text-right px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSpecificData.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors"
                        >
                          {reportTab === "children" && (
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
                                {r.code || "—"}
                              </span>
                            </td>
                          )}
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.name}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                reportTab === "staff"
                                  ? r.groupOrType === "Profesor"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {r.groupOrType}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-semibold text-gray-700 dark:text-gray-300">
                            {r.totalBusinessDays}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {r.totalPresent}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-red-600 dark:text-red-400">
                            {r.totalAbsent}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                r.percentage >= 80
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : r.percentage >= 60
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {r.percentage}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const found = allPeople.find((p) => p.id === r.id);
                                if (found) {
                                  selectSpecificPerson(found);
                                } else {
                                  setSpecificPersonId(r.id);
                                  setSpecificPersonSearch(r.name);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                            >
                              Ver días / PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredSpecificData.length === 0 && (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                    No hay registros de asistencia para este filtro.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {reportType === "person" && (
        <>
          <div className="bg-white dark:bg-[#1a2438] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="relative flex-1 min-w-[260px]">
              <label
                htmlFor="person-tab-search"
                className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
              >
                {reportTab === "children" ? "Buscar Niño(a)" : "Buscar Personal"}
              </label>
              <div className="relative">
                <MagnifyingGlassIcon
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="person-tab-search"
                  type="text"
                  placeholder={
                    reportTab === "children"
                      ? "Buscar niño por nombre o ID (CT001...)..."
                      : "Buscar personal por nombre o documento..."
                  }
                  aria-label="Buscar persona"
                  value={personSearch}
                  onFocus={() => setPersonDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setPersonDropdownOpen(false), 180)}
                  onChange={(e) => {
                    setPersonSearch(e.target.value);
                    setPersonDropdownOpen(true);
                    setSelectedPersonId(null);
                    setPersonRawAtt([]);
                  }}
                  className="w-full px-4 py-2.5 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              {personResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPerson(p)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="person-start-date"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                >
                  Fecha Desde
                </label>
                <input
                  id="person-start-date"
                  type="date"
                  value={personStartDate}
                  max={personEndDate || today}
                  onChange={(e) => setPersonStartDate(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="person-end-date"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5"
                >
                  Fecha Hasta
                </label>
                <input
                  id="person-end-date"
                  type="date"
                  value={personEndDate}
                  min={personStartDate}
                  max={today}
                  onChange={(e) => setPersonEndDate(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          {selectedPersonId && selectedPersonObj ? (
            <>
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedPersonName}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Período: <strong>{personStartDate}</strong> a <strong>{personEndDate}</strong> · Solo días de Lunes a Viernes (sin sábados, domingos ni festivos)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadChildRangePDF(
                      selectedPersonObj,
                      personStartDate,
                      personEndDate,
                      personHistory,
                      personHolidaysCount
                    )
                  }
                  className="px-4 py-2.5 rounded-xl text-sm font-bold gradient-primary text-white shadow-md hover:opacity-95 flex items-center gap-2 transition-all"
                >
                  <DocumentArrowDownIcon className="w-5 h-5" />
                  Descargar PDF (Días que Asistió y No Asistió)
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{personTotal}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Días Hábiles (L-V)</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-emerald-500">{personPresent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Días que Asistió</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-red-500">{personAbsent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Días que No Asistió</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p
                    className={`text-3xl font-bold ${
                      personPercentage >= 80
                        ? "text-emerald-500"
                        : personPercentage >= 60
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {personPercentage}%
                  </p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">% Asistencia</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Historial de {selectedPersonName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Solo días laborales de Lunes a Viernes (excluyendo sábados, domingos y festivos)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Fecha</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Día</th>
                        <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Estado</th>
                        <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Hora</th>
                        {selectedPersonIsStaff && (
                          <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Firma</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {personHistory.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.dateFormatted}</td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 capitalize">{r.dayName}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                r.status === "present"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {r.statusLabel}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs text-gray-500 dark:text-gray-400">
                            {r.checkIn || "—"}
                          </td>
                          {selectedPersonIsStaff && (
                            <td className="px-5 py-3.5 text-center">
                              {r.signatureUrl && r.signatureUrl.startsWith("data:image") ? (
                                <img
                                  src={r.signatureUrl}
                                  alt="Firma"
                                  className="h-8 mx-auto rounded border border-gray-200 dark:border-gray-700 bg-white"
                                />
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {personHistory.length === 0 && (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                    No hay días hábiles en este rango para mostrar.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <UserIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">Busca una persona para ver su historial por rango de fechas</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {reportTab === "children" ? "Puedes buscar por nombre o código (CT001...)" : "Busca por nombre o documento"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
