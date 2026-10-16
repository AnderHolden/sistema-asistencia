"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { registerHistoricalAttendance } from "@/lib/attendance";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import { getTodayDate, isWeekday } from "@/lib/utils";
import {
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
  ClockIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { Child, Group, AttendanceChild } from "@/types/database";

export default function HistoricalAttendancePage() {
  const { user } = useAuth();

  const [date, setDate] = useState(getTodayDate());
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [grouped, setGrouped] = useState<Record<string, AttendanceChild>>({});
  const [loading, setLoading] = useState(true);
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [childrenSnap, groupsSnap, attSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
        getDocs(collection(getFirebaseDb(), "groups")),
        getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", date))),
      ]);
      setChildren(
        childrenSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Child))
          .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
      );
      setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
      const map: Record<string, AttendanceChild> = {};
      attSnap.docs.forEach((d) => {
        const data = d.data();
        map[data.child_id] = { id: d.id, ...data } as AttendanceChild;
      });
      setGrouped(map);
    } catch (err) {
      console.error("Error loading children:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [date, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return children
      .filter((c) => selectedGroup === "all" || c.group_id === selectedGroup)
      .filter((c) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        const code = c.child_id_code?.toLowerCase() || "";
        return fullName.includes(term) || code.includes(term);
      });
  }, [children, selectedGroup, search]);

  async function handleMark(child: Child, status: "present" | "absent") {
    if (!user) return;
    setSavingChildId(child.id);
    try {
      await registerHistoricalAttendance(child.id, status, user.uid, date);
      await logAction("create", "attendance_children", null, {
        child_name: `${child.first_name} ${child.last_name}`,
        attendance_date: date,
        status,
        historical: true,
      });
      toast.success(`${child.first_name} ${child.last_name} - ${status === "present" ? "Asistió" : "No asistió"} (${date})`);
      loadData();
    } catch (err) {
      console.error("Error marking historical attendance:", err);
      toast.error("Error al marcar asistencia");
    } finally {
      setSavingChildId(null);
    }
  }

  async function handleMarkAllAbsent() {
    if (!user) return;
    const unmarked = children.filter((c) => !grouped[c.id]);
    if (unmarked.length === 0) {
      toast("No hay niños sin marcar en esta fecha");
      return;
    }
    if (!confirm(`¿Marcar a los ${unmarked.length} niños pendientes como "No asistió" en la fecha ${date}?`)) return;
    setBulkSaving(true);
    try {
      let count = 0;
      for (const child of unmarked) {
        await registerHistoricalAttendance(child.id, "absent", user.uid, date);
        count++;
      }
      await logAction("update", "attendance_children", null, {
        attendance_date: date,
        action: "mark_all_absent",
        count,
      });
      toast.success(`${count} niños marcados como No asistió (${date})`);
      loadData();
    } catch (err) {
      console.error("Error marking all absent:", err);
      toast.error("Error al marcar todos como ausentes");
    } finally {
      setBulkSaving(false);
    }
  }

  const unmarkedCount = useMemo(() => children.filter((c) => !grouped[c.id]).length, [children, grouped]);
  const presentCount = useMemo(() => children.filter((c) => grouped[c.id]?.status === "present").length, [children, grouped]);
  const absentCount = useMemo(() => children.filter((c) => grouped[c.id]?.status === "absent").length, [children, grouped]);

  if (loading && children.length === 0) return <LoadingSpinner label="Cargando..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-warning flex items-center justify-center shadow-md">
          <CalendarDaysIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia Histórica</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro y ajuste manual de fechas anteriores para los niños.
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen de la fecha seleccionada */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{children.length}</p>
          <p className="text-xs font-medium text-gray-400">Total Niños</p>
        </div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
          <p className="text-2xl font-bold text-amber-500">{unmarkedCount}</p>
          <p className="text-xs font-medium text-gray-400">Sin marcar</p>
        </div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
          <p className="text-2xl font-bold text-emerald-500">{presentCount}</p>
          <p className="text-xs font-medium text-gray-400">Presentes</p>
        </div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
          <p className="text-2xl font-bold text-red-500">{absentCount}</p>
          <p className="text-xs font-medium text-gray-400">Ausentes</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              max={getTodayDate()}
              onChange={(e) => {
                setLoading(true);
                setDate(e.target.value);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              aria-label="Filtrar por grupo"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            >
              <option value="all">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Buscar niño</label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
          <button
            onClick={handleMarkAllAbsent}
            disabled={bulkSaving || unmarkedCount === 0}
            className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-xl shadow-md hover:bg-red-600 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
          >
            {bulkSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Marcando...</>
            ) : (
              <><UserGroupIcon className="w-4 h-4" /> Cerrar {unmarkedCount} pendientes como No asistió</>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />
          Fecha seleccionada: <strong className="text-gray-700 dark:text-gray-300 ml-1">{date}</strong> · {filtered.length} niños mostrados
          {!isWeekday(date) && <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-semibold">Fin de semana</span>}
        </p>
      </div>

      {search.trim() && filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">No se encontró: &quot;{search}&quot;</p>
          <p className="text-sm text-gray-400 mb-4">El niño no está registrado en el sistema o no pertenece al grupo filtrado.</p>
          <Link
            href="/children"
            className="inline-flex items-center gap-2 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
          >
            <UserPlusIcon className="w-5 h-5" />
            Registrar nuevo niño
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((child) => {
            const existing = grouped[child.id];
            const groupName = groups.find((g) => g.id === child.group_id)?.name;
            return (
              <div
                key={child.id}
                className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm transition-all"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {child.photo_url ? (
                      <img src={child.photo_url} alt={`${child.first_name} ${child.last_name}`} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold">
                        {child.first_name.charAt(0)}
                        {child.last_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{child.first_name} {child.last_name}</h3>
                        {child.child_id_code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{child.child_id_code}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {child.shift}
                        {groupName ? ` · ${groupName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {existing ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm border ${
                          existing.status === "present"
                            ? "bg-amber-400 text-amber-950 border-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400"
                            : "border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                        }`}
                      >
                        {existing.status === "present" ? (
                          <><CheckCircleIcon className="w-4 h-4" />Asistió · Registrado</>
                        ) : (
                          <><XCircleIcon className="w-4 h-4" />Estado: No asistió</>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                        Sin marcar
                      </span>
                    )}
                    {existing?.status !== "present" && (
                      <button
                        onClick={() => handleMark(child, "present")}
                        disabled={savingChildId === child.id}
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-500 text-white shadow-md hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Marcar Asistió
                      </button>
                    )}
                    {existing?.status === "present" && (
                      <button
                        onClick={() => handleMark(child, "absent")}
                        disabled={savingChildId === child.id}
                        className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Cambiar a No asistió
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}