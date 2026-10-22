import { collection, getDocs } from "firebase/firestore";
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

let cachedLogoBase64: string | null = null;

/**
 * Carga el logo oficial en base64 de manera asíncrona para incrustarlo en los documentos PDF.
 */
async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  if (typeof window === "undefined") return null;
  try {
    // Intentar con el logo optimizado para documentos o el logo estándar
    let res = await fetch("/logo-doc.png");
    if (!res.ok) res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
      logo_url: map.logo_url || "/logo.png",
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
  return `Para constancia de lo anterior, se expide el presente documento en ${city}, a los ${day} días del mes de ${month} de ${year}.`;
}

type JsPDFDoc = InstanceType<typeof import("jspdf").default> & {
  lastAutoTable?: { finalY?: number };
};

function sanitizePdfText(text: string): string {
  return (text || "")
    .replace(/[\u2022\u2023\u25E6]/g, "·")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapTextWithinWidth(doc: JsPDFDoc, text: string, maxWidth: number): string[] {
  const safeText = sanitizePdfText(text);
  if (!safeText) return [];
  return doc.splitTextToSize(safeText, maxWidth - 2) as string[];
}

// -----------------------------------------------------------------------------
// DIBUJADO DE MEMBRETE OFICIAL (LOGO + COLORES DE MARCA + DATOS INSTITUCIONALES)
// -----------------------------------------------------------------------------
function drawOfficialHeader(
  doc: JsPDFDoc,
  inst: InstitutionProfile,
  logoBase64: string | null,
  code: string,
  title: string,
  preambleSubtitle: string = "HACE CONSTAR QUE:"
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // 1. Banda Superior Decorativa con los 4 Colores Institucionales
  doc.setFillColor(30, 64, 175);
  doc.rect(margin, 8, contentWidth, 3, "F");

  const third = contentWidth / 3;
  doc.setFillColor(229, 57, 53);
  doc.rect(margin, 11, third, 1, "F");
  doc.setFillColor(245, 158, 11);
  doc.rect(margin + third, 11, third, 1, "F");
  doc.setFillColor(46, 125, 50);
  doc.rect(margin + third * 2, 11, third, 1, "F");

  // 2. Logo Oficial de Casita de Tareas
  const logoSize = 25;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 15, logoSize, logoSize);
    } catch {
      drawFallbackLogo(doc, margin, 15, logoSize);
    }
  } else {
    drawFallbackLogo(doc, margin, 15, logoSize);
  }

  // 3. Texto del Membrete Oficial
  const textX = margin + logoSize + 4;
  const maxHeaderWidth = pageWidth - margin - textX;

  // Nombre de la Institución (ajuste dinámico para nombres largos)
  const upperName = sanitizePdfText(inst.institution_name || "Casita de Tareas").toUpperCase();
  let headerFontSize = 13.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headerFontSize);
  while (doc.getTextWidth(upperName) > maxHeaderWidth && headerFontSize > 8.5) {
    headerFontSize -= 0.5;
    doc.setFontSize(headerFontSize);
  }
  doc.setTextColor(30, 64, 175);
  doc.text(upperName, textX, 21.5);

  // Lema Oficial
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(229, 57, 53);
  const sloganText = inst.slogan || "La Alegría del Conocimiento • Enseñando con Amor";
  const sloganLines = wrapTextWithinWidth(doc, sloganText, maxHeaderWidth);
  doc.text(sloganLines[0] || sloganText, textX, 26.5);

  // Datos Institucionales (NIT, Ubicación, Teléfono)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  const nitCityLine = wrapTextWithinWidth(doc, `NIT: ${inst.nit}  •  ${inst.city}`, maxHeaderWidth);
  doc.text(nitCityLine[0] || "", textX, 31.5);

  const addressPhoneLine = wrapTextWithinWidth(doc, `Sede: ${inst.address}  •  Tel: ${inst.phone}`, maxHeaderWidth);
  doc.text(addressPhoneLine[0] || "", textX, 35.5);

  // Correo de contacto oficial
  doc.setTextColor(2, 132, 199);
  const emailLine = wrapTextWithinWidth(doc, `Correo Oficial: ${inst.email}`, maxHeaderWidth);
  doc.text(emailLine[0] || "", textX, 39.5);

  // Línea separadora suave del membrete
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 44, pageWidth - margin, 44);

  // 4. Bloque de Radicado y Control Institucional
  const badgeWidth = 64;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(badgeX, 47, badgeWidth, 10.5, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(30, 64, 175);
  doc.text("RADICADO OFICIAL No.:", badgeX + 3, 51.3);
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(code, badgeX + 3, 55.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("SISTEMA DE GESTIÓN Y CONTROL INSTITUCIONAL", margin, 51.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Certificación Oficial con Validez Legal y Académica", margin, 55.3);

  // 5. Título Principal del Documento (Recuadro elegante en azul institucional)
  const titleY = 62;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, titleY, contentWidth, 11, 2, 2, "FD");

  let titleFontSize = 10.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontSize);
  while (doc.getTextWidth(title) > contentWidth - 8 && titleFontSize > 8) {
    titleFontSize -= 0.5;
    doc.setFontSize(titleFontSize);
  }
  doc.setTextColor(30, 64, 175);
  doc.text(title, pageWidth / 2, titleY + 7.2, { align: "center" });

  // 6. Preámbulo Institucional Unificado
  const preamY = 81;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(30, 64, 175);
  doc.text("LA DIRECCIÓN GENERAL Y REPRESENTACIÓN LEGAL", pageWidth / 2, preamY, { align: "center" });
  doc.setFontSize(9.2);
  doc.setTextColor(229, 57, 53);
  doc.text(preambleSubtitle, pageWidth / 2, preamY + 5.2, { align: "center" });

  return 93;
}

