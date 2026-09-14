"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { exportToExcel } from "@/lib/export";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { Cog6ToothIcon, DocumentArrowDownIcon, UserGroupIcon, AcademicCapIcon, BriefcaseIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ClockIcon, ArrowDownTrayIcon as DownloadIcon, CalendarDaysIcon, ShieldCheckIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { Child, Group, Teacher, Practitioner } from "@/types/database";

interface Setting { id: string; setting_key: string; setting_value: string | null; }
interface Holiday { id: string; date: string; name: string; description?: string; }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [downloadGroup, setDownloadGroup] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [auditExportLoading, setAuditExportLoading] = useState(false);
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const [settingsSnap, groupsSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "system_settings"), orderBy("setting_key"))),
      getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name"))),
    ]);
    const data = settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Setting));
    setSettings(data);
    setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    const formMap: Record<string, string> = {};
    data.forEach((s) => { formMap[s.setting_key] = s.setting_value || ""; });
    setForm(formMap);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = settings.find((s) => s.setting_key === key);
        if (existing) { await updateDoc(doc(getFirebaseDb(), "system_settings", existing.id), { setting_value: value }); }
        else { await addDoc(collection(getFirebaseDb(), "system_settings"), { setting_key: key, setting_value: value }); }
      }
      await logAction("update", "system_settings", null, form);
      toast.success("Configuracion guardada");
      loadSettings();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
    setSaving(false);
  }

  async function handleDownloadChildren() {
    setDownloading(true);
    try {
      const q = downloadGroup === "all"
        ? query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))
        : query(collection(getFirebaseDb(), "children"), where("status", "==", "active"), where("group_id", "==", downloadGroup));
      const snap = await getDocs(q);
      const children = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));

      if (children.length === 0) { toast.error("No hay ninos para descargar"); setDownloading(false); return; }

      const groupName = downloadGroup === "all" ? "Todos" : groups.find((g) => g.id === downloadGroup)?.name || "Sin grupo";

      exportToExcel(
        children.map((c) => ({
          "ID": c.child_id_code || "",
          "Nombre Completo": `${c.first_name} ${c.last_name}`,
          "Edad": c.age || "",
          "Grupo": groups.find((g) => g.id === c.group_id)?.name || "Sin grupo",
        })),
        `lista_ninos_${groupName.replace(/\s+/g, "_")}`
      );

      toast.success(`Lista de ${children.length} ninos descargada`);
      await logAction("export", "children", null, { group: groupName, count: children.length });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al descargar"); }
    setDownloading(false);
  }

  async function handleDownloadTeachers() {
    setDownloading(true);
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "teachers"), orderBy("first_name")));
      const teachers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));

      if (teachers.length === 0) { toast.error("No hay profesores para descargar"); setDownloading(false); return; }

      exportToExcel(
        teachers.map((t) => ({
          "Documento": t.document || "",
          "Nombre Completo": `${t.first_name} ${t.last_name}`,
          "Email": t.email || "",
          "Telefono": t.phone || "",
          "Rol": t.role,
          "Fecha Contratacion": t.hire_date,
          "Estado": t.status === "active" ? "Activo" : "Inactivo",
        })),
        "lista_profesores"
      );

      toast.success(`Lista de ${teachers.length} profesores descargada`);
      await logAction("export", "teachers", null, { count: teachers.length });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al descargar"); }
    setDownloading(false);
  }

  async function handleDownloadPractitioners() {
    setDownloading(true);
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "practitioners"), orderBy("first_name")));
      const practitioners = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));

      if (practitioners.length === 0) { toast.error("No hay practicantes para descargar"); setDownloading(false); return; }

      exportToExcel(
        practitioners.map((p) => ({
          "Documento": p.document || "",
          "Nombre Completo": `${p.first_name} ${p.last_name}`,
          "Email": p.email || "",
          "Telefono": p.phone || "",
          "Estudio": p.study || "",
          "Rol": p.role,
          "Fecha Inicio": p.hire_date,
          "Estado": p.status === "active" ? "Activo" : "Inactivo",
        })),
        "lista_practicantes"
      );

      toast.success(`Lista de ${practitioners.length} practicantes descargada`);
      await logAction("export", "practitioners", null, { count: practitioners.length });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al descargar"); }
    setDownloading(false);
  }

  async function handleDownloadAllStaff() {
    setDownloading(true);
    try {
      const [teachersSnap, practitionersSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "teachers"), orderBy("first_name"))),
        getDocs(query(collection(getFirebaseDb(), "practitioners"), orderBy("first_name"))),
      ]);
      const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
      const practitioners = practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));
      const allStaff = [
        ...teachers.map((t) => ({ ...t, type: "Profesor" })),
        ...practitioners.map((p) => ({ ...p, type: "Practicante" })),
      ];

      if (allStaff.length === 0) { toast.error("No hay personal para descargar"); setDownloading(false); return; }

      exportToExcel(
        allStaff.map((s) => ({
          "Tipo": s.type,
          "Documento": s.document || "",
          "Nombre Completo": `${s.first_name} ${s.last_name}`,
          "Email": s.email || "",
          "Telefono": s.phone || "",
          "Rol / Estudio": s.type === "Profesor" ? s.role : "study" in s ? (s as { study?: string }).study || "" : "",
          "Fecha Inicio": s.hire_date,
          "Estado": s.status === "active" ? "Activo" : "Inactivo",
        })),
        "lista_personal_completo"
      );

      toast.success(`Lista de ${allStaff.length} miembros descargada`);
      await logAction("export", "staff", null, { teachers: teachers.length, practitioners: practitioners.length });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al descargar"); }
    setDownloading(false);
  }

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const [childrenSnap, groupsSnap, teachersSnap, practitionersSnap, attendanceChildrenSnap, attendanceStaffSnap, settingsSnap, correctionsSnap, auditSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
        getDocs(collection(getFirebaseDb(), "groups")),
        getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
        getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
        getDocs(collection(getFirebaseDb(), "attendance_children")),
        getDocs(collection(getFirebaseDb(), "attendance_staff")),
        getDocs(collection(getFirebaseDb(), "system_settings")),
        getDocs(collection(getFirebaseDb(), "correction_requests")),
        getDocs(collection(getFirebaseDb(), "correction_requests_children")),
      ]);

      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        children: childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        groups: groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        teachers: teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        practitioners: practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        attendance_children: attendanceChildrenSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        attendance_staff: attendanceStaffSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        system_settings: settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        correction_requests: correctionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        correction_requests_children: auditSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_sistema_asistencia_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Backup completo descargado");
      await logAction("backup", "system", null, { collections: Object.keys(backup).length - 2 });
      // Send email notification
      try {
        await fetch("/api/email/send-backup-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true, details: "Backup manual completado desde Configuración" }),
        });
      } catch { /* ignore email errors */ }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al hacer backup");
    }
    setBackupLoading(false);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Esto SOBREESCRIBIRA todos los datos del sistema. ¿Continuar?")) {
      e.target.value = "";
      return;
    }

    setBackupLoading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.timestamp) { throw new Error("Archivo de backup invalido"); }

      const batchSize = 500;
      const writeBatch = async (col: string, items: Array<Record<string, unknown>>) => {
        const db = getFirebaseDb();
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await Promise.all(batch.map((item) => {
            const { id, ...data } = item;
            return addDoc(collection(db, col), data);
          }));
        }
      };

      await Promise.all([
        writeBatch("children", backup.children || []),
        writeBatch("groups", backup.groups || []),
        writeBatch("teachers", backup.teachers || []),
        writeBatch("practitioners", backup.practitioners || []),
        writeBatch("attendance_children", backup.attendance_children || []),
        writeBatch("attendance_staff", backup.attendance_staff || []),
        writeBatch("system_settings", backup.system_settings || []),
        writeBatch("correction_requests", backup.correction_requests || []),
        writeBatch("correction_requests_children", backup.correction_requests_children || []),
      ]);

      toast.success("Restauracion completa. Recarga la pagina.");
      await logAction("restore", "system", null, { backupTimestamp: backup.timestamp });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al restaurar");
    }
    setBackupLoading(false);
    e.target.value = "";
  }

  async function loadHolidays() {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "holidays"), orderBy("date")));
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Holiday)));
    } catch { /* ignore */ }
  }

  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) { toast.error("Fecha y nombre son obligatorios"); return; }
    try {
      await addDoc(collection(getFirebaseDb(), "holidays"), { date: newHolidayDate, name: newHolidayName.trim(), description: "", created_at: new Date().toISOString() });
      toast.success("Festivo agregado");
      setNewHolidayDate(""); setNewHolidayName("");
      await loadHolidays();
      await logAction("create", "holidays", null, { date: newHolidayDate, name: newHolidayName });
    } catch { toast.error("Error al agregar festivo"); }
  }

  async function deleteHoliday(id: string) {
    if (!confirm("Eliminar este festivo?")) return;
    try {
      await deleteDoc(doc(getFirebaseDb(), "holidays", id));
      toast.success("Festivo eliminado");
      await loadHolidays();
      await logAction("delete", "holidays", id, null);
    } catch { toast.error("Error al eliminar"); }
  }

  async function exportAudit() {
    setAuditExportLoading(true);
    try {
      const constraints: any[] = [orderBy("timestamp", "desc")];
      if (auditDateFrom) constraints.push(where("timestamp", ">=", auditDateFrom));
      if (auditDateTo) constraints.push(where("timestamp", "<=", auditDateTo + "T23:59:59"));
      const q = query(collection(getFirebaseDb(), "audit_logs"), ...constraints);
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (logs.length === 0) { toast.error("No hay registros de auditoria en ese rango"); setAuditExportLoading(false); return; }

      exportToExcel(
        logs.map((l: any) => {
          const ts = l.timestamp;
          const date = ts?.toDate ? ts.toDate() : new Date(ts);
          return {
            "Fecha": date.toLocaleString("es-CO"),
            "Usuario": l.user_email || l.user_id || "Sistema",
            "Accion": l.action,
            "Entidad": l.entity_type,
            "Entidad ID": l.entity_id || "",
            "Detalle": l.details ? JSON.stringify(l.details) : "",
          };
        }),
        `auditoria_${auditDateFrom || "inicio"}_${auditDateTo || "hoy"}`
      );

      toast.success(`${logs.length} registros de auditoria exportados`);
      await logAction("export", "audit_logs", null, { from: auditDateFrom, to: auditDateTo, count: logs.length });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al exportar auditoria"); }
    setAuditExportLoading(false);
  }

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { loadHolidays(); }, []);

  if (loading) return <LoadingSpinner label="Cargando configuracion..." />;

  const settingFields = [
    { key: "institution_name", label: "Nombre de la institucion", placeholder: "Ej: Casita de tareas - La alegria del conocimiento" },
    { key: "institution_address", label: "Direccion", placeholder: "Ej: Calle 123 #456-789" },
    { key: "institution_phone", label: "Telefono", placeholder: "Ej: (601) 123-4567" },
    { key: "auto_mark_children", label: "Hora auto-cierre ninos (HH:MM, 24h)", placeholder: "Ej: 17:50" },
    { key: "auto_mark_staff", label: "Hora auto-cierre personal (HH:MM, 24h)", placeholder: "Ej: 16:30" },
    { key: "work_days", label: "Dias laborables (1=Lun..7=Dom, separado por comas)", placeholder: "Ej: 1,2,3,4,5" },
    { key: "smtp_host", label: "SMTP Host", placeholder: "Ej: smtp.gmail.com" },
    { key: "smtp_port", label: "SMTP Puerto", placeholder: "Ej: 587" },
    { key: "smtp_secure", label: "SMTP Seguro (true/false)", placeholder: "false" },
    { key: "smtp_user", label: "SMTP Usuario", placeholder: "Ej: correo@dominio.com" },
    { key: "smtp_pass", label: "SMTP Contraseña", placeholder: "Contraseña de aplicación", type: "password" },
    { key: "smtp_from", label: "Email remitente", placeholder: "Ej: Sistema <noreply@dominio.com>" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><Cog6ToothIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Configuracion</h1><p className="text-sm text-gray-500 dark:text-gray-400">Ajustes generales del sistema</p></div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><Cog6ToothIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Informacion General</h3>
        </div>
        <div className="space-y-4">
          {settingFields.map((s) => (
            <Input key={s.key} label={s.label} value={form[s.key] || ""} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} placeholder={s.placeholder} />
          ))}
        </div>
        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {saving ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>) : "Guardar Configuracion"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-success flex items-center justify-center"><ClockIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Horarios de Auto-Marcaje</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Configura a que hora se marcan automaticamente las ausencias. Formato 24h (HH:MM).</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Auto-cierre ninos" value={form.auto_mark_children || "17:50"} onChange={(e) => setForm({ ...form, auto_mark_children: e.target.value })} type="time" />
          <Input label="Auto-cierre personal" value={form.auto_mark_staff || "16:30"} onChange={(e) => setForm({ ...form, auto_mark_staff: e.target.value })} type="time" />
        </div>
        <Input label="Dias laborables" value={form.work_days || "1,2,3,4,5"} onChange={(e) => setForm({ ...form, work_days: e.target.value })} placeholder="1,2,3,4,5 (Lun=1...Dom=7)" />
        <div className="mt-4 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {saving ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>) : "Guardar Horarios"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-success flex items-center justify-center"><DownloadIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Descargar Listados (Excel)</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Genera listados en Excel con filtros opcionales.</p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="download-group" className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Grupo</label>
              <select id="download-group" value={downloadGroup} onChange={(e) => setDownloadGroup(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                <option value="all">Todos los grupos</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <button onClick={handleDownloadChildren} disabled={downloading} className="px-5 py-2.5 gradient-success text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
              {downloading ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />...</>) : (<><DocumentArrowDownIcon className="w-4 h-4" /> Descargar Ninos</>)}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleDownloadTeachers} disabled={downloading} className="px-5 py-2.5 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2"><AcademicCapIcon className="w-4 h-4" /> Profesores</button>
            <button onClick={handleDownloadPractitioners} disabled={downloading} className="px-5 py-2.5 bg-amber/10 text-amber-600 dark:text-amber-400 font-semibold rounded-xl hover:bg-amber/20 transition-colors flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" /> Practicantes</button>
            <button onClick={handleDownloadAllStaff} disabled={downloading} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"><UserGroupIcon className="w-4 h-4" /> Todo el Personal</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><ArrowDownTrayIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Backup / Restore</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Backup completo del sistema (JSON) y restauracion. Incluye: ninos, grupos, profesores, practicantes, asistencia, configuracion, correcciones.</p>
        <div className="flex flex-wrap gap-4">
          <button onClick={handleBackup} disabled={backupLoading} className="px-5 py-2.5 gradient-success text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {backupLoading ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />...</>) : (<><ArrowDownTrayIcon className="w-4 h-4" /> Backup Completo (JSON)</>)}
          </button>
          <div className="relative">
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" id="backup-restore" ref={restoreInputRef} />
            <button onClick={() => restoreInputRef.current?.click()} disabled={backupLoading} className="px-5 py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2">
              <ArrowUpTrayIcon className="w-4 h-4" /> Restaurar Backup
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">El backup incluye 9 colecciones. La restauracion SOBREESCRIBE todos los datos existentes.</p>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-success flex items-center justify-center"><CalendarDaysIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Festivos / Dias No Laborables</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Estas fechas se excluyen de reportes, asistencia y auto-marcaje.</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          <input type="text" placeholder="Nombre del festivo (ej: Navidad)" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all flex-1 min-w-[200px]" />
          <button onClick={addHoliday} className="px-5 py-2.5 gradient-success text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Agregar</button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay festivos registrados</p>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">{new Date(h.date).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" })}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{h.name}</span>
                </div>
                <button onClick={() => deleteHoliday(h.id)} className="text-red-500 hover:text-red-700 transition-colors" aria-label="Eliminar festivo"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><ShieldCheckIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Exportar Auditoria</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Descarga el log de auditoria con filtros opcionales por fecha.</p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Desde</label>
            <input type="date" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Hasta</label>
            <input type="date" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>
          <button onClick={exportAudit} disabled={auditExportLoading} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {auditExportLoading ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />...</>) : (<><DocumentArrowDownIcon className="w-4 h-4" /> Exportar Excel</>)}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Columnas: Fecha, Usuario, Accion, Entidad, Entidad ID, Detalle</p>
      </div>
    </div>
  );
}