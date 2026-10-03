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
    { title: "Ninos registrados", value: stats.totalChildren, icon: UserGroupIcon, gradient: "gradient-primary" },
    { title: "Profesores", value: stats.totalTeachers, icon: AcademicCapIcon, gradient: "gradient-success" },
    { title: "Practicantes", value: stats.totalPractitioners, icon: BriefcaseIcon, gradient: "gradient-warm" },
    { title: "Asistencias mes", value: stats.monthPresent, icon: CheckCircleIcon, gradient: "gradient-success" },
    { title: "Ausencias mes", value: stats.monthAbsent, icon: XCircleIcon, gradient: "gradient-danger" },
  ];

  const totalMonth = stats.monthPresent + stats.monthAbsent;
  const attendanceRate = totalMonth > 0 ? Math.round((stats.monthPresent / totalMonth) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Institucional Casita de Tareas */}
      <div className="gradient-primary rounded-3xl p-6 lg:p-7 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md mb-3 text-white">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>Casita de Tareas • Versión 2.0</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight leading-snug">
            La alegría del conocimiento, enseñando con amor
          </h2>
          <p className="text-white/85 text-xs sm:text-sm mt-1.5 font-normal leading-relaxed">
            Bienvenido al centro de control institucional. Registra asistencias, gestiona fichas de estudiantes, docentes y practicantes, o emite certificados oficiales al instante.
          </p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <Link
              href="/attendance/children"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4 text-primary" />
              Tomar Asistencia Niños
            </Link>
            <Link
              href="/attendance/staff"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all"
            >
              <ClockIcon className="w-4 h-4" />
              Asistencia Personal
            </Link>
            <Link
              href="/certificates"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all"
            >
              <DocumentCheckIcon className="w-4 h-4" />
              Emitir Certificados
            </Link>
          </div>
        </div>

        {/* Decoración gráfica de fondo sutil */}
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-12 top-6 opacity-15 pointer-events-none hidden sm:block">
          <span className="text-8xl select-none" role="img" aria-label="Casita">🏠</span>
        </div>
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