function drawFallbackLogo(doc: JsPDFDoc, x: number, y: number, size: number) {
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(x, y, size, size, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("CASITA", x + size / 2, y + size / 2 - 1, { align: "center" });
  doc.text("TAREAS", x + size / 2, y + size / 2 + 4, { align: "center" });
}

// -----------------------------------------------------------------------------
// DIBUJADO DE PIE DE PÁGINA OFICIAL (FIRMA + SELLO DIGITAL + AVISO LEGAL)
// -----------------------------------------------------------------------------
function drawOfficialFooter(doc: JsPDFDoc, inst: InstitutionProfile, code: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const sigY = pageHeight - 54;
  const leftBlockMaxWidth = 88;

  // Firma Digital de la Representante Legal
  if (inst.signature_url) {
    try {
      doc.addImage(inst.signature_url, "PNG", margin + 5, sigY - 20, 45, 18);
    } catch {
      /* ignore signature load error */
    }
  }

  // Línea de firma elegante
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + 78, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const repLines = wrapTextWithinWidth(doc, inst.legal_representative, leftBlockMaxWidth);
  doc.text(repLines[0] || inst.legal_representative, margin, sigY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  if (inst.representative_id) {
    doc.text(`C.C. No. ${inst.representative_id}`, margin, sigY + 9.3);
  }
  const roleLines = wrapTextWithinWidth(
    doc,
    inst.representative_role || "Directora General y Representante Legal",
    leftBlockMaxWidth
  );
  doc.text(roleLines[0] || "Directora General y Representante Legal", margin, sigY + 13.6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(30, 64, 175);
  const instLines = wrapTextWithinWidth(doc, inst.institution_name, leftBlockMaxWidth);
  doc.text(instLines, margin, sigY + 17.9);

  // Sello Digital Institucional de Verificación (a la derecha, encajado dentro del recuadro)
  const stampWidth = 72;
  const stampHeight = 31;
  const stampX = pageWidth - margin - stampWidth;
  const stampY = sigY - 12;
  const stampCenterX = stampX + stampWidth / 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(stampX, stampY, stampWidth, stampHeight, 2, 2, "FD");

  // Banda interna superior de verificación dentro del recuadro del sello
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(stampX + 3, stampY + 2.5, stampWidth - 6, 6.2, 1.2, 1.2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(22, 101, 52);
  doc.text("REGISTRO OFICIAL VERIFICADO", stampCenterX, stampY + 6.7, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const shortInst = wrapTextWithinWidth(doc, `${inst.institution_name} - Certificación Digital`, stampWidth - 6);
  doc.text(shortInst[0] || "Casita de Tareas - Certificación Digital", stampCenterX, stampY + 13, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(30, 64, 175);
  doc.text(`Radicado: ${code}`, stampCenterX, stampY + 17.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(100, 116, 139);
  doc.text("Válido conforme a la Ley 527 de 1999", stampCenterX, stampY + 22, { align: "center" });
  doc.text("Firma y sello digital institucional", stampCenterX, stampY + 26.3, { align: "center" });

  // Doble franja inferior decorativa
  doc.setFillColor(229, 57, 53);
  doc.rect(margin, pageHeight - 14, contentWidth, 0.6, "F");

  doc.setFillColor(30, 64, 175);
  doc.rect(margin, pageHeight - 13.4, contentWidth, 2, "F");

  // Leyenda de seguridad y autenticidad
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    sanitizePdfText("Casita de Tareas · La Alegría del Conocimiento, Enseñando con Amor · Documento oficial sin tachaduras ni enmendaduras."),
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );
}

// -----------------------------------------------------------------------------
// RENDERIZADOR UNIFICADO DE CUERPO DE CERTIFICADOS Y CONSTANCIAS
// -----------------------------------------------------------------------------
interface UnifiedCertificateBody {
  paragraphs: string[];
  highlightLine?: string | null;
  tableHead: string[];
  tableRow: string[];
  purposeText: string;
  city: string;
}

function drawUnifiedCertificateBody(doc: JsPDFDoc, autoTable: typeof import("jspdf-autotable").default, startY: number, body: UnifiedCertificateBody) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 5.2;

  let currentY = startY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);
  doc.setTextColor(30, 41, 59);

  for (const paragraph of body.paragraphs) {
    const lines = wrapTextWithinWidth(doc, paragraph, contentWidth);
    if (lines.length === 0) continue;
    doc.text(lines, margin, currentY);
    currentY += lines.length * lineHeight + 3.5;
  }

  if (body.highlightLine && body.highlightLine.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 64, 175);
    const hlLines = wrapTextWithinWidth(doc, body.highlightLine.trim(), contentWidth);
    doc.text(hlLines, margin, currentY);
    currentY += hlLines.length * lineHeight + 3;
  }

  // Tabla Resumen Ejecutivo Unificada
  const tableY = currentY + 1.5;
  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [body.tableHead],
    body: [body.tableRow],
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 8.2,
      cellPadding: 2.8,
    },
    bodyStyles: {
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
      textColor: [15, 23, 42],
      fontSize: 8.5,
      cellPadding: 3.2,
    },
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.3,
      overflow: "linebreak",
    },
  });

  const finalTableY = doc.lastAutoTable?.finalY || tableY + 20;

  // Propósito / Finalidad (ajustado estrictamente al margen del contenido)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(71, 85, 105);
  const purposeLines = wrapTextWithinWidth(doc, body.purposeText, contentWidth);
  const purposeY = finalTableY + 6.5;
  doc.text(purposeLines, margin, purposeY);

  // Frase Formal de Expedición (ajustada estrictamente al margen del contenido)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(71, 85, 105);
  const issuanceSentence = getFormalDateSentence(body.city);
  const issuanceLines = wrapTextWithinWidth(doc, issuanceSentence, contentWidth);
  const issuanceY = purposeY + purposeLines.length * 4.8 + 3.5;
  doc.text(issuanceLines, margin, issuanceY);
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
  const doc: JsPDFDoc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;
  const logoBase64 = await getLogoBase64();

  const code = `CONST-ASIS-${new Date().getFullYear()}-${params.child.child_id_code || params.child.id.slice(0, 4).toUpperCase()}`;

  const startY = drawOfficialHeader(
    doc,
    inst,
    logoBase64,
    code,
    "CONSTANCIA DE ASISTENCIA Y PERMANENCIA ESCOLAR",
    "HACE CONSTAR QUE:"
  );

  const fullName = `${params.child.first_name} ${params.child.last_name}`.toUpperCase();
  const docType = params.child.document_type || "Registro Civil / T.I.";
  const docNum = params.child.document || params.child.child_id_code || "S/I";
  const percentage = params.totalScheduledDays > 0
    ? Math.round((params.totalPresentDays / params.totalScheduledDays) * 100)
    : 100;

  const startFormatted = formatDateSpanish(params.startDate);
  const endFormatted = formatDateSpanish(params.endDate);

  const paragraph1 = `El (la) menor ${fullName}, identificado(a) con ${docType} No. ${docNum}, se encuentra matriculado(a) y activo(a) en los programas pedagógicos y formativos de ${inst.institution_name}, participando en el grupo formativo ${params.groupName.toUpperCase()} en la jornada ${params.child.shift.toUpperCase()}.`;

  const paragraph2 = `Durante el período comprendido entre el ${startFormatted} y el ${endFormatted}, ha registrado una asistencia regular y presencial conforme a los registros del sistema de control institucional, cumpliendo un total de ${params.totalPresentDays} días asistidos sobre ${params.totalScheduledDays} días escolares programados (${percentage}% de asistencia efectiva), destacándose por su puntualidad, dedicación y compromiso en su proceso de aprendizaje.`;

  const purposeText = params.purpose && params.purpose.trim()
    ? `Finalidad: La presente constancia se expide con destino a: ${params.purpose.trim()}.`
    : "Finalidad: La presente constancia se expide a solicitud de los acudientes para los trámites escolares, familiares o administrativos que estimen convenientes.";

  drawUnifiedCertificateBody(doc, autoTable, startY, {
    paragraphs: [paragraph1, paragraph2],
    tableHead: ["Período Certificado", "Jornada", "Días Programados", "Días Asistidos", "Asistencia Efectiva"],
    tableRow: [
      `${params.startDate} al ${params.endDate}`,
      params.child.shift.toUpperCase(),
      `${params.totalScheduledDays} días`,
      `${params.totalPresentDays} días`,
      `${percentage}%`,
    ],
    purposeText,
    city: inst.city,
  });

  drawOfficialFooter(doc, inst, code);

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
  purpose?: string;
  institution?: InstitutionProfile;
}

