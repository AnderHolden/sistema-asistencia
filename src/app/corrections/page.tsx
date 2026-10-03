"use client";

import { useEffect, useState } from "react";
import {
  getPendingCorrections,
  getAllStaffCorrections,
  approveCorrection,
  rejectCorrection,
  getPendingChildCorrections,
  getAllChildCorrections,
  approveChildCorrection,
  rejectChildCorrection,
} from "@/lib/corrections";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserGroupIcon,
  UserIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";
import type { CorrectionRequest, CorrectionRequestChild } from "@/types/database";

export default function CorrectionsPage() {
  const [staffRequests, setStaffRequests] = useState<CorrectionRequest[]>([]);
  const [childRequests, setChildRequests] = useState<CorrectionRequestChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"staff" | "children">("children");
  const [viewFilter, setViewFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [viewFilter]);

  async function loadData() {
    setLoading(true);
    try {
      if (viewFilter === "pending") {
        const [staff, children] = await Promise.all([
          getPendingCorrections(),
          getPendingChildCorrections(),
        ]);
        setStaffRequests(staff);
        setChildRequests(children);
      } else {
        const [staff, children] = await Promise.all([
          getAllStaffCorrections(),
          getAllChildCorrections(),
        ]);
        if (viewFilter === "resolved") {
          setStaffRequests(staff.filter((s) => s.status !== "pending"));
          setChildRequests(children.filter((c) => c.status !== "pending"));
        } else {
          setStaffRequests(staff);
          setChildRequests(children);
        }
      }
    } catch (err) {
      console.error("Error loading corrections:", err);
      toast.error("Error al cargar solicitudes de corrección");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveStaff(
    req: CorrectionRequest,
    action: "enable_signature" | "mark_present" = "enable_signature"
  ) {
    setProcessingId(req.id);
    try {
      await approveCorrection(req.id, req.attendance_id, action);
      const actionText = action === "enable_signature" ? "Firma habilitada" : "Marcado presente";
      toast.success(`Solicitud aprobada - ${req.staff_name} (${actionText})`);

      // Notify operator via email if configured
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.staff_name,
            childCode: req.staff_type === "teacher" ? "PROF" : "PRAC",
            date: req.attendance_date,
            approved: true,
            adminNote: action === "enable_signature" ? "Se habilitó la firma digital" : "Marcado como presente",
          }),
        });
      } catch {
        /* ignore email notification failure */
      }

      loadData();
    } catch (err) {
      console.error("Error approving staff correction:", err);
      toast.error("Error al aprobar corrección de personal");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectStaff(req: CorrectionRequest) {
    setProcessingId(req.id);
    try {
      await rejectCorrection(req.id, rejectNote.trim() || undefined);
      toast.success(`Solicitud rechazada - ${req.staff_name}`);

      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.staff_name,
            childCode: req.staff_type === "teacher" ? "PROF" : "PRAC",
            date: req.attendance_date,
            approved: false,
            adminNote: rejectNote.trim(),
          }),
        });
      } catch {
        /* ignore email errors */
      }

      setRejectingId(null);
      setRejectNote("");
      loadData();
    } catch (err) {
      console.error("Error rejecting staff correction:", err);
      toast.error("Error al rechazar corrección");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveChild(
    req: CorrectionRequestChild,
    action: "update_status" | "clear_record" = "update_status"
  ) {
    setProcessingId(req.id);
    const targetStatus = req.new_status || (req.old_status === "present" ? "absent" : "present");
    try {
      await approveChildCorrection(req.id, req.attendance_id, targetStatus, action);
      if (action === "update_status") {
        toast.success(`Solicitud aprobada: ${req.child_name} ahora figura como ${targetStatus === "present" ? "Asistió" : "No asistió"}.`);
      } else {
        toast.success(`Solicitud aprobada: Registro reiniciado para ${req.child_name}.`);
      }

      // Notify operator via email
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.child_name,
            childCode: req.child_id_code || "S/I",
            date: req.attendance_date,
            approved: true,
            adminNote: action === "update_status"
              ? `Estado corregido a ${targetStatus === "present" ? "Asistió" : "No asistió"}`
              : "Registro reiniciado para volver a marcar",
          }),
        });
      } catch {
        /* ignore email errors */
      }

      loadData();
    } catch (err) {
      console.error("Error approving child correction:", err);
      toast.error("Error al aprobar corrección de niño");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectChild(req: CorrectionRequestChild) {
    setProcessingId(req.id);
    try {
      await rejectChildCorrection(req.id, rejectNote.trim() || undefined);
      toast.success(`Solicitud rechazada - ${req.child_name}`);

      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.child_name,
            childCode: req.child_id_code || "S/I",
            date: req.attendance_date,
            approved: false,
            adminNote: rejectNote.trim(),
          }),
        });
      } catch {
        /* ignore email errors */
      }

      setRejectingId(null);
      setRejectNote("");
      loadData();
    } catch (err) {
      console.error("Error rejecting child correction:", err);
      toast.error("Error al rechazar corrección");
    } finally {
      setProcessingId(null);
    }
  }

  const currentRequestsCount = activeTab === "children" ? childRequests.length : staffRequests.length;
  const pendingCountTotal = childRequests.filter((c) => c.status === "pending").length + staffRequests.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md">
            <ArrowPathIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Solicitudes de Corrección
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión y aprobación directa de modificaciones de asistencia
            </p>
          </div>
        </div>

        {/* View filters: Pendientes / Resueltas / Todas */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <button
            onClick={() => setViewFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === "pending"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setViewFilter("resolved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === "resolved"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Historial
          </button>
          <button
            onClick={() => setViewFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === "all"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Todas
          </button>
        </div>
      </div>

      {/* Tabs: Niños vs Personal */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("children")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "children"
              ? "gradient-primary text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <UserGroupIcon className="w-4 h-4" />
          Niños ({childRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "staff"
              ? "gradient-primary text-white shadow-md"
              : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Personal ({staffRequests.length})
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Cargando solicitudes..." />
      ) : (
        <>
          {/* TAB: NIÑOS */}
          {activeTab === "children" && (
            childRequests.length > 0 ? (
              <div className="space-y-4">
                {childRequests.map((req) => {
                  const targetStatus = req.new_status || (req.old_status === "present" ? "absent" : "present");
                  const isPending = req.status === "pending";

                  return (
                    <div
                      key={req.id}
                      className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex-1 min-w-[260px]">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary">
                              {req.child_id_code}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">Fecha: {req.attendance_date}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : req.status === "rejected"
                                  ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {req.status === "approved" ? "Aprobada" : req.status === "rejected" ? "Rechazada" : "Pendiente"}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {req.child_name}
                          </h3>

                          {/* Cambio solicitado */}
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Estado anterior:</span>
                            <span className={`font-bold px-2 py-0.5 rounded ${req.old_status === "present" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>
                              {req.old_status === "present" ? "Asistió" : "No asistió"}
                            </span>
                            <span className="text-gray-400">➔</span>
                            <span className="text-gray-500 dark:text-gray-400">Cambiar a:</span>
                            <span className={`font-bold px-2 py-0.5 rounded ${targetStatus === "present" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                              {targetStatus === "present" ? "Asistió" : "No asistió"}
                            </span>
                          </div>

                          {/* Motivo */}
                          <div className="bg-gray-50 dark:bg-[#0c1220] p-3 rounded-xl mt-3 border border-gray-100 dark:border-gray-800">
                            <p className="text-xs text-gray-400 font-semibold mb-0.5">Motivo reportado:</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{req.reason}</p>
                          </div>

                          {/* Info de resolución si ya se resolvió */}
                          {req.admin_note && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mt-2 border border-blue-100 dark:border-blue-800">
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Nota de resolución:</p>
                              <p className="text-sm text-blue-900 dark:text-blue-200">{req.admin_note}</p>
                            </div>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            Solicitado por: <span className="font-medium text-gray-600 dark:text-gray-300">{req.requested_by_email}</span> · {formatDateTime(req.created_at)}
                            {req.resolved_at && (
                              <span> · Resuelto el {formatDateTime(req.resolved_at)}</span>
                            )}
                          </p>
                        </div>

                        {/* Botones de acción (solo si está pendiente) */}
                        {isPending && (
                          <div className="flex flex-col sm:flex-row gap-2 self-start">
                            {/* Acción 1: Aprobar directamente modificando el estado */}
                            <button
                              onClick={() => handleApproveChild(req, "update_status")}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                              title={`Cambia el estado a ${targetStatus === "present" ? "Asistió" : "No asistió"} de inmediato`}
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                              Aprobar y Cambiar a {targetStatus === "present" ? "Asistió" : "No asistió"}
                            </button>

                            {/* Acción 2: Aprobar reiniciando para volver a marcar */}
                            <button
                              onClick={() => handleApproveChild(req, "clear_record")}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                              title="Borra la marca para que el operador vuelva a marcar desde cero"
                            >
                              <ArrowPathIcon className="w-3.5 h-3.5" />
                              Reiniciar registro
                            </button>

                            {/* Acción 3: Rechazar */}
                            <button
                              onClick={() => {
                                setRejectingId(req.id);
                                setRejectNote("");
                              }}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Rechazar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Modal/Formulario de rechazo */}
                      {rejectingId === req.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                          <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                            Motivo del rechazo para {req.child_name} *
                          </label>
                          <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Explica por qué se rechaza la solicitud..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => {
                                setRejectingId(null);
                                setRejectNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleRejectChild(req)}
                              disabled={!rejectNote.trim() || processingId === req.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white disabled:opacity-50"
                            >
                              Confirmar Rechazo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {viewFilter === "pending"
                    ? "No hay solicitudes de niños pendientes"
                    : "No hay solicitudes de niños en este filtro"}
                </p>
              </div>
            )
          )}

          {/* TAB: PERSONAL */}
          {activeTab === "staff" && (
            staffRequests.length > 0 ? (
              <div className="space-y-4">
                {staffRequests.map((req) => {
                  const isPending = req.status === "pending";

                  return (
                    <div
                      key={req.id}
                      className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex-1 min-w-[260px]">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                req.staff_type === "teacher"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                              }`}
                            >
                              {req.staff_type === "teacher" ? "Profesor" : "Practicante"}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">Fecha: {req.attendance_date}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : req.status === "rejected"
                                  ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {req.status === "approved" ? "Aprobada" : req.status === "rejected" ? "Rechazada" : "Pendiente"}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {req.staff_name}
                          </h3>

                          {/* Motivo */}
                          <div className="bg-gray-50 dark:bg-[#0c1220] p-3 rounded-xl mt-3 border border-gray-100 dark:border-gray-800">
                            <p className="text-xs text-gray-400 font-semibold mb-0.5">Motivo reportado:</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{req.reason}</p>
                          </div>

                          {req.admin_note && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mt-2 border border-blue-100 dark:border-blue-800">
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Nota de resolución:</p>
                              <p className="text-sm text-blue-900 dark:text-blue-200">{req.admin_note}</p>
                            </div>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            Solicitado por: <span className="font-medium text-gray-600 dark:text-gray-300">{req.requested_by_email}</span> · {formatDateTime(req.created_at)}
                            {req.resolved_at && (
                              <span> · Resuelto el {formatDateTime(req.resolved_at)}</span>
                            )}
                          </p>
                        </div>

                        {/* Botones de acción para personal */}
                        {isPending && (
                          <div className="flex flex-col sm:flex-row gap-2 self-start">
                            {/* Opción 1: Habilitar firma digital */}
                            <button
                              onClick={() => handleApproveStaff(req, "enable_signature")}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                              title="Limpia el registro para permitir que el personal firme en pantalla"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                              Aprobar y Habilitar Firma
                            </button>

                            {/* Opción 2: Marcar presente directamente */}
                            <button
                              onClick={() => handleApproveStaff(req, "mark_present")}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                              title="Marca la asistencia de inmediato como presente sin firma digital"
                            >
                              <CheckBadgeIcon className="w-4 h-4" />
                              Marcar Presente Directo
                            </button>

                            {/* Opción 3: Rechazar */}
                            <button
                              onClick={() => {
                                setRejectingId(req.id);
                                setRejectNote("");
                              }}
                              disabled={processingId === req.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Rechazar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Modal/Formulario de rechazo */}
                      {rejectingId === req.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                          <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                            Motivo del rechazo para {req.staff_name} *
                          </label>
                          <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Explica por qué se rechaza la solicitud..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => {
                                setRejectingId(null);
                                setRejectNote("");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleRejectStaff(req)}
                              disabled={!rejectNote.trim() || processingId === req.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white disabled:opacity-50"
                            >
                              Confirmar Rechazo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                <UserIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {viewFilter === "pending"
                    ? "No hay solicitudes de personal pendientes"
                    : "No hay solicitudes de personal en este filtro"}
                </p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
