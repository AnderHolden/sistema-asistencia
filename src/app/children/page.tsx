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
  UserGroupIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  PhoneIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import type { Child, Group } from "@/types/database";

export default function ChildrenPage() {
  const [children, setChildren] = useState<(Child & { group: Group | null })[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  // Form State
  const initialForm = {
    first_name: "",
    last_name: "",
    document_type: "RC",
    document: "",
    date_of_birth: "",
    age: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    group_id: "",
    shift: "manana",
    enrollment_date: new Date().toISOString().split("T")[0],
    status: "active" as "active" | "inactive",
    observations: "",
    photo_url: "",
  };

  const [form, setForm] = useState(initialForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Auto-calculated next CT code
  const nextChildCode = useMemo(() => {
    if (children.length === 0) return "CT001";
    const maxNum = children.reduce((max, c) => {
      const match = c.child_id_code?.match(/^CT(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `CT${String(maxNum + 1).padStart(3, "0")}`;
  }, [children]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [childrenSnap, groupsSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "children"), orderBy("first_name"))),
        getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name"))),
      ]);
      const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
      setGroups(groupsList);
      setChildren(
        childrenSnap.docs.map((d) => {
          const childData = { id: d.id, ...d.data() } as Child;
          return { ...childData, group: groupsList.find((g) => g.id === childData.group_id) || null };
        })
      );
    } catch (err) {
      console.error("Error loading children:", err);
      toast.error("Error al cargar la lista de niños");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingChild(null);
    setForm(initialForm);
    setShowModal(true);
  }

  function openEdit(child: Child) {
    setEditingChild(child);
    setForm({
      first_name: child.first_name || "",
      last_name: child.last_name || "",
      document_type: child.document_type || "RC",
      document: child.document || "",
      date_of_birth: child.date_of_birth || "",
      age: child.age ? String(child.age) : "",
      guardian_name: child.guardian_name || "",
      guardian_phone: child.guardian_phone || "",
      guardian_email: child.guardian_email || "",
      group_id: child.group_id || "",
      shift: child.shift || "manana",
      enrollment_date: child.enrollment_date || child.created_at?.slice(0, 10) || new Date().toISOString().split("T")[0],
      status: child.status || "active",
      observations: child.observations || "",
      photo_url: child.photo_url || "",
    });
    setShowModal(true);
  }

  // Calculate age automatically if date of birth is selected
  function handleDobChange(dobString: string) {
    let computedAge = form.age;
    if (dobString) {
      const birth = new Date(dobString);
      const now = new Date();
      let diff = now.getFullYear() - birth.getFullYear();
      const monthDiff = now.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
        diff--;
      }
      if (diff >= 0 && diff <= 25) {
        computedAge = String(diff);
      }
    }
    setForm({ ...form, date_of_birth: dobString, age: computedAge });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Nombres y Apellidos son obligatorios");
      return;
    }

    const payload = {
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      document: form.document.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      age: form.age ? Number(form.age) : 0,
      group_id: form.group_id || null,
      photo_url: form.photo_url || null,
      observations: form.observations.trim() || null,
    };

    try {
      if (editingChild) {
        await updateDoc(doc(getFirebaseDb(), "children", editingChild.id), payload);
        await logAction("update", "children", editingChild.id, payload);
        toast.success("Estudiante actualizado exitosamente");
      } else {
        await addDoc(collection(getFirebaseDb(), "children"), {
          ...payload,
          child_id_code: nextChildCode,
          created_at: new Date().toISOString(),
        });
        await logAction("create", "children", null, { ...payload, child_id_code: nextChildCode });
        toast.success(`Estudiante registrado exitosamente con código ${nextChildCode}`);
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el estudiante");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "children", id));
      await logAction("delete", "children", id, null);
      toast.success("Estudiante eliminado del sistema");
      setDeleteConfirm(null);
      loadData();
    } catch {
      toast.error("Error al eliminar el estudiante");
    }
  }

  // Filtered List
  const filtered = useMemo(() => {
    return children.filter((c) => {
      const term = search.toLowerCase();
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const code = c.child_id_code?.toLowerCase() || "";
      const docNum = c.document?.toLowerCase() || "";
      const guardian = c.guardian_name?.toLowerCase() || "";

      const matchesSearch = fullName.includes(term) || code.includes(term) || docNum.includes(term) || guardian.includes(term);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesGroup = groupFilter === "all" || c.group_id === groupFilter;

      return matchesSearch && matchesStatus && matchesGroup;
    });
  }, [children, search, statusFilter, groupFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = children.length;
    const active = children.filter((c) => c.status === "active").length;
    const inactive = total - active;
    const morning = children.filter((c) => c.shift === "manana" && c.status === "active").length;
    const afternoon = children.filter((c) => c.shift === "tarde" && c.status === "active").length;
    const fullDay = children.filter((c) => c.shift === "completa" && c.status === "active").length;
    return { total, active, inactive, morning, afternoon, fullDay };
  }, [children]);

  if (loading) return <LoadingSpinner label="Cargando estudiantes y matrículas..." />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <UserGroupIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Matrícula de Estudiantes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Control de menores, acudientes, grupos pedagógicos y constancias de asistencia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/certificates"
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2438] text-gray-700 dark:text-gray-200 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
          >
            <DocumentTextIcon className="w-4 h-4 text-emerald-500" />
            Constancias
          </Link>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center gap-2 text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Matricular Niño
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
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Matrícula</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Estudiantes</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            {stats.active}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Asistencia Regular</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Activos</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            {stats.morning} / {stats.afternoon}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Mañana / Tarde</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Jornadas</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center font-bold">
            {stats.inactive}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Retirados / Egresados</p>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Inactivos</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código CT, documento o acudiente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-xs font-semibold focus:outline-none"
          >
            <option value="all">Todos los Grupos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
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
      </div>

      {/* Children Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((child) => {
            const shiftLabel =
              child.shift === "completa"
                ? "Jornada Completa"
                : child.shift === "manana"
                ? "Jornada Mañana"
                : "Jornada Tarde";

            const docLabel = child.document
              ? `${child.document_type || "RC"} ${child.document}`
              : "Sin Documento Registrado";

            return (
              <div
                key={child.id}
                className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Profile Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-700 shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                        {child.photo_url ? (
                          <img src={child.photo_url} alt={child.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <AvatarFallback name={`${child.first_name} ${child.last_name}`} size="lg" />
                        )}
                        {child.child_id_code && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-primary text-white shadow-xs">
                            {child.child_id_code}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                          {child.first_name} {child.last_name}
                        </h3>
                        <p className="text-xs font-semibold text-primary">{docLabel}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              child.status === "active"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {child.status === "active" ? (
                              <>
                                <CheckCircleIcon className="w-3 h-3" /> Activo
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-3 h-3" /> Retirado
                              </>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {child.age ? `${child.age} años` : "Edad s/i"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(child)}
                        title="Editar estudiante"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(child.id)}
                        title="Eliminar estudiante"
                        className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-red-50 hover:text-red-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Group & Shift Details */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        <SparklesIcon className="w-3.5 h-3.5 text-blue-500" />
                        {child.group?.name || "Sin Grupo Asignado"}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                        {shiftLabel}
                      </span>
                    </div>

                    {/* Guardian Info */}
                    <div className="pt-2 bg-gray-50/60 dark:bg-gray-800/40 p-2.5 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Acudiente</span>
                        {child.guardian_phone && (
                          <a
                            href={`tel:${child.guardian_phone}`}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <PhoneIcon className="w-3 h-3" />
                            {child.guardian_phone}
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {child.guardian_name || "Sin acudiente registrado"}
                      </p>
                      {child.guardian_email && (
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium truncate flex items-center gap-1">
                          <EnvelopeIcon className="w-3 h-3 shrink-0" />
                          {child.guardian_email}
                        </p>
                      )}
                    </div>

                    {child.observations && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 italic pt-1">
                        &quot;{child.observations}&quot;
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-3 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-400">
                    Ingreso: {child.enrollment_date || child.created_at?.slice(0, 10) || "S/F"}
                  </span>
                  <Link
                    href={`/certificates?type=children&id=${child.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Constancia Asistencia
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-bold text-lg">No se encontraron estudiantes</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {search || statusFilter !== "all" || groupFilter !== "all"
              ? "Prueba cambiando los filtros o el texto de búsqueda."
              : "Comienza matriculando a los niños en los programas de Casita de Tareas."}
          </p>
          {!search && statusFilter === "all" && groupFilter === "all" && (
            <button
              onClick={openCreate}
              className="mt-5 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md inline-flex items-center gap-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" /> Matricular Primer Niño
            </button>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Child */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingChild ? `Editar Estudiante (${editingChild.child_id_code || "Sin Código"})` : "Matricular Nuevo Estudiante"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo & Consecutive Code */}
          <div className="flex flex-col items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
            <PhotoUpload
              currentPhoto={form.photo_url || null}
              onPhotoUploaded={(url) => setForm({ ...form, photo_url: url })}
              onPhotoRemoved={() => setForm({ ...form, photo_url: "" })}
              size="lg"
            />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Código Consecutivo:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-primary text-white text-xs font-bold shadow-xs">
                {editingChild ? editingChild.child_id_code : nextChildCode}
              </span>
            </div>
          </div>

          {/* Section 1: Datos del Niño */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              1. Identificación y Datos del Menor
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombres *"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
                placeholder="Ej: Sofía"
              />
              <Input
                label="Apellidos *"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                placeholder="Ej: Castillo Moreno"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <Select
                label="Tipo Doc."
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                options={[
                  { value: "RC", label: "Registro Civil (RC)" },
                  { value: "TI", label: "Tarjeta de Identidad (TI)" },
                  { value: "NUIP", label: "NUIP" },
                  { value: "CE", label: "Cédula de Extranjería (CE)" },
                  { value: "PAS", label: "Pasaporte (PAS)" },
                ]}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Número de Identificación"
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                  placeholder="Ej: 1032456789"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Fecha de Nacimiento"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => handleDobChange(e.target.value)}
              />
              <Input
                label="Edad en Años"
                type="number"
                min="1"
                max="18"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="Ej: 6"
              />
            </div>
          </div>

          {/* Section 2: Acudiente y Contacto */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              2. Padre, Madre o Acudiente Responsable
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre del Acudiente Principal"
                value={form.guardian_name}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                placeholder="Ej: María Fernanda Moreno"
              />
              <Input
                label="Teléfono / Celular / WhatsApp"
                type="tel"
                value={form.guardian_phone}
                onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                placeholder="Ej: 320 456 7890"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Correo Electrónico del Acudiente (Para Alertas de Inasistencia)"
                  type="email"
                  value={form.guardian_email}
                  onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                  placeholder="Ej: acudiente@correo.com"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Se enviará automáticamente un correo formal al acudiente cuando el estudiante sea marcado ausente.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Matrícula, Jornada y Grupo */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              3. Matrícula Pedagógica y Jornada
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Grupo Pedagógico"
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                options={[
                  { value: "", label: "Seleccionar Grupo..." },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
              <Select
                label="Jornada Escolar"
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
                options={[
                  { value: "manana", label: "Jornada Mañana" },
                  { value: "tarde", label: "Jornada Tarde" },
                  { value: "completa", label: "Jornada Completa" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Input
                label="Fecha de Matrícula / Ingreso *"
                type="date"
                value={form.enrollment_date}
                onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })}
                required
              />
              <Select
                label="Estado de la Matrícula"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                options={[
                  { value: "active", label: "Activo (Matriculado y Asistiendo)" },
                  { value: "inactive", label: "Inactivo (Retirado / Graduado)" },
                ]}
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Observaciones Médicas, Alergias o Pedagógicas
              </label>
              <textarea
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                placeholder="Alergias a alimentos, medicamentos, recomendaciones de aprendizaje, etc."
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
              {editingChild ? "Guardar Cambios" : "Completar Matrícula"}
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
            ¿Está seguro de que desea eliminar la ficha de este estudiante? Esta acción no se puede deshacer y desvinculará sus registros de asistencia histórica.
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
              Eliminar Estudiante
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