export async function generatePractitionerCertificate(params: PractitionerCertParams, action: "save" | "blob" = "save") {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc: JsPDFDoc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;
  const logoBase64 = await getLogoBase64();

  const code = `CERT-PRAC-${new Date().getFullYear()}-${params.practitioner.id.slice(0, 4).toUpperCase()}`;

  const startY = drawOfficialHeader(
    doc,
    inst,
    logoBase64,
    code,
    "CERTIFICADO DE PRÁCTICAS FORMATIVAS Y CUMPLIMIENTO DE HORAS",
    "HACE CONSTAR Y CERTIFICA QUE:"
  );

  const fullName = `${params.practitioner.first_name} ${params.practitioner.last_name}`.toUpperCase();
  const docNum = params.practitioner.document || "S/I";
  const university = (params.university || params.practitioner.study || "Institución de Educación Superior").toUpperCase();
  const career = (params.career || params.practitioner.role || "Práctica Formativa").toUpperCase();

  const startFormatted = formatDateSpanish(params.startDate);
  const endFormatted = formatDateSpanish(params.endDate);

  const paragraph1 = `El (la) estudiante ${fullName}, identificado(a) con Cédula de Ciudadanía No. ${docNum}, perteneciente al programa académico ${career} de la institución ${university}, desarrolló satisfactoriamente su práctica formativa en ${inst.institution_name} durante el período comprendido entre el ${startFormatted} y el ${endFormatted}.`;

  const paragraph2 = `Durante el desarrollo del convenio, el (la) practicante registró asistencia regular mediante el sistema digital institucional, cumpliendo a cabalidad un total de ${params.totalHours} horas prácticas en ${params.totalDays} jornadas de atención pedagógica y acompañamiento escolar directo (intensidad acordada de ${params.dailyHours} horas/día).`;

  const paragraph3 = params.performanceNote && params.performanceNote.trim()
    ? `Concepto Evaluativo: ${params.performanceNote.trim()}`
    : "Concepto Institucional: Durante su permanencia demostró excelentes calidades humanas y pedagógicas, vocación docente, puntualidad, ética profesional y un alto sentido de responsabilidad con los niños y la comunidad educativa.";

  const purposeText = params.purpose && params.purpose.trim()
    ? `Finalidad: El presente certificado se expide con destino a: ${params.purpose.trim()}.`
    : `Finalidad: El presente certificado se expide para acreditar el cumplimiento de horas de práctica formativa ante ${university} y demás trámites académicos pertinentes.`;

  drawUnifiedCertificateBody(doc, autoTable, startY, {
    paragraphs: [paragraph1, paragraph2, paragraph3],
    tableHead: ["Universidad / Convenio", "Programa Académico", "Jornadas Cumplidas", "Horas / Día", "Total Horas Certificadas"],
    tableRow: [
      university,
      career,
      `${params.totalDays} jornadas`,
      `${params.dailyHours} h/día`,
      `${params.totalHours} HORAS`,
    ],
    purposeText,
    city: inst.city,
  });

  drawOfficialFooter(doc, inst, code);

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
  const doc: JsPDFDoc = new jsPDF({ format: "a4", unit: "mm" });
  const inst = params.institution || DEFAULT_INSTITUTION;
  const logoBase64 = await getLogoBase64();

  const code = `CERT-LAB-${new Date().getFullYear()}-${params.teacher.id.slice(0, 4).toUpperCase()}`;

  const startY = drawOfficialHeader(
    doc,
    inst,
    logoBase64,
    code,
    "CERTIFICADO LABORAL Y DE DESEMPEÑO DOCENTE",
    "HACE CONSTAR Y CERTIFICA QUE:"
  );

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

  const paragraph2 = `Durante su desempeño laboral, ha demostrado intachables calidades humanas y profesionales, cumplimiento cabal de sus responsabilidades pedagógicas, puntualidad, ética y alto compromiso institucional con la formación integral de los niños.`;

  const highlightLine = params.salary && params.salary.trim()
    ? `Asignación Salarial Mensual: ${params.salary.trim()}`
    : null;

  const purposeText = params.purpose && params.purpose.trim()
    ? `Finalidad: La presente certificación se expide con destino a: ${params.purpose.trim()}.`
    : "Finalidad: La presente certificación se expide a solicitud de la parte interesada para los trámites laborales, bancarios o administrativos que estime convenientes.";

  drawUnifiedCertificateBody(doc, autoTable, startY, {
    paragraphs: [paragraph1, paragraph2],
    highlightLine,
    tableHead: ["Cargo Desempeñado", "Modalidad Contractual", "Fecha de Inicio", "Fecha de Retiro", "Estado Actual"],
    tableRow: [
      jobTitle,
      contractType,
      params.startDate || params.teacher.hire_date,
      params.endDate || "En ejercicio",
      isCurrentlyWorking ? "VINCULACIÓN ACTIVA" : "FINALIZADO",
    ],
    purposeText,
    city: inst.city,
  });

  drawOfficialFooter(doc, inst, code);

  const filename = `Certificado_Laboral_${params.teacher.first_name}_${params.teacher.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (action === "blob") {
    return doc.output("bloburl");
  } else {
    doc.save(filename);
    return null;
  }
}
