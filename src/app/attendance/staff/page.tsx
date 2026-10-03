"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getTodayDate, formatTime, isWeekday } from "@/lib/utils";
import { registerStaffAttendance, registerStaffAbsent, autoMarkAbsentStaff, updateStaffAttendance } from "@/lib/attendance";
import { createCorrectionRequest, getMyStaffCorrections } from "@/lib/corrections";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { PencilIcon, CheckCircleIcon, XCircleIcon, ClockIcon, UserGroupIcon, ArrowPathIcon, MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Teacher, Practitioner, AttendanceStaff, CorrectionRequest } from "@/types/database";

interface StaffItem { staff: Teacher | Practitioner; type: "teacher" | "practitioner"; attendance: AttendanceStaff | null; }

export default function StaffAttendancePage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "super_admin";
  const [items, setItems] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date] = useState(getTodayDate());
  const [now, setNow] = useState(new Date());
  const [showSignature, setShowSignature] = useState(false);
  const [signingFor, setSigningFor] = useState<StaffItem | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editItem, setEditItem] = useState<StaffItem | null>(null);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [correctionItem, setCorrectionItem] = useState<StaffItem | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [actionRequested, setActionRequested] = useState<"enable_signature" | "mark_present">("enable_signature");
  const [myCorrections, setMyCorrections] = useState<CorrectionRequest[]>([]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => { loadData(); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  useEffect(() => {
    if (user && !isAdmin) {
      loadMyCorrections();
      const interval = setInterval(loadMyCorrections, 15000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  async function loadMyCorrections() {
    if (!user) return;
    try {
      const data = await getMyStaffCorrections(user.uid);
      const prevPending = myCorrections.filter((c) => c.status === "pending").length;
      const newPending = data.filter((c) => c.status === "pending").length;
      if (prevPending > 0 && newPending < prevPending) {
        const approved = data.find((c) => c.status === "approved");
        if (approved) {
          toast.success(`Solicitud aprobada para ${approved.staff_name}. ${approved.action_resolved === "signature_enabled" ? "Ya puede firmar." : "Marcado como presente."}`);
          loadData();
        }
        const rejected = data.find((c) => c.status === "rejected");
        if (rejected) {
          toast.error(`Solicitud rechazada: ${rejected.admin_note || "Sin motivo"}`);
        }
      }
      setMyCorrections(data);
    } catch (e) {
      console.error("Error loading staff corrections:", e);
    }
  }

  async function loadData() {
    try {
      const today = getTodayDate();
      if (user) {
        const autoMarked = await autoMarkAbsentStaff(user.uid);
        if (autoMarked > 0) {
          toast(`Se marcaron ${autoMarked} miembros del personal como ausentes (pasado las 4:30pm)`, { icon: "\u2139\uFE0F" });
          try {
            await fetch("/api/email/send-auto-mark-notification", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "staff", count: autoMarked }),
            });
          } catch { /* ignore email errors */ }
        }
      }
      const [teachersData, practitionersData, attendanceData, holidaysData] = await Promise.all([
        getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
        getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
        getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", today))),
        getDocs(query(collection(getFirebaseDb(), "holidays"))),
      ]);
      const attList = attendanceData.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));
      setItems([
        ...teachersData.docs.map((d) => ({ staff: { id: d.id, ...d.data() } as Teacher, type: "teacher" as const, attendance: attList.find((a) => a.staff_id === d.id && a.staff_type === "teacher") || null })),
        ...practitionersData.docs.map((d) => ({ staff: { id: d.id, ...d.data() } as Practitioner, type: "practitioner" as const, attendance: attList.find((a) => a.staff_id === d.id && a.staff_type === "practitioner") || null })),
      ]);
      setHolidays(holidaysData.docs.map((d) => d.data().date));
    } catch (err) {
      console.error("Error loading attendance data:", err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al cargar datos: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function markAbsent(item: StaffItem) {
    if (!user) return;
    try {
      await registerStaffAbsent(item.staff.id, item.type, user.uid);
      await logAction("create", "attendance_staff", null, { staff_id: item.staff.id, staff_name: `${item.staff.first_name} ${item.staff.last_name}`, staff_type: item.type, signed: false, status: "absent" });
      toast.success(`${item.staff.first_name} - No asistio`);
      loadData();
    } catch (err) { console.error("Error marking absent:", err); toast.error("Error al marcar"); }
  }

  function startSignature(item: StaffItem) {
    setSigningFor(item);
    setShowSignature(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#1a2332"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; }
      }
    }, 100);
  }

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) { setIsDrawing(true); const ctx = canvasRef.current?.getContext("2d"); if (ctx) { const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); } }
  function draw(e: React.TouchEvent | React.MouseEvent) { if (!isDrawing) return; const ctx = canvasRef.current?.getContext("2d"); if (ctx) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
  function stopDraw() { setIsDrawing(false); }
  function clearCanvas() { const c = canvasRef.current; if (c) { const ctx = c.getContext("2d"); if (ctx) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); } } }

  const saveAttendance = useCallback(async () => {
    if (!signingFor || !user) return;
    const signatureUrl = canvasRef.current?.toDataURL("image/png") || null;
    try {
      await registerStaffAttendance(signingFor.staff.id, signingFor.type, user.uid, signatureUrl);
      await logAction("create", "attendance_staff", null, { staff_id: signingFor.staff.id, staff_name: `${signingFor.staff.first_name} ${signingFor.staff.last_name}`, staff_type: signingFor.type, signed: true });
      toast.success("Asistencia registrada con firma");
      setShowSignature(false);
      setSigningFor(null);
      loadData();
    } catch (err) { console.error("Error saving attendance:", err); toast.error("Error al registrar"); }
  }, [signingFor, user]);

  function openEdit(item: StaffItem) { setEditItem(item); setEditNote(""); }

  async function saveEdit() {
    if (!editItem?.attendance || !editNote.trim() || !user) return;
    setSavingEdit(true);
    try {
      await updateStaffAttendance(editItem.attendance.id, editItem.attendance.check_in, editNote.trim(), user.uid);
      await logAction("update", "attendance_staff", editItem.attendance.id, { staff_name: `${editItem.staff.first_name} ${editItem.staff.last_name}`, staff_type: editItem.type, note: editNote.trim() });
      toast.success("Asistencia corregida");
      setEditItem(null);
      loadData();
    } catch (err) { console.error("Error correcting attendance:", err); toast.error("Error al corregir asistencia"); }
    setSavingEdit(false);
  }

  async function requestCorrection() {
    if (!correctionItem?.attendance || !correctionReason.trim() || !user) return;
    try {
      await createCorrectionRequest(
        correctionItem.attendance.id,
        correctionItem.staff.id,
        correctionItem.type,
        `${correctionItem.staff.first_name} ${correctionItem.staff.last_name}`,
        date,
        correctionReason.trim(),
        actionRequested
      );
      toast.success("Solicitud enviada al administrador");
      setCorrectionItem(null);
      setCorrectionReason("");
      loadMyCorrections();
    } catch (err) { console.error("Error requesting correction:", err); toast.error("Error al enviar solicitud"); }
  }

  const filtered = items
    .filter((i) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const fullName = `${i.staff.first_name} ${i.staff.last_name}`.toLowerCase();
      const type = i.type === "teacher" ? "profesor" : "practicante";
      return fullName.includes(term) || type.includes(term);
    })
    .sort((a, b) => {
      const nameA = `${a.staff.first_name} ${a.staff.last_name}`.toLowerCase();
      const nameB = `${b.staff.first_name} ${b.staff.last_name}`.toLowerCase();
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const totalPresent = items.filter((i) => i.attendance?.check_in).length;
  const totalAbsent = items.filter((i) => i.attendance && !i.attendance.check_in).length;
  const isAfterAutoMark = now.getHours() >= 16 && now.getMinutes() >= 30;
  const unmarked = items.filter((i) => !i.attendance).length;

  const isHoliday = holidays.includes(date);

  if (loading) return <LoadingSpinner label="Cargando..." />;

  if (!isWeekday(date) || isHoliday) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-success flex items-center justify-center shadow-md"><UserGroupIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia de Personal</h1><p className="text-sm text-gray-500 dark:text-gray-400">{date}</p></div>
        </div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <ClockIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">{!isWeekday(date) ? "La atencion es de Lunes a Viernes" : "Hoy es dia festivo"}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hoy no se registra asistencia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-success flex items-center justify-center shadow-md"><UserGroupIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia de Personal</h1><p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><ClockIcon className="w-4 h-4" />{date} - {formatTime(now.toISOString())}</p></div>
      </div>

      <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${isAfterAutoMark ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
        {isAfterAutoMark ? `Cierre del dia · ${totalPresent + totalAbsent} registrados` : `${unmarked} pendientes · Auto-cierre a las 4:30pm`}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-gray-900 dark:text-white">{items.length}</p><p className="text-xs font-medium text-gray-400">Total</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-emerald-500">{totalPresent}</p><p className="text-xs font-medium text-gray-400">Presentes</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-red-500">{totalAbsent}</p><p className="text-xs font-medium text-gray-400">Ausentes</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="text" placeholder="Buscar por nombre o cargo..." aria-label="Buscar personal por nombre" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>
        <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all" aria-label={`Ordenar ${sortOrder === "asc" ? "Z a A" : "A a Z"}`}>
          {sortOrder === "asc" ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
          {sortOrder === "asc" ? "A - Z" : "Z - A"}
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={`${item.type}-${item.staff.id}`} className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm transition-all">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {item.staff.photo_url ? (
                  <img src={item.staff.photo_url} alt={`${item.staff.first_name} ${item.staff.last_name}`} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${item.type === "teacher" ? "gradient-success" : "gradient-warm"}`}>{item.staff.first_name.charAt(0)}{item.staff.last_name.charAt(0)}</div>
                )}
                <div><h3 className="font-bold text-gray-900 dark:text-white text-sm">{item.staff.first_name} {item.staff.last_name}</h3><p className="text-[11px] text-gray-400">{item.type === "teacher" ? "Profesor" : "Practicante"}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {item.attendance ? (
                  <>
                    {!item.attendance.check_in ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white shadow-md text-sm font-bold"><XCircleIcon className="w-4 h-4" />No asistio</div>
                        {!isAdmin && (() => {
                          const pendingCorr = myCorrections.find((c) => c.staff_id === item.staff.id && c.status === "pending" && c.attendance_date === date);
                          if (pendingCorr) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                                <ClockIcon className="w-4 h-4 animate-pulse text-amber-500" />
                                En revision
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => {
                                setCorrectionItem(item);
                                setCorrectionReason("");
                                setActionRequested("enable_signature");
                              }}
                              aria-label="Solicitar correccion"
                              title="Solicitar correccion al administrador"
                              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-all active:scale-95"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </button>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"><CheckCircleIcon className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Presente</span><span className="text-xs text-gray-400">{item.attendance.check_in ? formatTime(item.attendance.check_in) : ""}</span></div>
                    )}
                    {isAdmin && (
                      <button onClick={() => openEdit(item)} aria-label="Corregir asistencia" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => startSignature(item)} className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"><PencilIcon className="w-4 h-4" />Firmar</button>
                    <button onClick={() => markAbsent(item)} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 font-semibold rounded-xl active:scale-95 transition-all"><XCircleIcon className="w-4 h-4" />No asistio</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800"><p className="text-gray-400 font-medium">{search ? "No se encontraron resultados" : "No hay personal registrado"}</p></div>}

      <Modal open={!!correctionItem} onClose={() => setCorrectionItem(null)} title="Solicitar Correccion de Personal" size="md">
        {correctionItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="font-bold text-gray-900 dark:text-white">{correctionItem.staff.first_name} {correctionItem.staff.last_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{correctionItem.type === "teacher" ? "Profesor" : "Practicante"} · Marcado actualmente como No asistio</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Accion solicitada:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActionRequested("enable_signature")}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    actionRequested === "enable_signature"
                      ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 text-gray-900 dark:text-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <p className="font-bold text-sm">Habilitar firma</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Permite que el docente firme en pantalla</p>
                </button>
                <button
                  type="button"
                  onClick={() => setActionRequested("mark_present")}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    actionRequested === "mark_present"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 text-gray-900 dark:text-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <p className="font-bold text-sm">Marcar presente</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Admin aprueba y marca presente de inmediato</p>
                </button>
              </div>
            </div>
            <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo de la solicitud *</label><textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Ej: Marque No asistio por error, el personal si asistio..." rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" /></div>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setCorrectionItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={requestCorrection} disabled={!correctionReason.trim()} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md disabled:opacity-50">Enviar Solicitud</button></div>
          </div>
        )}
      </Modal>

      {showSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Firma digital">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowSignature(false); setSigningFor(null); }} aria-hidden="true" />
          <div className="relative bg-white dark:bg-[#1a2438] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Firma Digital</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Firma con el dedo o con el mouse.</p>
            <div className="rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md mb-4">
              <canvas ref={canvasRef} className="w-full h-48 touch-none cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
            </div>
            <div className="flex justify-between">
              <button onClick={clearCanvas} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Limpiar</button>
              <div className="flex gap-3">
                <button onClick={() => { setShowSignature(false); setSigningFor(null); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={saveAttendance} className="px-5 py-2 rounded-xl text-sm font-semibold gradient-success text-white shadow-md hover:shadow-lg transition-all">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Corregir Asistencia Personal" size="md">
        {editItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="font-bold text-gray-900 dark:text-white">{editItem.staff.first_name} {editItem.staff.last_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{editItem.type === "teacher" ? "Profesor" : "Practicante"}</p>
            </div>
            <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo de la correccion *</label><textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ej: Se registro por error, el personal si asistio..." rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" /></div>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={saveEdit} disabled={!editNote.trim() || savingEdit} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md disabled:opacity-50">{savingEdit ? "Guardando..." : "Corregir"}</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
