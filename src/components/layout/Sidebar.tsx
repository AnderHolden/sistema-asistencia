"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  HomeIcon,
  UserGroupIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { name: "Asistencia Niños", href: "/attendance/children", icon: ClipboardDocumentListIcon },
  { name: "Asistencia Personal", href: "/attendance/staff", icon: ClipboardDocumentListIcon },
  { name: "Niños", href: "/children", icon: UserGroupIcon },
  { name: "Profesores", href: "/teachers", icon: UserIcon },
  { name: "Practicantes", href: "/practitioners", icon: UserIcon },
  { name: "Certificados", href: "/certificates", icon: DocumentTextIcon },
  { name: "Reportes", href: "/reports", icon: ChartBarIcon },
];

const adminOnlyNav = [
  { name: "Grupos", href: "/groups", icon: UserGroupIcon },
];

const adminNav = [
  { name: "Solicitudes", href: "/corrections", icon: ArrowPathIcon },
  { name: "Auditoria", href: "/audit", icon: DocumentTextIcon },
  { name: "Usuarios", href: "/users", icon: ShieldCheckIcon },
  { name: "Configuracion", href: "/settings", icon: Cog6ToothIcon },
];

const historicalNav = [
  { name: "Asistencia Historica", href: "/attendance/historical", icon: CalendarDaysIcon },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === "super_admin";

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
      active
        ? "bg-primary-light text-primary dark:bg-primary/20 dark:text-primary"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-all duration-300 lg:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="sidebar"
        aria-label="Menu de navegacion"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col bg-white dark:bg-[#141c2e] border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[72px] items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Asistencia</span>
              <span className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 -mt-0.5">Institucion Infantil</span>
            </div>
          </Link>
          <button onClick={onClose} aria-label="Cerrar menu" className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1" aria-label="Navegacion principal">
          <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Principal</div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href} onClick={onClose} className={linkClass(isActive(item.href))}>
                <Icon className="w-5 h-5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              {adminOnlyNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.name} href={item.href} onClick={onClose} className={linkClass(isActive(item.href))}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="mt-6 mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Administracion</div>
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.name} href={item.href} onClick={onClose} className={linkClass(isActive(item.href))}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="mt-6 mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Historial</div>
              {historicalNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.name} href={item.href} onClick={onClose} className={linkClass(isActive(item.href))}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 px-3 mb-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {profile?.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{profile?.display_name || "Usuario"}</p>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate">{profile?.role === "super_admin" ? "Super Administrador" : "Operador"}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all">
            <ArrowLeftOnRectangleIcon className="w-5 h-5" aria-hidden="true" />
            Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}