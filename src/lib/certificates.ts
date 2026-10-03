import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { InstitutionProfile, Child, Teacher, Practitioner } from "@/types/database";

// Lazy load jsPDF and jspdf-autotable for optimal bundle performance
async function getPdfLibs() {
  const [jsModule, atModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF: jsModule.default, autoTable: atModule.default };
}

export const DEFAULT_INSTITUTION: InstitutionProfile = {
  institution_name: "Casita de Tareas",
  nit: "900.584.219-4",
  slogan: "La Alegría del Conocimiento, Enseñando con Amor",
  address: "Calle Principal # 12 - 34, Barrio Centro",
  city: "Bogotá D.C., Colombia",
  phone: "(+57) 310 854 9210 / (601) 745 8920",
  email: "direccion@casitadetareas.com",
  legal_representative: "Julia Patricia González Tovar",
  representative_id: "52.345.678",
  representative_role: "Directora General y Representante Legal",
  signature_url: null,
  logo_url: "/logo.png",
};

export async function getInstitutionProfile(): Promise<InstitutionProfile> {
  try {
    const snap = await getDocs(collection(getFirebaseDb(), "system_settings"));
    if (snap.empty) return DEFAULT_INSTITUTION;

    const map: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.setting_key && data.setting_value) {
        map[data.setting_key] = data.setting_value;
      }
    });

    return {
      institution_name: map.institution_name || DEFAULT_INSTITUTION.institution_name,
      nit: map.institution_nit || DEFAULT_INSTITUTION.nit,
      slogan: map.institution_slogan || DEFAULT_INSTITUTION.slogan,
      address: map.institution_address || DEFAULT_INSTITUTION.address,
      city: map.institution_city || DEFAULT_INSTITUTION.city,
      phone: map.institution_phone || DEFAULT_INSTITUTION.phone,
      email: map.institution_email || DEFAULT_INSTITUTION.email,
      legal_representative: map.legal_representative || DEFAULT_INSTITUTION.legal_representative,
      representative_id: map.representative_id || DEFAULT_INSTITUTION.representative_id,
      representative_role: map.representative_role || DEFAULT_INSTITUTION.representative_role,
      signature_url: map.signature_url || null,
      logo_url: map.logo_url || null,
    };
  } catch (err) {
    console.error("Error loading institution profile:", err);
    return DEFAULT_INSTITUTION;
  }
}

function formatDateSpanish(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return `${day} de ${months[month - 1]} de ${year}`;
}

function getFormalDateSentence(city: string): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `Dado en ${city}, a los ${day} días del mes de ${month} de ${year}.`;
}

// -----------------------------------------------------------------------------
// 1. CONSTANCIA DE ASISTENCIA Y PERMANENCIA PARA NIÑOS
// -----------------------------------------------------------------------------
export interface ChildCertParams {
  child: Child;
  groupName: string;
  startDate: string;
  endDate: string;
  totalScheduledDays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  purpose?: string;
  institution?: InstitutionProfile;
}

