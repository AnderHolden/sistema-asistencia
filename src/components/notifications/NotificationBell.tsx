"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPendingCorrections,
  getPendingChildCorrections,
  getMyChildCorrections,
  getMyStaffCorrections,
} from "@/lib/corrections";
import { BellIcon } from "@heroicons/react/24/outline";
import { formatDateTime, cn } from "@/lib/utils";

interface NotificationBellProps {
  onNavigate?: (path: string) => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "super_admin";
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; detail: string; time: string; type: "staff" | "child"; status: string }>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      if (isAdmin) {
        const [staffPending, childPending] = await Promise.all([
          getPendingCorrections(),
          getPendingChildCorrections(),
        ]);
        const notifs = [
          ...staffPending.map((r) => ({
            id: r.id,
            title: `Solicitud personal: ${r.staff_name}`,
            detail: r.reason,
            time: r.created_at,
            type: "staff" as const,
            status: "pending",
          })),
          ...childPending.map((r) => ({
            id: r.id,
            title: `Solicitud niño: ${r.child_name} (${r.child_id_code})`,
            detail: r.reason,
            time: r.created_at,
            type: "child" as const,
            status: "pending",
          })),
        ];
        notifs.sort((a, b) => b.time.localeCompare(a.time));
        setNotifications(notifs);
        setCount(staffPending.length + childPending.length);
      } else {
        const [myChildRequests, myStaffRequests] = await Promise.all([
          getMyChildCorrections(user.uid),
          getMyStaffCorrections(user.uid),
        ]);
        const resolvedChildren = myChildRequests
          .filter((r) => r.status === "approved" || r.status === "rejected")
          .map((r) => ({
            id: r.id,
            title: r.status === "approved" ? `Aprobada: ${r.child_name}` : `Rechazada: ${r.child_name}`,
            detail:
              r.admin_note ||
              (r.status === "approved"
                ? "Corrección aplicada al registro de asistencia."
                : "Solicitud rechazada"),
            time: r.resolved_at || r.created_at,
            type: "child" as const,
            status: r.status,
          }));
        const resolvedStaff = myStaffRequests
          .filter((r) => r.status === "approved" || r.status === "rejected")
          .map((r) => ({
            id: r.id,
            title: r.status === "approved" ? `Aprobada: ${r.staff_name}` : `Rechazada: ${r.staff_name}`,
            detail:
              r.admin_note ||
              (r.status === "approved"
                ? "Corrección de personal aplicada."
                : "Solicitud rechazada"),
            time: r.resolved_at || r.created_at,
            type: "staff" as const,
            status: r.status,
          }));
        const notifs = [...resolvedChildren, ...resolvedStaff];
        notifs.sort((a, b) => b.time.localeCompare(a.time));
        setNotifications(notifs.slice(0, 10));
        setCount(notifs.length);
      }
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Notificaciones${count > 0 ? `, ${count} pendientes` : ""}`}
      >
        <BellIcon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-[#1a2438] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {isAdmin ? "Solicitudes Pendientes" : "Mis Solicitudes"}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">{isAdmin ? "No hay solicitudes pendientes" : "No hay notificaciones"}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (onNavigate) {
                      onNavigate(isAdmin ? "/corrections" : n.type === "staff" ? "/attendance/staff" : "/attendance/children");
                    }
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                      n.status === "pending" ? "bg-amber-500" : n.status === "approved" ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.detail}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{formatDateTime(n.time)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigate) onNavigate(isAdmin ? "/corrections" : "/attendance/children");
                }}
                className="w-full text-center text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Ver todo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
