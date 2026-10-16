"use client";

import { useEffect, useState } from "react";
import { getAuditLogs } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ShieldCheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { AuditLog } from "@/types/database";

const actionLabels: Record<string, string> = { create: "Creó", update: "Actualizó", delete: "Eliminó" };
const entityLabels: Record<string, string> = {
  children: "Niño",
  groups: "Grupo",
  teachers: "Profesor",
  practitioners: "Practicante",
  attendance_children: "Asistencia Infantil",
  attendance_staff: "Asistencia Personal",
  profiles: "Usuario",
  correction_requests: "Corrección Personal",
  correction_requests_children: "Corrección Infantil",
};

function getDetailText(log: AuditLog): string {
  const d = log.details as Record<string, unknown> | null;
  if (!d) return "";
  if (log.entity_type === "attendance_staff" && d.signed) {
    const name = d.staff_name || "Personal";
    const type = d.staff_type === "teacher" ? "Profesor" : d.staff_type === "practitioner" ? "Practicante" : "Personal";
    return `${type} ${name} firmó asistencia`;
  }
  if (log.entity_type === "attendance_children") {
    if (d.count) return `${d.count} asistencia(s) registrada(s)`;
    if (d.status) {
      const statusText = d.status === "present" ? "Asistió" : "No asistió";
      return `Marcado individual: ${statusText}${d.date ? ` (${d.date})` : ""}`;
    }
  }
  if (log.entity_type === "profiles" && d.email) {
    return `Usuario: ${d.email} (${d.role === "super_admin" ? "Super Admin" : "Operador"})`;
  }
  if (d.full_name) {
    return `${d.full_name}${d.id_code ? ` (${d.id_code})` : ""}`;
  }
  if (d.name) {
    return String(d.name);
  }
  return "";
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let active = true;
    getAuditLogs()
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch(() => {
        /* permission denied */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = logs.filter((l) => l.user_email.toLowerCase().includes(filter.toLowerCase()) || l.action.toLowerCase().includes(filter.toLowerCase()) || l.entity_type.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <LoadingSpinner label="Cargando auditoria..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ShieldCheckIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Auditoria</h1><p className="text-sm text-gray-500 dark:text-gray-400">Registro de acciones del sistema</p></div>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input type="text" placeholder="Filtrar por usuario, accion o entidad..." aria-label="Filtrar registros de auditoria" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800"><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Fecha/Hora</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Usuario</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Accion</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Entidad</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Detalle</th></tr></thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">{log.user_email}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${log.action === "create" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : log.action === "update" ? "bg-primary/10 text-primary" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>{actionLabels[log.action] || log.action}</span></td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{entityLabels[log.entity_type] || log.entity_type}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 text-[13px]">{getDetailText(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-gray-500 dark:text-gray-400">No hay registros de auditoria.</div>}
      </div>
    </div>
  );
}
