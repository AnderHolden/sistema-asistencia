"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { exportToExcel } from "@/lib/export";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import {
  Cog6ToothIcon,
  BuildingOffice2Icon,
  ClockIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  PencilIcon,
  EnvelopeIcon,
  BellIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { Child, Group, Teacher, Practitioner } from "@/types/database";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"company" | "rules" | "holidays" | "notifications" | "downloads" | "backup">("company");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({
    institution_name: "Casita de Tareas",
    institution_nit: "900.584.219-4",
    institution_slogan: "La Alegría del Conocimiento, Enseñando con Amor",
    institution_address: "Calle Principal # 12 - 34, Barrio Centro",
    institution_city: "Bogotá D.C., Colombia",
    institution_phone: "(+57) 310 854 9210",
    institution_email: "direccion@casitadetareas.com",
    legal_representative: "Julia Patricia González Tovar",
    representative_id: "52.345.678",
    representative_role: "Directora General y Representante Legal",
    auto_mark_children: "17:50",
    auto_mark_staff: "16:30",
    work_days: "1,2,3,4,5",
  });
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [downloadGroup, setDownloadGroup] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Digital Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // Audit export
  const [auditExportLoading, setAuditExportLoading] = useState(false);
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  // Email & Notifications Status & Test
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; provider: "resend" | "smtp" | "none"; from: string } | null>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadHolidays();
    checkEmailStatus();
  }, []);

  async function checkEmailStatus() {
    setLoadingEmailStatus(true);
    try {
      const res = await fetch("/api/email/test");
      if (res.ok) {
        const data = await res.json();
        setEmailStatus(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingEmailStatus(false);
    }
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Por favor ingrese un correo electrónico válido");
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: testEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("¡Correo de prueba enviado con éxito!");
        setTestEmailResult({
          success: true,
          message: `Mensaje entregado vía ${data.provider.toUpperCase()} a ${data.sentTo}. Revisa tu bandeja de entrada o spam.`,
        });
      } else {
        toast.error(data.error || "Fallo al enviar correo");
        setTestEmailResult({
          success: false,
          error: data.error || "No se pudo entregar el correo",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      toast.error(msg);
      setTestEmailResult({ success: false, error: msg });
    } finally {
      setSendingTestEmail(false);
    }
  }

  // Manual Cron Trigger State & Handler
  const [triggeringCron, setTriggeringCron] = useState<"staff" | "children" | "report" | null>(null);

  async function handleTriggerCron(type: "staff" | "children" | "report") {
    setTriggeringCron(type);
    try {
      const endpoint =
        type === "staff"
          ? "/api/cron/auto-mark-staff?force=true"
          : type === "children"
          ? "/api/cron/auto-mark-children?force=true"
          : "/api/cron/daily-absence-report?force=true";

      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();

      if (res.ok && (data.success || data.skipped)) {
        if (data.skipped) {
          toast(data.reason || "Tarea omitida según calendario", { icon: "ℹ️" });
        } else {
          toast.success(data.message || "Tarea ejecutada correctamente");
        }
      } else {
        toast.error(data.error || "Error al ejecutar tarea programada");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setTriggeringCron(null);
    }
  }

  async function loadSettings() {
    try {
      const [settingsSnap, groupsSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "system_settings"), orderBy("setting_key"))),
        getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name"))),
      ]);
      const data = settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Setting));
      setSettings(data);
      setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));

      const formMap: Record<string, string> = { ...form };
      data.forEach((s) => {
        if (s.setting_value) {
          formMap[s.setting_key] = s.setting_value;
        }
      });
      setForm(formMap);
      if (formMap.signature_url) {
        setHasSignature(true);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = settings.find((s) => s.setting_key === key);
        if (existing) {
          await updateDoc(doc(getFirebaseDb(), "system_settings", existing.id), { setting_value: value });
        } else {
          await addDoc(collection(getFirebaseDb(), "system_settings"), { setting_key: key, setting_value: value });
        }
      }
      await logAction("update", "system_settings", null, { updated_keys: Object.keys(form) });
      toast.success("Configuración institucional guardada exitosamente");
      loadSettings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  }

  // Signature Canvas Helpers
  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDraw() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setForm((prev) => ({ ...prev, signature_url: "" }));
    setHasSignature(false);
  }

  function saveSignatureFromCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setForm((prev) => ({ ...prev, signature_url: dataUrl }));
    setHasSignature(true);
    toast.success("Firma capturada. Recuerda hacer clic en 'Guardar Cambios'.");
  }

  // Holidays
  async function loadHolidays() {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "holidays"), orderBy("date")));
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Holiday)));
    } catch {
      /* ignore */
    }
  }

  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Fecha y nombre del festivo son obligatorios");
      return;
    }
    try {
      await addDoc(collection(getFirebaseDb(), "holidays"), {
        date: newHolidayDate,
        name: newHolidayName.trim(),
        description: "",
        created_at: new Date().toISOString(),
      });
      toast.success("Día festivo registrado");
      setNewHolidayDate("");
      setNewHolidayName("");
      loadHolidays();
    } catch {
      toast.error("Error al registrar festivo");
    }
  }

  async function deleteHoliday(id: string) {
    if (!confirm("¿Deseas eliminar este día festivo?")) return;
    try {
      await deleteDoc(doc(getFirebaseDb(), "holidays", id));
      toast.success("Festivo eliminado");
      loadHolidays();
    } catch {
      toast.error("Error al eliminar festivo");
    }
  }

  // Excel Downloads
  async function handleDownloadChildren() {
    setDownloading(true);
    try {
      const q = downloadGroup === "all"
        ? query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))
        : query(collection(getFirebaseDb(), "children"), where("status", "==", "active"), where("group_id", "==", downloadGroup));
      const snap = await getDocs(q);
      const children = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));

      if (children.length === 0) {
        toast.error("No hay niños registrados en el grupo seleccionado");
        setDownloading(false);
        return;
      }

      const groupName = downloadGroup === "all" ? "Todos" : groups.find((g) => g.id === downloadGroup)?.name || "Sin grupo";

      exportToExcel(
        children.map((c) => ({
          "Código": c.child_id_code || "",
          "Nombre Completo": `${c.first_name} ${c.last_name}`,
          "Documento": c.document || "",
          "Edad": c.age || "",
          "Jornada": c.shift || "",
          "Grupo": groups.find((g) => g.id === c.group_id)?.name || "Sin grupo",
        })),
        `Listado_Estudiantes_${groupName.replace(/\s+/g, "_")}`
      );
      toast.success(`Listado de ${children.length} niños descargado exitosamente`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar listado");
    }
    setDownloading(false);
  }

  async function handleDownloadStaff(type: "teachers" | "practitioners" | "all") {
    setDownloading(true);
    try {
      const [tSnap, pSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "teachers"))),
        getDocs(query(collection(getFirebaseDb(), "practitioners"))),
      ]);
      const teachers = tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
      const practitioners = pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));

      if (type === "teachers") {
        exportToExcel(
          teachers.map((t) => ({
            "Nombre Completo": `${t.first_name} ${t.last_name}`,
            "Documento": t.document || "",
            "Cargo": t.job_title || t.role || "Docente",
            "Tipo Contrato": t.contract_type || "Término Fijo",
            "Teléfono": t.phone || "",
            "Email": t.email || "",
            "Fecha Vinculación": t.hire_date || "",
            "Estado": t.status === "active" ? "Activo" : "Inactivo",
          })),
          "Listado_Docentes_Casita_de_Tareas"
        );
        toast.success(`Listado de ${teachers.length} docentes descargado`);
      } else if (type === "practitioners") {
        exportToExcel(
          practitioners.map((p) => ({
            "Nombre Completo": `${p.first_name} ${p.last_name}`,
            "Documento": p.document || "",
            "Universidad / Convenio": p.university || p.study || "",
            "Carrera / Programa": p.career || p.role || "",
            "Intensidad Diaria": p.daily_hours ? `${p.daily_hours} horas` : "4 horas",
            "Teléfono": p.phone || "",
            "Email": p.email || "",
            "Fecha Inicio": p.start_date || p.hire_date || "",
            "Estado": p.status === "active" ? "Activo" : "Inactivo",
          })),
          "Listado_Practicantes_Casita_de_Tareas"
        );
        toast.success(`Listado de ${practitioners.length} practicantes descargado`);
      }
    } catch {
      toast.error("Error al generar listado");
    }
    setDownloading(false);
  }

  // Backup
  async function handleBackup() {
    setBackupLoading(true);
    try {
      const collections = [
        "children", "groups", "teachers", "practitioners",
        "attendance_children", "attendance_staff", "system_settings",
        "correction_requests", "correction_requests_children", "holidays"
      ];
      const backup: Record<string, unknown> = { version: "2.0", timestamp: new Date().toISOString() };
      for (const col of collections) {
        const snap = await getDocs(collection(getFirebaseDb(), col));
        backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_casita_tareas_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast.success("Copia de seguridad completa descargada exitosamente");
    } catch (err) {
      toast.error("Error al generar copia de seguridad");
    }
    setBackupLoading(false);
  }

  if (loading) return <LoadingSpinner label="Cargando configuración institucional..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <BuildingOffice2Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Gestión Institucional y Configuración
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Parámetros de Casita de Tareas, membretes, reglas de asistencia y control general
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 gradient-primary text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Guardar Cambios
            </>
          )}
        </button>
      </div>

      {/* Tabs Bar estilo Siigo / ERP */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "company"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <BuildingOffice2Icon className="w-4 h-4" />
          Perfil de la Institución
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "rules"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          Horarios y Reglas
        </button>

        <button
          onClick={() => setActiveTab("holidays")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "holidays"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          Calendario Festivos ({holidays.length})
        </button>

        <button
          onClick={() => {
            setActiveTab("notifications");
            checkEmailStatus();
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "notifications"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <EnvelopeIcon className="w-4 h-4" />
          Notificaciones y Correo
        </button>

        <button
          onClick={() => setActiveTab("downloads")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "downloads"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Listados Excel
        </button>

        <button
          onClick={() => setActiveTab("backup")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === "backup"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 hover:bg-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
          }`}
        >
          <ShieldCheckIcon className="w-4 h-4" />
          Copias de Seguridad
        </button>
      </div>

      {/* TAB 1: PERFIL DE LA INSTITUCIÓN */}
      {activeTab === "company" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Datos Corporativos de la Empresa</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Esta información aparece automáticamente en el encabezado y pie de página de todas las constancias y certificados generados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Razón Social / Nombre Comercial *"
                value={form.institution_name || ""}
                onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
                placeholder="Ej: Casita de Tareas"
              />

              <Input
                label="NIT / RUT *"
                value={form.institution_nit || ""}
                onChange={(e) => setForm({ ...form, institution_nit: e.target.value })}
                placeholder="Ej: 900.584.219-4"
              />

              <div className="md:col-span-2">
                <Input
                  label="Lema Institucional / Slogan"
                  value={form.institution_slogan || ""}
                  onChange={(e) => setForm({ ...form, institution_slogan: e.target.value })}
                  placeholder="Ej: Acompañamiento Pedagógico, Refuerzo Escolar y Formación Integral"
                />
              </div>

              <Input
                label="Ciudad y País *"
                value={form.institution_city || ""}
                onChange={(e) => setForm({ ...form, institution_city: e.target.value })}
                placeholder="Ej: Bogotá D.C., Colombia"
              />

              <Input
                label="Dirección Física *"
                value={form.institution_address || ""}
                onChange={(e) => setForm({ ...form, institution_address: e.target.value })}
                placeholder="Ej: Calle Principal #12-34"
              />

              <Input
                label="Teléfonos de Contacto *"
                value={form.institution_phone || ""}
                onChange={(e) => setForm({ ...form, institution_phone: e.target.value })}
                placeholder="Ej: (+57) 310 854 9210"
              />

              <Input
                label="Correo Electrónico Institucional *"
                value={form.institution_email || ""}
                onChange={(e) => setForm({ ...form, institution_email: e.target.value })}
                placeholder="Ej: direccion@casitadetareas.com"
              />
            </div>
          </div>

          {/* Representación Legal y Firma */}
          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Representante Legal y Firma Oficial</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                La persona autorizada que firma los certificados de asistencia, constancias de prácticas y cartas laborales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Nombre del Representante Legal *"
                value={form.legal_representative || ""}
                onChange={(e) => setForm({ ...form, legal_representative: e.target.value })}
                placeholder="Ej: Julia Patricia González Tovar"
              />

              <Input
                label="Documento de Identidad (C.C.) *"
                value={form.representative_id || ""}
                onChange={(e) => setForm({ ...form, representative_id: e.target.value })}
                placeholder="Ej: 52.345.678"
              />

              <Input
                label="Cargo Oficial *"
                value={form.representative_role || ""}
                onChange={(e) => setForm({ ...form, representative_role: e.target.value })}
                placeholder="Ej: Directora General / Representante Legal"
              />
            </div>

            {/* Canvas para Firma Digital Oficial */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Firma Digital para Certificados Oficiales
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Firma en el recuadro con el mouse o con tu dedo si estás en celular/tablet. Se estampará automáticamente en los PDFs generados.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-80 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0c1220] overflow-hidden relative shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={128}
                    className="w-full h-full cursor-crosshair touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-gray-400">
                      Trazar firma aquí
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={saveSignatureFromCanvas}
                    className="px-4 py-2 rounded-xl text-xs font-bold gradient-primary text-white shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    Aplicar Firma
                  </button>

                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors block"
                  >
                    Limpiar Recuadro
                  </button>

                  {form.signature_url && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircleIcon className="w-4 h-4" /> Firma cargada y activa
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HORARIOS Y REGLAS */}
      {activeTab === "rules" && (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Horarios de Asistencia y Auto-Cierre</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Establece las horas en que el sistema cierra automáticamente la jornada marcando ausencias para quienes no registraron ingreso.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Hora de Auto-Cierre Niños (HH:MM)"
              type="time"
              value={form.auto_mark_children || "17:50"}
              onChange={(e) => setForm({ ...form, auto_mark_children: e.target.value })}
            />

            <Input
              label="Hora de Auto-Cierre Personal Docente (HH:MM)"
              type="time"
              value={form.auto_mark_staff || "16:30"}
              onChange={(e) => setForm({ ...form, auto_mark_staff: e.target.value })}
            />

            <div className="sm:col-span-2">
              <Input
                label="Días Laborables de Atención (1=Lunes .. 7=Domingo)"
                value={form.work_days || "1,2,3,4,5"}
                onChange={(e) => setForm({ ...form, work_days: e.target.value })}
                placeholder="Ej: 1,2,3,4,5 (Lunes a Viernes)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Los días no laborables bloquean la pantalla de marcaje para evitar registros accidentales en fines de semana.
              </p>
            </div>
          </div>

          {/* Cron Jobs Vercel Integration Box */}
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl gradient-primary text-white flex items-center justify-center font-bold">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Tareas Programadas en Servidor (Cron Jobs Vercel)
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ejecución automática sin necesidad de mantener el navegador abierto
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                Vercel Crons
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">Personal / Docentes</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    16:30 COT
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  Marca ausencias a profesores y practicantes que no registraron check-in.
                </p>
                <button
                  type="button"
                  onClick={() => handleTriggerCron("staff")}
                  disabled={triggeringCron !== null}
                  className="w-full mt-2 py-2 px-3 rounded-lg gradient-primary text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {triggeringCron === "staff" ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    "Ejecutar Auto-Cierre Ahora"
                  )}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">Estudiantes / Niños</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    17:50 COT
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  Marca inasistencias a los niños de ambas jornadas que no asistieron.
                </p>
                <button
                  type="button"
                  onClick={() => handleTriggerCron("children")}
                  disabled={triggeringCron !== null}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {triggeringCron === "children" ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    "Ejecutar Auto-Cierre Ahora"
                  )}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">Reporte Consolidado</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    18:00 COT
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  Genera y envía el reporte diario consolidado por correo a los administradores.
                </p>
                <button
                  type="button"
                  onClick={() => handleTriggerCron("report")}
                  disabled={triggeringCron !== null}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {triggeringCron === "report" ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generando...
                    </>
                  ) : (
                    "Enviar Reporte Diario Ahora"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALENDARIO DE FESTIVOS */}
      {activeTab === "holidays" && (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Días Festivos y No Laborales</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              En las fechas registradas como festivos, el sistema no computa ausencias ni exige registro de asistencia.
            </p>
          </div>

          {/* Form to add holiday */}
          <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
            <div className="w-full sm:w-48">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fecha Festivo</label>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Motivo / Celebración</label>
              <input
                type="text"
                placeholder="Ej: Día de la Independencia, Semana Institucional..."
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={addHoliday}
              className="px-4 py-2.5 gradient-primary text-white font-bold text-sm rounded-xl shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <PlusIcon className="w-4 h-4" /> Agregar
            </button>
          </div>

          {/* List of holidays */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {holidays.map((h) => (
              <div key={h.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white mr-2">{h.date}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{h.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteHoliday(h.id)}
                  aria-label="Eliminar festivo"
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            {holidays.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-400">No hay festivos programados actualmente.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB: NOTIFICACIONES Y CORREO */}
      {activeTab === "notifications" && (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <EnvelopeIcon className="w-5 h-5 text-primary" />
                Sistema Automatizado de Notificaciones y Correo
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitorea el estado de entrega de alertas, resoluciones de corrección y reportes de inasistencia.
              </p>
            </div>

            <button
              onClick={checkEmailStatus}
              disabled={loadingEmailStatus}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              {loadingEmailStatus ? "Comprobando..." : "Actualizar Diagnóstico"}
            </button>
          </div>

          {/* Live Service Status Card */}
          <div
            className={`p-5 rounded-2xl border ${
              emailStatus?.configured
                ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200"
                : "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${
                    emailStatus?.configured ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                >
                  {emailStatus?.configured ? (
                    <CheckCircleIcon className="w-6 h-6" />
                  ) : (
                    <ExclamationTriangleIcon className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-base">
                    {emailStatus?.configured
                      ? "Servicio de Notificaciones Operativo y Conectado"
                      : "Servicio de Notificaciones Pendiente de Configuración"}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {emailStatus?.configured
                      ? `Proveedor activo: ${emailStatus.provider === "resend" ? "Resend API (Cloud Native)" : "Servidor SMTP / Nodemailer"} · Remitente: ${emailStatus.from || "Por defecto"}`
                      : "Para que el sistema envíe correos automáticos en Vercel, agrega las variables de entorno de SMTP o Resend en tu panel de Vercel."}
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 ${
                  emailStatus?.configured
                    ? "bg-emerald-200/60 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200"
                    : "bg-amber-200/60 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200"
                }`}
              >
                {emailStatus?.configured ? "En Línea" : "Inactivo"}
              </span>
            </div>
          </div>

          {/* Test Email Tool */}
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 space-y-4">
            <div className="flex items-center gap-2">
              <PaperAirplaneIcon className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Prueba en Vivo de Entrega de Correo
              </h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Envía un correo de comprobación para verificar que el proveedor (Resend o SMTP) entrega satisfactoriamente en tu bandeja de entrada.
            </p>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Ingresa tu correo institucional o personal (ej: admin@correo.com)..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={sendingTestEmail}
                className="px-6 py-2.5 gradient-primary text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                {sendingTestEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando prueba...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Enviar Correo de Prueba
                  </>
                )}
              </button>
            </form>

            {testEmailResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold ${
                  testEmailResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                }`}
              >
                {testEmailResult.success ? `✓ ${testEmailResult.message}` : `⚠ ${testEmailResult.error}`}
              </div>
            )}
          </div>

          {/* Automated Event Triggers Grid */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <BellIcon className="w-4 h-4 text-purple-500" />
              Flujos Automatizados Configurados en el Sistema
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">1. Solicitudes de Corrección</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">Inmediato</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cada vez que un operador envía una solicitud de corrección de inasistencia, se envía una alerta a los administradores del sistema con los motivos y enlace de revisión.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">2. Resolución de Corrección</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">Inmediato</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cuando la administración Aprueba o Rechaza una solicitud, el operador que la radicó recibe un correo formal con el concepto administrativo y la actualización de asistencia.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">3. Reporte Diario de Inasistencias</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">Cierre de Jornada</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Consolida la lista completa de niños y miembros del personal que registraron ausencia, discriminando grupo y rol para control de gestión institucional.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">4. Auto-Cierre Horario</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">16:30 / 17:50</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Notifica al equipo directivo cuando el temporizador del sistema efectúa el marcaje masivo de ausencias al término del horario límite escolar y laboral.
                </p>
              </div>
            </div>
          </div>

          {/* Vercel Environment Variables Guide */}
          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#0c1220] border border-gray-200 dark:border-gray-700 space-y-3">
            <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Variables de Entorno para Vercel
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Opción 1: Resend (Recomendada)</span>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  Crea una cuenta gratuita en resend.com y agrega una sola variable en Vercel:
                </p>
                <code className="block p-2 bg-gray-100 dark:bg-gray-900 rounded font-mono text-[11px] text-gray-800 dark:text-gray-200">
                  RESEND_API_KEY=re_123456...
                </code>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="font-bold text-blue-600 dark:text-blue-400">Opción 2: Servidor SMTP / Gmail</span>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  Usa cualquier servidor de correo saliente SMTP agregando en Vercel:
                </p>
                <code className="block p-2 bg-gray-100 dark:bg-gray-900 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200 leading-tight">
                  SMTP_HOST=smtp.gmail.com<br />
                  SMTP_PORT=465<br />
                  SMTP_USER=tu-correo@gmail.com<br />
                  SMTP_PASS=tu-contraseña-aplicacion
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LISTADOS EXCEL */}
      {activeTab === "downloads" && (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Descarga de Listados y Planillas (Excel)</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Genera archivos .xlsx completos con la información actualizada de niños y personal de Casita de Tareas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Niños */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl gradient-primary text-white">
                  <UserGroupIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Planilla de Estudiantes</h4>
                  <p className="text-xs text-gray-400">Descarga con filtros por grupo</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Grupo específico:</label>
                <select
                  value={downloadGroup}
                  onChange={(e) => setDownloadGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white"
                >
                  <option value="all">Todos los grupos activos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleDownloadChildren}
                disabled={downloading}
                className="w-full py-2.5 px-4 gradient-primary text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Descargar Planilla de Niños (.xlsx)
              </button>
            </div>

            {/* Personal */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl gradient-success text-white">
                  <BriefcaseIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Planilla de Personal y Talento Humano</h4>
                  <p className="text-xs text-gray-400">Docentes y Practicantes en convenio</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleDownloadStaff("teachers")}
                  disabled={downloading}
                  className="w-full py-2.5 px-4 bg-white dark:bg-[#0c1220] border border-gray-200 dark:border-gray-700 hover:border-primary text-gray-800 dark:text-gray-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <AcademicCapIcon className="w-4 h-4 text-primary" />
                  Descargar Listado de Profesores (.xlsx)
                </button>

                <button
                  onClick={() => handleDownloadStaff("practitioners")}
                  disabled={downloading}
                  className="w-full py-2.5 px-4 bg-white dark:bg-[#0c1220] border border-gray-200 dark:border-gray-700 hover:border-emerald-500 text-gray-800 dark:text-gray-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <BriefcaseIcon className="w-4 h-4 text-emerald-500" />
                  Descargar Listado de Practicantes (.xlsx)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SEGURIDAD Y BACKUP */}
      {activeTab === "backup" && (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Copia de Seguridad y Respaldo Institucional</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Genera copias completas de la base de datos para custodia o contingencias.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
            <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300 mb-1">Respaldo Integral de Datos</h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
              El archivo descargado contiene la información íntegra de niños, profesores, practicantes, asistencias históricas, correcciones y configuración.
            </p>

            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="px-5 py-2.5 gradient-primary text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              {backupLoading ? "Generando copia..." : "Descargar Copia de Seguridad (.json)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}