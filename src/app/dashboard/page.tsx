"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import Link from "next/link";
import { 
  UserGroupIcon, 
  AcademicCapIcon, 
  BriefcaseIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowTrendingUpIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentCheckIcon
} from "@heroicons/react/24/outline";
import { DynamicBarChart } from "@/components/charts/DynamicCharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Stats { totalChildren: number; totalTeachers: number; totalPractitioners: number; monthPresent: number; monthAbsent: number; lastAttendance: string; }
interface MonthlyData { month: string; presentes: number; ausentes: number; }

function getMonthName(m: number) {
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m];
}

function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalChildren: 0, totalTeachers: 0, totalPractitioners: 0, monthPresent: 0, monthAbsent: 0, lastAttendance: "" });
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) return;
    if (user) loadDashboard();
  }, [user, authLoading]);

  async function loadDashboard() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const start = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
    const { end } = getMonthRange();

    const [childrenSnap, teachersSnap, practitionersSnap, attendanceSnap, staffAttendanceSnap] = await Promise.all([
      getDocs(collection(getFirebaseDb(), "children")),
      getDocs(collection(getFirebaseDb(), "teachers")),
      getDocs(collection(getFirebaseDb(), "practitioners")),
      getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", ">=", start), where("attendance_date", "<", end))),
      getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", ">=", start), where("attendance_date", "<", end))),
    ]);

    const allChildren = attendanceSnap.docs.map((d) => d.data() as { attendance_date: string; status: string });
    const allStaff = staffAttendanceSnap.docs.map((d) => d.data() as { attendance_date: string; status: string; check_in: string | null });

    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const childPresent = allChildren.filter((d) => d.attendance_date >= thisMonthStart && d.status === "present").length;
    const childAbsent = allChildren.filter((d) => d.attendance_date >= thisMonthStart && d.status === "absent").length;
    const staffPresent = allStaff.filter((d) => d.attendance_date >= thisMonthStart && d.check_in && d.status !== "absent").length;
    const staffAbsent = allStaff.filter((d) => d.attendance_date >= thisMonthStart && d.status === "absent" && !d.check_in).length;

    const allDates = [...allChildren.map((d) => d.attendance_date), ...allStaff.map((d) => d.attendance_date)].sort().reverse();
    const lastAtt = allDates.length > 0 ? allDates[0] : "";

    setStats({
      totalChildren: childrenSnap.size,
      totalTeachers: teachersSnap.size,
      totalPractitioners: practitionersSnap.size,
      monthPresent: childPresent + staffPresent,
      monthAbsent: childAbsent + staffAbsent,
      lastAttendance: lastAtt,
    });

    const monthlyData: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear(); const month = d.getMonth() + 1;
      const sDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1; const endYear = month === 12 ? year + 1 : year;
      const eDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const childMonth = allChildren.filter((a) => a.attendance_date >= sDate && a.attendance_date < eDate);
      const staffMonth = allStaff.filter((a) => a.attendance_date >= sDate && a.attendance_date < eDate);
      const present = childMonth.filter((a) => a.status === "present").length + staffMonth.filter((a) => a.check_in && a.status !== "absent").length;
      const absent = childMonth.filter((a) => a.status === "absent").length + staffMonth.filter((a) => a.status === "absent" && !a.check_in).length;
      monthlyData.push({ month: getMonthName(d.getMonth()), presentes: present, ausentes: absent });
    }
    setMonthly(monthlyData);
    setLoading(false);
  }

  if (loading || authLoading) return <LoadingSpinner label="Cargando dashboard..." />;

  const statCards = [
    { title: "Niños registrados", value: stats.totalChildren, icon: UserGroupIcon, gradient: "bg-[#1E40AF]" },
    { title: "Profesores", value: stats.totalTeachers, icon: AcademicCapIcon, gradient: "bg-[#2E7D32]" },
    { title: "Practicantes", value: stats.totalPractitioners, icon: BriefcaseIcon, gradient: "bg-[#F59E0B]" },
    { title: "Asistencias mes", value: stats.monthPresent, icon: CheckCircleIcon, gradient: "bg-[#10B981]" },
    { title: "Ausencias mes", value: stats.monthAbsent, icon: XCircleIcon, gradient: "bg-[#E53935]" },
  ];

  const totalMonth = stats.monthPresent + stats.monthAbsent;
  const attendanceRate = totalMonth > 0 ? Math.round((stats.monthPresent / totalMonth) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Institucional Casita de Tareas */}
      <div className="gradient-primary rounded-3xl p-6 lg:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-xl lg:max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#E53935] text-white shadow-sm mb-3.5 border border-white/20">
            <span role="img" aria-label="Amor">❤️</span>
            <span>Enseñando con amor</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            La alegría del conocimiento
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-2 font-medium leading-relaxed">
            Bienvenido al centro integral de control de Casita de Tareas. Registra la asistencia diaria de los niños, gestiona al equipo docente y practicantes, o emite certificados oficiales en 1 clic.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/attendance/children"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-950/20 active:scale-[0.98] transition-all"
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
              Tomar Asistencia Niños
            </Link>
            <Link
              href="/attendance/staff"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all"
            >
              <ClockIcon className="w-4 h-4" />
              Asistencia Personal
            </Link>
            <Link
              href="/certificates"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all"
            >
              <DocumentCheckIcon className="w-4 h-4" />
              Emitir Certificados
            </Link>
          </div>
        </div>

        {/* Logo Institucional destacado en el Hero Banner */}
        <div className="absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 hidden md:block">
          <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl bg-white p-2.5 shadow-2xl border-4 border-white/40 flex items-center justify-center">
            <img src="/logo.png" alt="Casita de Tareas" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Glow decorativo */}
        <div className="absolute -right-8 -bottom-8 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Métricas del Sistema</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Resumen en tiempo real de asistencia y personal activo</p>
        </div>
        {stats.lastAttendance && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Última asistencia registrada: {stats.lastAttendance}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className={`${card.gradient} w-11 h-11 rounded-xl flex items-center justify-center shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{card.value}</p>
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-1">{card.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <ArrowTrendingUpIcon className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Tasa de Asistencia del Mes</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.monthPresent} de {totalMonth} registros (ninos + personal)</p>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full gradient-primary transition-all duration-1000 ease-out" style={{ width: `${attendanceRate}%` }} />
        </div>
        <p className="text-right text-sm font-bold text-primary mt-2">{attendanceRate}%</p>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm animate-fade-in-up">
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Asistencia Mensual (Ultimos 6 meses)</h3>
        <div className="h-72">
          <DynamicBarChart data={monthly} />
        </div>
      </div>
    </div>
  );
}
