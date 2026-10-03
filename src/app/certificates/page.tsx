"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  getInstitutionProfile,
  DEFAULT_INSTITUTION,
  generateChildAttendanceCertificate,
  generatePractitionerCertificate,
  generateTeacherLaborCertificate,
} from "@/lib/certificates";
import { getTodayDate } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";
import {
  AcademicCapIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import type { Child, Group, Teacher, Practitioner, AttendanceChild, AttendanceStaff, InstitutionProfile } from "@/types/database";

function CertificatesContent() {
  const searchParams = useSearchParams();
  const urlType = searchParams.get("type");
  const urlId = searchParams.get("id");

  const [activeCertType, setActiveCertType] = useState<"children" | "practitioners" | "teachers">(
    urlType && ["children", "practitioners", "teachers"].includes(urlType)
      ? (urlType as "children" | "practitioners" | "teachers")
      : "children"
  );
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<InstitutionProfile | null>(null);

  // Data lists
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [practitionersList, setPractitionersList] = useState<Practitioner[]>([]);

  // Selection states
  const [selectedChildId, setSelectedChildId] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedPractitionerId, setSelectedPractitionerId] = useState("");

  // Dates
  const today = getTodayDate();
  const firstDayOfMonth = `${today.slice(0, 7)}-01`;
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Custom fields
  const [purpose, setPurpose] = useState("");
  const [performanceNote, setPerformanceNote] = useState("Excelente desempeño pedagógico, puntualidad, ética y vocación formativa.");
  const [dailyHours, setDailyHours] = useState(4);
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [customContractType, setCustomContractType] = useState("Término Fijo");
  const [customSalary, setCustomSalary] = useState("");
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(true);
  const [customEndDate, setCustomEndDate] = useState("");

  // Calculation and preview state
  const [calculating, setCalculating] = useState(false);
  const [calculatedStats, setCalculatedStats] = useState<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    percentage: number;
    hours: number;
  }>({ totalDays: 0, presentDays: 0, absentDays: 0, percentage: 100, hours: 0 });

  // Modal preview
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [inst, cSnap, gSnap, tSnap, pSnap] = await Promise.all([
        getInstitutionProfile().catch(() => DEFAULT_INSTITUTION),
        getDocs(collection(getFirebaseDb(), "children")).catch(() => ({ docs: [] } as any)),
        getDocs(collection(getFirebaseDb(), "groups")).catch(() => ({ docs: [] } as any)),
        getDocs(collection(getFirebaseDb(), "teachers")).catch(() => ({ docs: [] } as any)),
        getDocs(collection(getFirebaseDb(), "practitioners")).catch(() => ({ docs: [] } as any)),
      ]);

      setInstitution(inst || DEFAULT_INSTITUTION);

      // Children list: active and sorted in JS
      const kids = (cSnap.docs || [])
        .map((d: any) => ({ id: d.id, ...d.data() } as Child))
        .filter((c: Child) => c.status !== "inactive")
        .sort((a: Child, b: Child) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setChildrenList(kids);

      if (urlType === "children" && urlId && kids.some((k: Child) => k.id === urlId)) {
        setSelectedChildId(urlId);
      } else if (kids.length > 0) {
        setSelectedChildId(kids[0].id);
      }

      // Groups
      const groupList = (gSnap.docs || [])
        .map((d: any) => ({ id: d.id, ...d.data() } as Group))
        .sort((a: Group, b: Group) => (a.name || "").localeCompare(b.name || ""));
      setGroups(groupList);

      // Teachers
      const tList = (tSnap.docs || [])
        .map((d: any) => ({ id: d.id, ...d.data() } as Teacher))
        .sort((a: Teacher, b: Teacher) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setTeachersList(tList);

      if (urlType === "teachers" && urlId && tList.some((t: Teacher) => t.id === urlId)) {
        setSelectedTeacherId(urlId);
        const matched = tList.find((t: Teacher) => t.id === urlId)!;
        setCustomJobTitle(matched.job_title || matched.role || "Docente Titular");
        setCustomContractType(matched.contract_type || "Término Fijo");
        if (matched.salary) setCustomSalary(matched.salary);
      } else if (tList.length > 0) {
        setSelectedTeacherId(tList[0].id);
        setCustomJobTitle(tList[0].job_title || tList[0].role || "Docente Titular");
        setCustomContractType(tList[0].contract_type || "Término Fijo");
        if (tList[0].salary) setCustomSalary(tList[0].salary);
      }

      // Practitioners
      const pList = (pSnap.docs || [])
        .map((d: any) => ({ id: d.id, ...d.data() } as Practitioner))
        .sort((a: Practitioner, b: Practitioner) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setPractitionersList(pList);

      if (urlType === "practitioners" && urlId && pList.some((p: Practitioner) => p.id === urlId)) {
        setSelectedPractitionerId(urlId);
        const matched = pList.find((p: Practitioner) => p.id === urlId)!;
        setDailyHours(matched.daily_hours || 4);
      } else if (pList.length > 0) {
        setSelectedPractitionerId(pList[0].id);
        setDailyHours(pList[0].daily_hours || 4);
      }
    } catch (err) {
      console.error("Error loading certificates data:", err);
      setInstitution(DEFAULT_INSTITUTION);
    } finally {
      setLoading(false);
    }
  }

  // Recalculate stats when selection or dates change
  useEffect(() => {
    if (activeCertType === "children" && selectedChildId) {
      computeChildStats();
    } else if (activeCertType === "practitioners" && selectedPractitionerId) {
      computePractitionerStats();
    }
  }, [activeCertType, selectedChildId, selectedPractitionerId, startDate, endDate, dailyHours]);

  async function computeChildStats() {
    setCalculating(true);
    try {
      const q = query(
        collection(getFirebaseDb(), "attendance_children"),
        where("child_id", "==", selectedChildId)
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map((d) => d.data() as AttendanceChild);
      const records = allRecords.filter((r) => {
        if (!r.attendance_date) return false;
        return r.attendance_date >= startDate && r.attendance_date <= endDate;
      });

      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const total = present + absent;
      const pct = total > 0 ? Math.round((present / total) * 100) : 100;

      setCalculatedStats({
        totalDays: total || 1,
        presentDays: present,
        absentDays: absent,
        percentage: pct,
        hours: present * 4,
      });
    } catch (err) {
      console.error("Error computing child stats:", err);
    } finally {
      setCalculating(false);
    }
  }

  async function computePractitionerStats() {
    setCalculating(true);
    try {
      const q = query(
        collection(getFirebaseDb(), "attendance_staff"),
        where("staff_id", "==", selectedPractitionerId)
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map((d) => d.data() as AttendanceStaff);
      const records = allRecords.filter((r) => {
        if (!r.attendance_date) return false;
        return r.attendance_date >= startDate && r.attendance_date <= endDate;
      });

      const present = records.filter((r) => r.check_in != null && r.status !== "absent").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const total = present + absent;
      const totalHours = present * dailyHours;

      setCalculatedStats({
        totalDays: total || present,
        presentDays: present,
        absentDays: absent,
        percentage: total > 0 ? Math.round((present / total) * 100) : 100,
        hours: totalHours,
      });
    } catch (err) {
      console.error("Error computing practitioner stats:", err);
    } finally {
      setCalculating(false);
    }
  }

  // Filtered children search
  const filteredChildren = useMemo(() => {
    if (!childSearch.trim()) return childrenList;
    const term = childSearch.toLowerCase();
    return childrenList.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
      (c.child_id_code && c.child_id_code.toLowerCase().includes(term))
    );
  }, [childrenList, childSearch]);

  const selectedChild = childrenList.find((c) => c.id === selectedChildId);
  const selectedTeacher = teachersList.find((t) => t.id === selectedTeacherId);
  const selectedPractitioner = practitionersList.find((p) => p.id === selectedPractitionerId);

  // Generate / Download Handler
  async function handleGenerate(action: "save" | "blob" = "save") {
    const inst = institution || DEFAULT_INSTITUTION;
    setGenerating(true);

    try {
      if (activeCertType === "children") {
        if (!selectedChild) {
          toast.error("Selecciona un niño");
          return;
        }
        const groupName = groups.find((g) => g.id === selectedChild.group_id)?.name || "Sin Grupo";
        const result = await generateChildAttendanceCertificate(
          {
            child: selectedChild,
            groupName,
            startDate,
            endDate,
            totalScheduledDays: calculatedStats.totalDays,
            totalPresentDays: calculatedStats.presentDays,
            totalAbsentDays: calculatedStats.absentDays,
            purpose,
            institution: inst,
          },
          action
        );

        if (action === "blob" && typeof result === "string") {
          setPreviewBlobUrl(result);
        } else {
          toast.success("Constancia de asistencia descargada con éxito");
        }
      } else if (activeCertType === "practitioners") {
        if (!selectedPractitioner) {
          toast.error("Selecciona un practicante");
          return;
        }
        const result = await generatePractitionerCertificate(
          {
            practitioner: selectedPractitioner,
            university: selectedPractitioner.university || selectedPractitioner.study || "Universidad de Convenio",
            career: selectedPractitioner.career || selectedPractitioner.role || "Licenciatura en Educación",
            startDate,
            endDate,
            totalDays: calculatedStats.presentDays,
            totalHours: calculatedStats.hours,
            dailyHours,
            performanceNote,
            institution: inst,
          },
          action
        );

        if (action === "blob" && typeof result === "string") {
          setPreviewBlobUrl(result);
        } else {
          toast.success("Certificado de prácticas descargado con éxito");
        }
      } else if (activeCertType === "teachers") {
        if (!selectedTeacher) {
          toast.error("Selecciona un docente");
          return;
        }
        const result = await generateTeacherLaborCertificate(
          {
            teacher: selectedTeacher,
            jobTitle: customJobTitle || selectedTeacher.job_title || selectedTeacher.role || "Docente Titular",
            contractType: customContractType,
            startDate: selectedTeacher.hire_date || startDate,
            endDate: isCurrentlyWorking ? null : customEndDate || endDate,
            salary: customSalary,
            purpose,
            institution: inst,
          },
          action
        );

        if (action === "blob" && typeof result === "string") {
          setPreviewBlobUrl(result);
        } else {
          toast.success("Certificado laboral descargado con éxito");
        }
      }
    } catch (err) {
      console.error("Error generating certificate:", err);
      toast.error("Error al generar el certificado en PDF");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingSpinner label="Cargando centro de certificados oficiales..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <DocumentTextIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Centro de Certificados y Constancias
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generación de documentos oficiales con membrete formal de Casita de Tareas, NIT y firma autorizada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerate("blob")}
            disabled={generating}
            className="px-4 py-2.5 bg-white dark:bg-[#1a2438] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm flex items-center gap-2"
          >
            <EyeIcon className="w-4 h-4 text-primary" />
            Vista Previa
          </button>

          <button
            onClick={() => handleGenerate("save")}
            disabled={generating}
            className="px-5 py-2.5 gradient-primary text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {generating ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* Tipo de Documento: 3 Cards Elegantes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Niños */}
        <button
          onClick={() => setActiveCertType("children")}
          className={`p-5 rounded-2xl text-left border transition-all relative overflow-hidden ${
            activeCertType === "children"
              ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2438] hover:border-gray-300 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2.5 rounded-xl ${activeCertType === "children" ? "gradient-primary text-white" : "bg-primary/10 text-primary"}`}>
              <UserGroupIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Estudiantes (Niños)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Constancia de Asistencia y Matrícula</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
            Para padres de familia, trámites escolares, subsidios o constancias de permanencia.
          </p>
        </button>

        {/* Practicantes */}
        <button
          onClick={() => setActiveCertType("practitioners")}
          className={`p-5 rounded-2xl text-left border transition-all relative overflow-hidden ${
            activeCertType === "practitioners"
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2438] hover:border-gray-300 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2.5 rounded-xl ${activeCertType === "practitioners" ? "gradient-success text-white" : "bg-emerald-500/10 text-emerald-600"}`}>
              <AcademicCapIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Practicantes</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Certificado de Horas y Convenios</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
            Acredita cumplimiento de prácticas formativas y cálculo automático de horas asistidas.
          </p>
        </button>

        {/* Profesores */}
        <button
          onClick={() => setActiveCertType("teachers")}
          className={`p-5 rounded-2xl text-left border transition-all relative overflow-hidden ${
            activeCertType === "teachers"
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2438] hover:border-gray-300 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2.5 rounded-xl ${activeCertType === "teachers" ? "gradient-primary text-white" : "bg-indigo-500/10 text-indigo-600"}`}>
              <BriefcaseIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Profesores y Docentes</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Certificación Laboral Oficial</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
            Carta laboral formal con cargo, tipo de contrato, tiempo de servicio y estado.
          </p>
        </button>
      </div>

      {/* Main Grid: Formulario de Configuración + Tarjeta de Resumen en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario (Col 1 & 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-primary" />
              Parámetros del Documento
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {activeCertType === "children" && "Constancia Escolar"}
              {activeCertType === "practitioners" && "Certificado de Prácticas"}
              {activeCertType === "teachers" && "Certificado Laboral"}
            </span>
          </div>

          {/* Selección de Persona */}
          {activeCertType === "children" && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                Seleccionar Niño / Estudiante:
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nombre o código (CT001...)..."
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm"
                />
              </div>

              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-primary/20"
              >
                {filteredChildren.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.child_id_code ? `(${c.child_id_code})` : ""} - {c.shift}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeCertType === "practitioners" && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                Seleccionar Practicante:
              </label>
              <select
                value={selectedPractitionerId}
                onChange={(e) => {
                  setSelectedPractitionerId(e.target.value);
                  const p = practitionersList.find((x) => x.id === e.target.value);
                  if (p?.daily_hours) setDailyHours(p.daily_hours);
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-primary/20"
              >
                {practitionersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} - {p.study || p.university || "Practicante"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeCertType === "teachers" && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                Seleccionar Docente / Profesor:
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => {
                  setSelectedTeacherId(e.target.value);
                  const t = teachersList.find((x) => x.id === e.target.value);
                  if (t) setCustomJobTitle(t.job_title || t.role || "Docente Titular");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-primary/20"
              >
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} - {t.job_title || t.role || "Docente"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rango de Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {activeCertType === "teachers" ? "Fecha de Inicio de Labores" : "Fecha Inicio de Período Evaluado"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {activeCertType === "teachers" ? "Fecha Fin (si aplica)" : "Fecha Fin de Período Evaluado"}
              </label>
              <input
                type="date"
                value={endDate}
                disabled={activeCertType === "teachers" && isCurrentlyWorking}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm disabled:opacity-40"
              />
            </div>
          </div>

          {/* Campos específicos por rol */}
          {activeCertType === "practitioners" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Intensidad Horaria Diaria de Práctica
                </label>
                <select
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold"
                >
                  <option value={4}>4 horas al día (Media Jornada)</option>
                  <option value={5}>5 horas al día</option>
                  <option value={6}>6 horas al día</option>
                  <option value={8}>8 horas al día (Jornada Completa)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Concepto Evaluativo / Desempeño
                </label>
                <input
                  type="text"
                  value={performanceNote}
                  onChange={(e) => setPerformanceNote(e.target.value)}
                  placeholder="Ej: Excelente compromiso y vocación..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}

          {activeCertType === "teachers" && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Cargo a Certificar
                  </label>
                  <input
                    type="text"
                    value={customJobTitle}
                    onChange={(e) => setCustomJobTitle(e.target.value)}
                    placeholder="Ej: Docente de Apoyo Escolar"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Contrato
                  </label>
                  <select
                    value={customContractType}
                    onChange={(e) => setCustomContractType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm font-semibold"
                  >
                    <option value="Término Fijo">Término Fijo</option>
                    <option value="Término Indefinido">Término Indefinido</option>
                    <option value="Prestación de Servicios">Prestación de Servicios</option>
                    <option value="Obra o Labor">Obra o Labor</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="currentlyWorking"
                  checked={isCurrentlyWorking}
                  onChange={(e) => setIsCurrentlyWorking(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="currentlyWorking" className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                  El docente labora actualmente en la institución (vinculación activa)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Asignación Salarial Mensual (Opcional)
                </label>
                <input
                  type="text"
                  value={customSalary}
                  onChange={(e) => setCustomSalary(e.target.value)}
                  placeholder="Ej: $ 2.100.000 COP (Dejar vacío si no se desea incluir)"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}

          {/* Destino / Propósito */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Finalidad / Destino de la Constancia (Opcional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ej: Para ser presentada ante el Colegio Mayor, o trámite de subsidio familiar..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>

        {/* Col 3: Resumen Ejecutivo en Vivo */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
              Resumen en Tiempo Real
            </h3>

            {/* Institution Badge */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                <BuildingOffice2Icon className="w-4 h-4" />
                {institution?.institution_name || "Casita de Tareas"}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">NIT: {institution?.nit}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{institution?.city}</p>
            </div>

            {/* Metrics */}
            {activeCertType === "children" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Estudiante:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : "Ninguno"}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Días Asistidos:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {calculating ? "..." : `${calculatedStats.presentDays} días`}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Inasistencias:</span>
                  <span className="font-bold text-red-500">
                    {calculating ? "..." : `${calculatedStats.absentDays} días`}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Cumplimiento:</span>
                  <span className="font-bold text-primary">
                    {calculating ? "..." : `${calculatedStats.percentage}%`}
                  </span>
                </div>
              </div>
            )}

            {activeCertType === "practitioners" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Practicante:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedPractitioner ? `${selectedPractitioner.first_name} ${selectedPractitioner.last_name}` : "Ninguno"}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Jornadas Asistidas:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {calculating ? "..." : `${calculatedStats.presentDays} días`}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Horas Certificadas:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {calculating ? "..." : `${calculatedStats.hours} HORAS`}
                  </span>
                </div>
              </div>
            )}

            {activeCertType === "teachers" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Docente:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedTeacher ? `${selectedTeacher.first_name} ${selectedTeacher.last_name}` : "Ninguno"}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Cargo:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{customJobTitle}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Tipo de Contrato:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{customContractType}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                  <span className={`font-bold ${isCurrentlyWorking ? "text-emerald-600" : "text-gray-600"}`}>
                    {isCurrentlyWorking ? "Vinculación Activa" : "Finalizado"}
                  </span>
                </div>
              </div>
            )}

            {/* Signature check */}
            <div className="pt-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Firmado por: </span>
              <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                {institution?.legal_representative}
              </p>
              <p className="text-[11px] text-gray-400">{institution?.representative_role}</p>
            </div>

            <button
              onClick={() => handleGenerate("save")}
              disabled={generating}
              className="w-full py-3 px-4 gradient-primary text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Descargar Certificado Oficial (.pdf)
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Vista Previa */}
      <Modal open={!!previewBlobUrl} onClose={() => setPreviewBlobUrl(null)} title="Vista Previa de Documento Oficial" size="xl">
        {previewBlobUrl && (
          <div className="space-y-4">
            <div className="w-full h-[70vh] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100">
              <iframe src={previewBlobUrl} className="w-full h-full" title="Vista previa del certificado" />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPreviewBlobUrl(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                Cerrar
              </button>
              <button
                onClick={() => handleGenerate("save")}
                className="px-5 py-2 gradient-primary text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Descargar Archivo PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Cargando generador de certificados..." />}>
      <CertificatesContent />
    </Suspense>
  );
}

