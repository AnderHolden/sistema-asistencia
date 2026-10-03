"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  HomeIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  SparklesIcon,
  BookOpenIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === "super_admin";
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Estructura Organizada y Lógica por Áreas
  const sections: NavSection[] = [
    {
      title: "Principal",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
      ],
    },
    {
      title: "Área Niños",
      items: [
        { name: "Asistencia Niños", href: "/attendance/children", icon: ClipboardDocumentCheckIcon },
        { name: "Directorio de Niños", href: "/children", icon: UserGroupIcon },
        { name: "Grupos y Niveles", href: "/groups", icon: BookOpenIcon, adminOnly: true },
      ],
    },
    {
      title: "Talento Humano",
      items: [
        { name: "Asistencia Personal", href: "/attendance/staff", icon: ClockIcon },
        { name: "Profesores", href: "/teachers", icon: AcademicCapIcon },
        { name: "Practicantes", href: "/practitioners", icon: BriefcaseIcon },
      ],
    },
    {
      title: "Documentos y Reportes",
      items: [
        { name: "Certificados y Constancias", href: "/certificates", icon: DocumentCheckIcon },
        { name: "Reportes Consolidados", href: "/reports", icon: ChartBarIcon },
        { name: "Historial de Asistencia", href: "/attendance/historical", icon: CalendarDaysIcon, adminOnly: true },
        { name: "Justificaciones", href: "/corrections", icon: ArrowPathIcon, adminOnly: true },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Administración",
            items: [
              { name: "Usuarios y Roles", href: "/users", icon: ShieldCheckIcon, adminOnly: true },
              { name: "Registro de Auditoría", href: "/audit", icon: DocumentTextIcon, adminOnly: true },
              { name: "Configuración Institucional", href: "/settings", icon: Cog6ToothIcon, adminOnly: true },
            ],
          },
        ]
      : []),
  ];

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
      active
        ? "bg-primary-light text-primary dark:bg-primary/20 dark:text-primary shadow-sm"
        : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
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
        aria-label="Menú de navegación"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[285px] flex-col bg-white dark:bg-[#141c2e] border-r border-gray-200/80 dark:border-gray-800 transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Cabecera Institucional Casita de Tareas */}
        <div className="flex flex-col justify-center px-5 py-4 border-b border-gray-200/80 dark:border-gray-800 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
              {!logoError ? (
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-gray-800 p-1 border border-primary/20 shadow-sm flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="Casita de Tareas"
                    className="w-full h-full object-contain rounded-xl"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-md shrink-0">
                  <span className="text-xl" role="img" aria-label="Casita">🏠</span>
                </div>
              )}
              <div className="min-w-0">
                <span className="block text-base font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-primary transition-colors">
                  Casita de Tareas
                </span>
                <span className="block text-[11px] font-medium text-primary dark:text-primary/90 truncate">
                  La alegría del conocimiento
                </span>
              </div>
            </Link>
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-lg">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 truncate">
              Enseñando con amor
            </span>
          </div>
        </div>

        {/* Lista de Navegación Organizada por Áreas */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5" aria-label="Navegación principal">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.adminOnly && !isAdmin) return null;
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={linkClass(active)}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-primary" : "text-gray-400 dark:text-gray-500"}`} aria-hidden="true" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Perfil del Usuario y Cierre de Sesión */}
        <div className="p-3.5 border-t border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
          <div className="flex items-center gap-2.5 px-2 mb-2.5">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
              {profile?.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">
                {profile?.display_name || "Usuario"}
              </p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">
                {profile?.role === "super_admin" ? "Super Administrador" : "Operador"}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all border border-gray-200/60 dark:border-gray-700/60"
          >
            <ArrowLeftOnRectangleIcon className="w-4 h-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}