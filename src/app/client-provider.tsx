"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Toaster } from "react-hot-toast";

export function ClientProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#fff",
            color: "#1a2332",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          },
        }}
      />
    </AuthProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const adminRoutes = ["/audit", "/users", "/settings", "/groups", "/corrections", "/attendance/historical"];
  const isRestricted = profile?.role !== "super_admin" && adminRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (pathname === "/login" || !user) {
    return <>{children}</>;
  }

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-[#0c1220] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sin perfil asignado</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tu usuario no tiene un perfil configurado. Contacta al administrador.</p>
          <button onClick={() => { import("firebase/auth").then(({ signOut: fbSignOut }) => { fbSignOut(getFirebaseAuth()).then(() => { window.location.href = "/login"; }); }); }} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">Cerrar sesion</button>
        </div>
      </div>
    );
  }

  if (!loading && isRestricted) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-[#0c1220] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">Acceso restringido</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No tienes permisos para ver esta pagina.</p>
          <a href="/dashboard" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">Volver al Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#0c1220]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 glass border-b border-gray-200 dark:border-gray-800">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegacion" aria-expanded={sidebarOpen} aria-controls="sidebar" className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="hidden sm:block text-base font-bold text-gray-900 dark:text-white tracking-tight">Sistema de Asistencia</h1>
            <div className="flex items-center gap-2">
              <NotificationBell onNavigate={(path) => router.push(path)} />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
