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
import { getTodayDate } from "@/lib/utils";
import {
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type { Child, AttendanceChild } from "@/types/database";

export default function HistoricalAttendancePage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "super_admin";

  const [date, setDate] = useState(getTodayDate());
  const [search, setSearch] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [grouped, setGrouped] = useState<Record<string, AttendanceChild>>({});
  const [loading, setLoading] = useState(true);
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [childrenSnap, attSnap] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
        getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", date))),
      ]);
      setChildren(childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child)).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)));
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
    if (!search.trim()) return children;
    const term = search.toLowerCase();
    return children.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const code = c.child_id_code?.toLowerCase() || "";
      return fullName.includes(term) || code.includes(term);
    });
  }, [children, search]);

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
      toast.success(`${child.first_name} ${child.last_name} - ${status === "present" ? "Asistio" : "No asistio"} (${date})`);
      loadData();
    } catch (err) {
      console.error("Error marking historical attendance:", err);
      toast.error("Error al marcar asistencia");
    } finally {
      setSavingChildId(null);
    }
  }

  if (loading && children.length === 0) return <LoadingSpinner label="Cargando..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-warning flex items-center justify-center shadow-md">
          <CalendarDaysIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia Historica</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro manual de fechas anteriores a los ninos.
          </p>
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
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Buscar nino</label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o codigo..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />
          Fecha seleccionada: <strong className="text-gray-700 dark:text-gray-300 ml-1">{date}</strong> · {filtered.length} ninos
        </p>
      </div>

      {search.trim() && filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">No se encontro: &quot;{search}&quot;</p>
          <p className="text-sm text-gray-400 mb-4">El nino no esta registrado en el sistema.</p>
          <Link
            href="/children"
            className="inline-flex items-center gap-2 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
          >
            <UserPlusIcon className="w-5 h-5" />
            Registrar nuevo nino
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((child) => {
            const existing = grouped[child.id];
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
                        {child.group_id ? ` · ${child.group_id}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {existing ? (
                      <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${existing.status === "present" ? "bg-emerald-500 text-white shadow-md" : "bg-red-500 text-white shadow-md"}`}>
                        {existing.status === "present" ? (
                          <><CheckCircleIcon className="w-4 h-4" />Asistio</>
                        ) : (
                          <><XCircleIcon className="w-4 h-4" />No asistio</>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Sin marcar</span>
                    )}
                    <button
                      onClick={() => handleMark(child, "present")}
                      disabled={savingChildId === child.id}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-500 text-white shadow-md hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Asistio
                    </button>
                    <button
                      onClick={() => handleMark(child, "absent")}
                      disabled={savingChildId === child.id}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-red-500 text-white shadow-md hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      No asistio
                    </button>
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