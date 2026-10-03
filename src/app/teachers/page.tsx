"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PhotoUpload, AvatarFallback } from "@/components/ui/PhotoUpload";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type { Teacher } from "@/types/database";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  // Form State
  const initialForm = {
    first_name: "",
    last_name: "",
    document_type: "CC",
    document: "",
    email: "",
    phone: "",
    job_title: "Docente Titular",
    contract_type: "Término Fijo",
    hire_date: new Date().toISOString().split("T")[0],
    end_date: "",
    salary: "",
    role: "profesor",
    status: "active" as "active" | "inactive",
    photo_url: "",
  };

  const [form, setForm] = useState(initialForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "teachers"), orderBy("first_name")));
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)));
    } catch (err) {
      console.error("Error loading teachers:", err);
      toast.error("Error al cargar la lista de profesores");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setShowModal(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setForm({
      first_name: t.first_name || "",
      last_name: t.last_name || "",
      document_type: t.document_type || "CC",
      document: t.document || "",
      email: t.email || "",
      phone: t.phone || "",
      job_title: t.job_title || t.role || "Docente Titular",
      contract_type: t.contract_type || "Término Fijo",
      hire_date: t.hire_date || new Date().toISOString().split("T")[0],
      end_date: t.end_date || "",
      salary: t.salary || "",
      role: t.role || "profesor",
      status: t.status || "active",
      photo_url: t.photo_url || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.document.trim()) {
        toast.error("Nombres, Apellidos y Documento son obligatorios");
        return;
      }

      // Check unique document
      const dupSnap = await getDocs(query(collection(getFirebaseDb(), "teachers"), where("document", "==", form.document.trim())));
      if (dupSnap.docs.find((d) => !editing || d.id !== editing.id)) {
        toast.error("Este documento de identidad ya está registrado para otro profesor");
        return;
      }

      const payload = {
        ...form,
        document: form.document.trim(),
        job_title: form.job_title.trim(),
        photo_url: form.photo_url || null,
        end_date: form.end_date ? form.end_date : null,
        salary: form.salary ? form.salary.trim() : null,
      };

      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "teachers", editing.id), payload);
        await logAction("update", "teachers", editing.id, payload);
        toast.success("Docente actualizado exitosamente");
      } else {
        await addDoc(collection(getFirebaseDb(), "teachers"), {
          ...payload,
          created_at: new Date().toISOString(),
        });
        await logAction("create", "teachers", null, payload);
        toast.success("Docente registrado exitosamente");
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar información");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "teachers", id));
      await logAction("delete", "teachers", id, null);
      toast.success("Docente eliminado del registro");
      setDeleteConfirm(null);
      loadData();
    } catch {
      toast.error("Error al eliminar el docente");
    }
  }

  // Filtered List
  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      const term = search.toLowerCase();
      const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
      const docNum = t.document?.toLowerCase() || "";
      const job = (t.job_title || t.role || "").toLowerCase();
      const contract = (t.contract_type || "").toLowerCase();

      const matchesSearch = fullName.includes(term) || docNum.includes(term) || job.includes(term) || contract.includes(term);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [teachers, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((t) => t.status === "active").length;
    const inactive = total - active;
    const indefinite = teachers.filter((t) => (t.contract_type || "").toLowerCase().includes("indefinido")).length;
    return { total, active, inactive, indefinite };
  }, [teachers]);

  if (loading) return <LoadingSpinner label="Cargando nómina docente..." />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <AcademicCapIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Cuerpo Docente y Profesores
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión laboral, contratos, vinculaciones y certificados de trabajo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/certificates"
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] text-gray-700 dark:text-gray-200 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
          >
            <DocumentTextIcon className="w-4 h-4 text-emerald-500" />
            Certificados
          </Link>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center gap-2 text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Registrar Profesor
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            {stats.total}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Nómina</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Docentes</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            {stats.active}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Vinculación</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Activos</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            {stats.indefinite}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Contratos</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">T. Indefinido</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center font-bold">
            {stats.inactive}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Retirados</p>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Inactivos</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, cargo o tipo de contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "all"
                ? "bg-white dark:bg-[#1a2438] text-gray-900 dark:text-white shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "active"
                ? "bg-white dark:bg-[#1a2438] text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Activos ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "inactive"
                ? "bg-white dark:bg-[#1a2438] text-gray-700 dark:text-gray-300 shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Inactivos ({stats.inactive})
          </button>
        </div>
      </div>

      {/* Teachers Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const jobTitle = t.job_title || t.role || "Docente";
            const contractType = t.contract_type || "Término Fijo";
            const docLabel = `${t.document_type || "CC"} ${t.document || "S/I"}`;

            return (
              <div
                key={t.id}
                className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Profile Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                        {t.photo_url ? (
                          <img src={t.photo_url} alt={t.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <AvatarFallback name={`${t.first_name} ${t.last_name}`} size="lg" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                          {t.first_name} {t.last_name}
                        </h3>
                        <p className="text-xs font-semibold text-primary">{docLabel}</p>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === "active"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {t.status === "active" ? (
                            <>
                              <CheckCircleIcon className="w-3 h-3" /> Vinculado Activo
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-3 h-3" /> Contrato Finalizado
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(t)}
                        title="Editar información"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        title="Eliminar docente"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-red-50 hover:text-red-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Labor & Contract Info */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                      <BriefcaseIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate" title={jobTitle}>
                        {jobTitle}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-500" />
                        {contractType}
                      </span>
                      {t.salary && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <BanknotesIcon className="w-3.5 h-3.5" />
                          {t.salary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 pt-1">
                      <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        Ingreso: {t.hire_date || "S/F"}
                        {t.end_date ? ` · Fin: ${t.end_date}` : " · Indefinido"}
                      </span>
                    </div>

                    {(t.email || t.phone) && (
                      <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {t.phone && (
                          <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded-md">
                            <PhoneIcon className="w-3 h-3 text-emerald-500" /> {t.phone}
                          </span>
                        )}
                        {t.email && (
                          <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={t.email}>
                            <EnvelopeIcon className="w-3 h-3 text-blue-500" /> {t.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-3 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                    {t.role || "Profesor"}
                  </span>
                  <Link
                    href={`/certificates?type=teachers&id=${t.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Generar Certificado Laboral
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <AcademicCapIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-bold text-lg">No se encontraron profesores</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {search || statusFilter !== "all"
              ? "Prueba cambiando los filtros o el texto de búsqueda."
              : "Comienza registrando a los docentes y profesores de la institución."}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={openCreate}
              className="mt-5 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md inline-flex items-center gap-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" /> Registrar Primer Docente
            </button>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Teacher */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Editar Información del Profesor" : "Registrar Nuevo Docente"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
            <PhotoUpload
              currentPhoto={form.photo_url || null}
              onPhotoUploaded={(url) => setForm({ ...form, photo_url: url })}
              onPhotoRemoved={() => setForm({ ...form, photo_url: "" })}
              size="lg"
            />
            <p className="text-xs text-gray-400 font-medium">Fotografía del docente (JPG/PNG, máx 5MB)</p>
          </div>

          {/* Section 1: Datos Personales */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              1. Datos Personales y de Identificación
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombres *"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
                placeholder="Ej: Laura Mercedes"
              />
              <Input
                label="Apellidos *"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                placeholder="Ej: Rojas Beltrán"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <Select
                label="Tipo Doc."
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                options={[
                  { value: "CC", label: "Cédula de Ciudadanía (CC)" },
                  { value: "CE", label: "Cédula de Extranjería (CE)" },
                  { value: "PAS", label: "Pasaporte (PAS)" },
                ]}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Número de Documento *"
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                  required
                  placeholder="Ej: 52345678"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Correo Electrónico"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="docente@casitadetareas.com"
              />
              <Input
                label="Teléfono / Celular"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 315 890 1234"
              />
            </div>
          </div>

          {/* Section 2: Información Laboral y Contractual */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              2. Vinculación Laboral y Contractual
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Cargo / Función Institucional *"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                required
                placeholder="Ej: Docente Titular de Primaria"
              />
              <Select
                label="Tipo de Contrato *"
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                options={[
                  { value: "Término Indefinido", label: "Contrato a Término Indefinido" },
                  { value: "Término Fijo", label: "Contrato a Término Fijo" },
                  { value: "Prestación de Servicios", label: "Contrato de Prestación de Servicios" },
                  { value: "Obra o Labor", label: "Contrato por Obra o Labor" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Fecha de Ingreso / Contratación *"
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                required
              />
              <Input
                label="Fecha de Terminación (si aplica)"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                helperText="Dejar vacío si el contrato se encuentra vigente."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Asignación Salarial Mensual (Opcional)"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="Ej: $ 1.800.000 COP"
                helperText="Opcional. Se incluirá en certificados laborales solo si se especifica."
              />
              <Select
                label="Estado Laboral"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                options={[
                  { value: "active", label: "Activo (Laborando Actualmente)" },
                  { value: "inactive", label: "Inactivo (Contrato Finalizado / Retirado)" },
                ]}
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-sm"
            >
              {editing ? "Guardar Cambios" : "Completar Registro"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            ¿Está seguro de que desea eliminar el registro de este docente? Esta acción no se puede deshacer y desvinculará sus registros asociados.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md text-sm"
            >
              Eliminar Docente
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
