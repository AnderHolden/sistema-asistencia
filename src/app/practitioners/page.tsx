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
  BriefcaseIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { Practitioner } from "@/types/database";

export default function PractitionersPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Practitioner | null>(null);

  // Form State
  const initialForm = {
    first_name: "",
    last_name: "",
    document_type: "CC",
    document: "",
    email: "",
    phone: "",
    university: "",
    career: "",
    supervisor_name: "",
    daily_hours: 4,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    role: "practicante",
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
      const snap = await getDocs(query(collection(getFirebaseDb(), "practitioners"), orderBy("first_name")));
      setPractitioners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner)));
    } catch (err) {
      console.error("Error loading practitioners:", err);
      toast.error("Error al cargar practicantes");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setShowModal(true);
  }

  function openEdit(p: Practitioner) {
    setEditing(p);
    setForm({
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      document_type: p.document_type || "CC",
      document: p.document || "",
      email: p.email || "",
      phone: p.phone || "",
      university: p.university || p.study || "",
      career: p.career || p.study || "",
      supervisor_name: p.supervisor_name || "",
      daily_hours: p.daily_hours || 4,
      start_date: p.start_date || p.hire_date || new Date().toISOString().split("T")[0],
      end_date: p.end_date || "",
      role: p.role || "practicante",
      status: p.status || "active",
      photo_url: p.photo_url || "",
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
      const dupSnap = await getDocs(query(collection(getFirebaseDb(), "practitioners"), where("document", "==", form.document.trim())));
      if (dupSnap.docs.find((d) => !editing || d.id !== editing.id)) {
        toast.error("Este documento ya está registrado en el sistema");
        return;
      }

      const payload = {
        ...form,
        document: form.document.trim(),
        study: form.career || form.university || "", // Keep backward compatibility
        hire_date: form.start_date, // Keep backward compatibility
        daily_hours: Number(form.daily_hours) || 4,
        photo_url: form.photo_url || null,
        end_date: form.end_date ? form.end_date : null,
        supervisor_name: form.supervisor_name ? form.supervisor_name.trim() : null,
      };

      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "practitioners", editing.id), payload);
        await logAction("update", "practitioners", editing.id, payload);
        toast.success("Practicante actualizado exitosamente");
      } else {
        await addDoc(collection(getFirebaseDb(), "practitioners"), {
          ...payload,
          created_at: new Date().toISOString(),
        });
        await logAction("create", "practitioners", null, payload);
        toast.success("Practicante registrado exitosamente");
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar información");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "practitioners", id));
      await logAction("delete", "practitioners", id, null);
      toast.success("Practicante eliminado del registro");
      setDeleteConfirm(null);
      loadData();
    } catch {
      toast.error("Error al eliminar el practicante");
    }
  }

  // Filtered List
  const filtered = useMemo(() => {
    return practitioners.filter((p) => {
      const term = search.toLowerCase();
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      const docNum = p.document?.toLowerCase() || "";
      const uni = (p.university || p.study || "").toLowerCase();
      const car = (p.career || "").toLowerCase();

      const matchesSearch = fullName.includes(term) || docNum.includes(term) || uni.includes(term) || car.includes(term);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [practitioners, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = practitioners.length;
    const active = practitioners.filter((p) => p.status === "active").length;
    const inactive = total - active;
    const universities = new Set(practitioners.map((p) => p.university || p.study).filter(Boolean)).size;
    return { total, active, inactive, universities };
  }, [practitioners]);

  if (loading) return <LoadingSpinner label="Cargando practicantes y convenios..." />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <BriefcaseIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Practicantes y Convenios
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión académica, control de horas formativas y convenios institucionales
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
            Registrar Practicante
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
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Registrados</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Practicantes</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            {stats.active}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">En Práctica</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Activos</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            {stats.universities}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Convenios</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Universidades</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center font-bold">
            {stats.inactive}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Prácticas Finalizadas</p>
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
            placeholder="Buscar por nombre, documento, universidad o carrera..."
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

      {/* Practitioners Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const universityName = p.university || p.study || "Convenio Educativo";
            const careerName = p.career || p.role || "Práctica Formativa";
            const docLabel = `${p.document_type || "CC"} ${p.document || "S/I"}`;
            const hoursPerDay = p.daily_hours || 4;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Profile Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <AvatarFallback name={`${p.first_name} ${p.last_name}`} size="lg" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                            {p.first_name} {p.last_name}
                          </h3>
                        </div>
                        <p className="text-xs font-semibold text-primary">{docLabel}</p>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === "active"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {p.status === "active" ? (
                            <>
                              <CheckCircleIcon className="w-3 h-3" /> En Práctica Activa
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-3 h-3" /> Finalizado
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        title="Editar información"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(p.id)}
                        title="Eliminar practicante"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-red-50 hover:text-red-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Academic & Practice Info */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <BuildingOffice2Icon className="w-4 h-4 text-purple-500 shrink-0" />
                      <span className="font-semibold truncate" title={universityName}>
                        {universityName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <AcademicCapIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate" title={careerName}>
                        {careerName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>{hoursPerDay}h / día</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>Desde: {p.start_date || p.hire_date || "S/F"}</span>
                      </div>
                    </div>

                    {(p.email || p.phone) && (
                      <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {p.phone && (
                          <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded-md">
                            <PhoneIcon className="w-3 h-3 text-emerald-500" /> {p.phone}
                          </span>
                        )}
                        {p.email && (
                          <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={p.email}>
                            <EnvelopeIcon className="w-3 h-3 text-blue-500" /> {p.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-3 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                    {p.role || "Practicante"}
                  </span>
                  <Link
                    href={`/certificates?type=practitioners&id=${p.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Generar Certificado
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-bold text-lg">No se encontraron practicantes</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {search || statusFilter !== "all"
              ? "Prueba cambiando los filtros o el texto de búsqueda."
              : "Comienza registrando a los estudiantes y auxiliares con convenio de prácticas formativas."}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={openCreate}
              className="mt-5 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md inline-flex items-center gap-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" /> Registrar Primer Practicante
            </button>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Practitioner */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Editar Información del Practicante" : "Registrar Nuevo Practicante"}
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
            <p className="text-xs text-gray-400 font-medium">Fotografía institucional (JPG/PNG, máx 5MB)</p>
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
                placeholder="Ej: Camila Andrea"
              />
              <Input
                label="Apellidos *"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                placeholder="Ej: Gómez Restrepo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <Select
                label="Tipo Doc."
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                options={[
                  { value: "CC", label: "Cédula de Ciudadanía (CC)" },
                  { value: "TI", label: "Tarjeta de Identidad (TI)" },
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
                  placeholder="Ej: 1020304050"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Correo Electrónico"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="practicante@correo.com"
              />
              <Input
                label="Teléfono / WhatsApp"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 310 123 4567"
              />
            </div>
          </div>

          {/* Section 2: Convenio y Prácticas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              2. Convenio Académico y Prácticas Formativas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Universidad / Institución de Convenio *"
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                placeholder="Ej: Universidad Pedagógica Nacional / SENA"
              />
              <Input
                label="Carrera / Programa Académico *"
                value={form.career}
                onChange={(e) => setForm({ ...form, career: e.target.value })}
                placeholder="Ej: Lic. en Educación Infantil / Psicología"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Supervisor / Tutor de la Universidad"
                value={form.supervisor_name}
                onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })}
                placeholder="Nombre del docente tutor"
              />
              <Select
                label="Intensidad Diaria de Práctica"
                value={String(form.daily_hours)}
                onChange={(e) => setForm({ ...form, daily_hours: Number(e.target.value) })}
                options={[
                  { value: "4", label: "4 Horas / Día (Media Jornada)" },
                  { value: "5", label: "5 Horas / Día" },
                  { value: "6", label: "6 Horas / Día" },
                  { value: "8", label: "8 Horas / Día (Jornada Completa)" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Fecha de Inicio de Prácticas *"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
              <Input
                label="Fecha Estimada de Finalización"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                helperText="Opcional. Dejar vacío si la práctica continúa vigente."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Select
                label="Rol Institucional"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                options={[
                  { value: "practicante", label: "Practicante Universitario / Normalista" },
                  { value: "auxiliar", label: "Auxiliar Pedagógico / Apoyo" },
                ]}
              />
              <Select
                label="Estado de Práctica"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                options={[
                  { value: "active", label: "Activo (En Práctica Actual)" },
                  { value: "inactive", label: "Inactivo (Práctica Culminada / Pausada)" },
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
            ¿Está seguro de que desea eliminar el registro de este practicante? Esta acción no se puede deshacer y desvinculará sus registros asociados.
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
              Eliminar Practicante
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