export async function generateChildAttendanceCertificate(params: ChildCertParams, action: "save" | "blob" = "save") {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header band
  doc.setFillColor(30, 58, 138); // Deep Blue
  doc.rect(margin, 15, contentWidth, 2, "F");

  // Institution title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(30, 58, 138);
  doc.text(inst.institution_name.toUpperCase(), pageWidth / 2, 25, { align: "center" });

  // Slogan & NIT
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (inst.slogan) {
    doc.text(inst.slogan, pageWidth / 2, 30, { align: "center" });
  }
  doc.text(`NIT: ${inst.nit} · ${inst.address} · Tel: ${inst.phone}`, pageWidth / 2, 35, { align: "center" });
  doc.text(inst.email, pageWidth / 2, 39, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, 43, pageWidth - margin, 43);

  // Consecutive code
  const code = `CONST-ASIS-${new Date().getFullYear()}-${params.child.child_id_code || params.child.id.slice(0, 4).toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`CÓDIGO: ${code}`, pageWidth - margin, 49, { align: "right" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("CONSTANCIA DE ASISTENCIA Y PERMANENCIA ESCOLAR", pageWidth / 2, 60, { align: "center" });

  // Preamble
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text("LA DIRECCIÓN DE CASITA DE TAREAS", pageWidth / 2, 72, { align: "center" });
  doc.text("HACE CONSTAR QUE:", pageWidth / 2, 78, { align: "center" });

  // Body text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);

  const fullName = `${params.child.first_name} ${params.child.last_name}`.toUpperCase();
  const docType = params.child.document_type || "Registro Civil / T.I.";
  const docNum = params.child.document || params.child.child_id_code || "S/I";
  const percentage = params.totalScheduledDays > 0
    ? Math.round((params.totalPresentDays / params.totalScheduledDays) * 100)
    : 100;

  const startFormatted = formatDateSpanish(params.startDate);
  const endFormatted = formatDateSpanish(params.endDate);

  const paragraph1 = `El (la) menor ${fullName}, identificado(a) con ${docType} No. ${docNum}, se encuentra debidamente registrado(a) y activo(a) en los programas pedagógicos y formativos de ${inst.institution_name}, perteneciendo al grupo ${params.groupName.toUpperCase()} en la jornada ${params.child.shift.toUpperCase()}.`;

  const paragraph2 = `Durante el período comprendido entre el ${startFormatted} y el ${endFormatted}, ha registrado una asistencia regular y presencial conforme al control digital institucional, cumpliendo un total de ${params.totalPresentDays} días asistidos sobre ${params.totalScheduledDays} días programados (${percentage}% de asistencia efectiva), evidenciando un compromiso responsable y participativo en sus actividades escolares.`;

  const lines1 = doc.splitTextToSize(paragraph1, contentWidth);
  doc.text(lines1, margin, 90);

  const yPos2 = 90 + lines1.length * 6 + 4;
  const lines2 = doc.splitTextToSize(paragraph2, contentWidth);
  doc.text(lines2, margin, yPos2);

  // Table summary
  const tableY = yPos2 + lines2.length * 6 + 6;
  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [["Período Evaluado", "Días Hábiles", "Días Asistidos", "Inasistencias", "Porcentaje"]],
    body: [
      [
        `${params.startDate} a ${params.endDate}`,
        String(params.totalScheduledDays),
        String(params.totalPresentDays),
        String(params.totalAbsentDays),
        `${percentage}%`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "center" },
    bodyStyles: { halign: "center", fontStyle: "bold", textColor: [15, 23, 42] },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || tableY + 25;

  // Purpose statement
  const purposeText = params.purpose && params.purpose.trim()
    ? `La presente constancia se expide con destino a: ${params.purpose.trim()}.`
    : "La presente constancia se expide a solicitud de la parte interesada para los fines escolares y administrativos que estime pertinentes.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const purposeLines = doc.splitTextToSize(purposeText, contentWidth);
  doc.text(purposeLines, margin, finalTableY + 8);

  // Issuance statement
  const issuanceSentence = getFormalDateSentence(inst.city);
  doc.text(issuanceSentence, margin, finalTableY + 18);

  // Signature Block
  const sigY = pageHeight - 55;
  if (inst.signature_url) {
    try {
      doc.addImage(inst.signature_url, "PNG", margin + 10, sigY - 20, 50, 18);
    } catch {
      /* ignore signature image load error */
    }
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + 80, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(inst.legal_representative, margin, sigY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (inst.representative_id) {
    doc.text(`C.C. No. ${inst.representative_id}`, margin, sigY + 10);
  }
  doc.text(inst.representative_role || "Directora / Representante Legal", margin, sigY + 15);
  doc.text(inst.institution_name, margin, sigY + 20);

  // Security note
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento oficial expedido electrónicamente por el Sistema de Gestión Institucional Casita de Tareas. Válido sin tachaduras ni enmendaduras.`,
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  const filename = `Constancia_${params.child.first_name}_${params.child.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (action === "blob") {
    return doc.output("bloburl");
  } else {
    doc.save(filename);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 2. CERTIFICADO DE PRÁCTICAS ACADÉMICAS PARA PRACTICANTES
// -----------------------------------------------------------------------------
export interface PractitionerCertParams {
  practitioner: Practitioner;
  university: string;
  career: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalHours: number;
  dailyHours: number;
  performanceNote?: string;
  institution?: InstitutionProfile;
}

export async function generatePractitionerCertificate(params: PractitionerCertParams, action: "save" | "blob" = "save") {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header band
  doc.setFillColor(5, 150, 105); // Emerald Green
  doc.rect(margin, 15, contentWidth, 2, "F");

  // Institution title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(inst.institution_name.toUpperCase(), pageWidth / 2, 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`NIT: ${inst.nit} · ${inst.address} · Tel: ${inst.phone}`, pageWidth / 2, 31, { align: "center" });
  doc.text(`Convenios Docentes y Prácticas Formativas · ${inst.email}`, pageWidth / 2, 36, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Consecutive code
  const code = `CERT-PRAC-${new Date().getFullYear()}-${params.practitioner.id.slice(0, 4).toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`RADICADO: ${code}`, pageWidth - margin, 47, { align: "right" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text("CERTIFICADO DE PRÁCTICAS ACADÉMICAS Y CUMPLIMIENTO DE HORAS", pageWidth / 2, 58, { align: "center" });

  // Preamble
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(5, 150, 105);
  doc.text("LA DIRECCIÓN DE CASITA DE TAREAS", pageWidth / 2, 70, { align: "center" });
  doc.text("CERTIFICA QUE:", pageWidth / 2, 76, { align: "center" });

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);

  const fullName = `${params.practitioner.first_name} ${params.practitioner.last_name}`.toUpperCase();
  const docNum = params.practitioner.document || "S/I";
  const university = (params.university || params.practitioner.study || "Institución de Educación Superior").toUpperCase();
  const career = (params.career || params.practitioner.role || "Práctica Formativa").toUpperCase();

  const startFormatted = formatDateSpanish(params.startDate);
  const endFormatted = formatDateSpanish(params.endDate);

  const paragraph1 = `El (la) estudiante ${fullName}, identificado(a) con Cédula de Ciudadanía No. ${docNum}, perteneciente al programa académico ${career} de ${university}, desarrolló satisfactoriamente sus prácticas formativas en nuestra institución durante el período comprendido entre el ${startFormatted} y el ${endFormatted}.`;

  const paragraph2 = `Durante dicho período, el(la) practicante registró asistencia regular mediante el sistema de firma digital institucional, acumulando un total de ${params.totalHours} horas certificadas desarrolladas en ${params.totalDays} jornadas de atención directa y acompañamiento pedagógico (${params.dailyHours} horas/día acordadas).`;

  const paragraph3 = params.performanceNote
    ? `Concepto evaluativo: ${params.performanceNote.trim()}`
    : "Durante su permanencia demostró excelentes calidades humanas, vocación docente, puntualidad, ética y alto sentido de responsabilidad en todas las funciones asignadas.";

  const lines1 = doc.splitTextToSize(paragraph1, contentWidth);
  doc.text(lines1, margin, 88);

  const yPos2 = 88 + lines1.length * 6 + 4;
  const lines2 = doc.splitTextToSize(paragraph2, contentWidth);
  doc.text(lines2, margin, yPos2);

  const yPos3 = yPos2 + lines2.length * 6 + 4;
  const lines3 = doc.splitTextToSize(paragraph3, contentWidth);
  doc.text(lines3, margin, yPos3);

  // Table summary
  const tableY = yPos3 + lines3.length * 6 + 6;
  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [["Institución / Universidad", "Programa", "Jornadas Laboradas", "Intensidad Diaria", "Total Horas Certificadas"]],
    body: [
      [
        university,
        career,
        `${params.totalDays} días`,
        `${params.dailyHours} h/día`,
        `${params.totalHours} HORAS`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold", halign: "center" },
    bodyStyles: { halign: "center", fontStyle: "bold", textColor: [15, 23, 42] },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || tableY + 25;

  const issuanceSentence = getFormalDateSentence(inst.city);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(issuanceSentence, margin, finalTableY + 12);

  // Signature Block
  const sigY = pageHeight - 55;
  if (inst.signature_url) {
    try {
      doc.addImage(inst.signature_url, "PNG", margin + 10, sigY - 20, 50, 18);
    } catch {
      /* ignore signature image load error */
    }
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + 80, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(inst.legal_representative, margin, sigY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (inst.representative_id) {
    doc.text(`C.C. No. ${inst.representative_id}`, margin, sigY + 10);
  }
  doc.text(inst.representative_role || "Directora / Representante Legal", margin, sigY + 15);
  doc.text(inst.institution_name, margin, sigY + 20);

  // Security footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Certificado expedido con base en los registros biométricos/digitales de asistencia de Casita de Tareas. Válido para convenios universitarios.`,
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  const filename = `Certificado_Practicas_${params.practitioner.first_name}_${params.practitioner.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (action === "blob") {
    return doc.output("bloburl");
  } else {
    doc.save(filename);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 3. CERTIFICADO LABORAL PARA PROFESORES
// -----------------------------------------------------------------------------
export interface TeacherCertParams {
  teacher: Teacher;
  jobTitle?: string;
  contractType?: string;
  startDate: string;
  endDate?: string | null;
  salary?: string | null;
  purpose?: string;
  institution?: InstitutionProfile;
}

export async function generateTeacherLaborCertificate(params: TeacherCertParams, action: "save" | "blob" = "save") {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header band
  doc.setFillColor(30, 58, 138); // Deep Blue
  doc.rect(margin, 15, contentWidth, 2, "F");

  // Institution title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(inst.institution_name.toUpperCase(), pageWidth / 2, 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`NIT: ${inst.nit} · ${inst.address} · Tel: ${inst.phone}`, pageWidth / 2, 31, { align: "center" });
  doc.text(`Gestión de Talento Humano y Docente · ${inst.email}`, pageWidth / 2, 36, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Consecutive code
  const code = `CERT-LAB-${new Date().getFullYear()}-${params.teacher.id.slice(0, 4).toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`RADICADO: ${code}`, pageWidth - margin, 47, { align: "right" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("CERTIFICADO LABORAL", pageWidth / 2, 58, { align: "center" });

  // Preamble
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text("EL (LA) SUSCRITO(A) REPRESENTANTE LEGAL DE CASITA DE TAREAS", pageWidth / 2, 70, { align: "center" });
  doc.text("HACE CONSTAR QUE:", pageWidth / 2, 76, { align: "center" });

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);

  const fullName = `${params.teacher.first_name} ${params.teacher.last_name}`.toUpperCase();
  const docNum = params.teacher.document || "S/I";
  const jobTitle = (params.jobTitle || params.teacher.job_title || params.teacher.role || "Docente Titular").toUpperCase();
  const contractType = params.contractType || params.teacher.contract_type || "Término Fijo";
  const startFormatted = formatDateSpanish(params.startDate || params.teacher.hire_date);
  const isCurrentlyWorking = !params.endDate;
  const endFormatted = isCurrentlyWorking ? "la fecha actual" : formatDateSpanish(params.endDate!);

  const workStatusPhrase = isCurrentlyWorking
    ? `labora en nuestra institución desde el día ${startFormatted}, encontrándose actualmente con vinculación activa`
    : `laboró en nuestra institución desde el día ${startFormatted} hasta el día ${endFormatted}`;

  const paragraph1 = `El (la) señor(a) ${fullName}, identificado(a) con Cédula de Ciudadanía No. ${docNum}, ${workStatusPhrase}, desempeñando el cargo de ${jobTitle}, mediante contrato de trabajo a ${contractType}.`;

  const paragraph2 = `Durante su desempeño laboral, ha demostrado intachables calidades morales y profesionales, cumplimiento cabal de sus responsabilidades pedagógicas, respeto, puntualidad y compromiso ético institucional.`;

  const lines1 = doc.splitTextToSize(paragraph1, contentWidth);
  doc.text(lines1, margin, 88);

  const yPos2 = 88 + lines1.length * 6 + 5;
  const lines2 = doc.splitTextToSize(paragraph2, contentWidth);
  doc.text(lines2, margin, yPos2);

  // Optional Salary
  let currentY = yPos2 + lines2.length * 6 + 6;
  if (params.salary && params.salary.trim()) {
    const salaryText = `Asignación salarial mensual: ${params.salary.trim()}`;
    doc.setFont("helvetica", "bold");
    doc.text(salaryText, margin, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 8;
  }

  // Table summary
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["Cargo Desempeñado", "Tipo de Vinculación", "Fecha de Inicio", "Fecha de Finalización", "Estado"]],
    body: [
      [
        jobTitle,
        contractType,
        params.startDate || params.teacher.hire_date,
        params.endDate || "Activo",
        isCurrentlyWorking ? "ACTIVO" : "FINALIZADO",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "center" },
    bodyStyles: { halign: "center", fontStyle: "bold", textColor: [15, 23, 42] },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || currentY + 25;

  const purposeText = params.purpose && params.purpose.trim()
    ? `La presente constancia se expide con destino a: ${params.purpose.trim()}.`
    : "La presente certificación se expide a solicitud de la parte interesada para los trámites personales y laborales que estime convenientes.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const purposeLines = doc.splitTextToSize(purposeText, contentWidth);
  doc.text(purposeLines, margin, finalTableY + 8);

  const issuanceSentence = getFormalDateSentence(inst.city);
  doc.text(issuanceSentence, margin, finalTableY + 18);

  // Signature Block
  const sigY = pageHeight - 55;
  if (inst.signature_url) {
    try {
      doc.addImage(inst.signature_url, "PNG", margin + 10, sigY - 20, 50, 18);
    } catch {
      /* ignore signature image load error */
    }
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + 80, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(inst.legal_representative, margin, sigY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (inst.representative_id) {
    doc.text(`C.C. No. ${inst.representative_id}`, margin, sigY + 10);
  }
  doc.text(inst.representative_role || "Directora / Representante Legal", margin, sigY + 15);
  doc.text(inst.institution_name, margin, sigY + 20);

  // Security footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Certificado expedido conforme a la legislación laboral colombiana por Casita de Tareas. Válido para todo trámite laboral y crediticio.`,
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  const filename = `Certificado_Laboral_${params.teacher.first_name}_${params.teacher.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (action === "blob") {
    return doc.output("bloburl");
  } else {
    doc.save(filename);
    return null;
  }
}
