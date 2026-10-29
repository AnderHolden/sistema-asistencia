let cachedReportLogoBase64: string | null = null;

async function getReportLogoBase64(): Promise<string | null> {
  if (cachedReportLogoBase64) return cachedReportLogoBase64;
  if (typeof window === "undefined") return null;
  try {
    let res = await fetch("/logo-doc.png");
    if (!res.ok) res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedReportLogoBase64 = reader.result as string;
        resolve(cachedReportLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const XLSX = await getXlsx();
  const worksheet = XLSX.utils.json_to_sheet(data);

  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    worksheet["!cols"] = keys.map((key) => {
      const maxCellLen = data.reduce((max, row) => {
        const val = row[key] !== null && row[key] !== undefined ? String(row[key]) : "";
        return Math.max(max, val.length);
      }, key.length);
      return { wch: Math.min(Math.max(maxCellLen + 4, 12), 45) };
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

async function getPdfLibs(): Promise<{ jsPDF: typeof import("jspdf").default; autoTable: typeof import("jspdf-autotable").default }> {
  const [jsModule, atModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF: jsModule.default, autoTable: atModule.default };
}

async function getXlsx() {
  return import("xlsx");
}

export async function exportToPDF(
  title: string,
  headers: string[],
  data: string[][],
  filename: string
) {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text("CASITA DE TAREAS", 14, 16);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  doc.text(`Generado: ${dateStr} a las ${timeStr}  ·  Total registros: ${data.length}`, 14, 31);

  autoTable(doc, {
    head: [headers],
    body: data as never[][],
    startY: 36,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 245, 255] },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToCsv(data: Record<string, unknown>[], filename: string) {
  const XLSX = await getXlsx();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface PDFDetailRow {
  name: string;
  groupOrType: string;
  date: string;
  status: string;
  checkIn?: string | null;
  signatureDataUrl?: string | null;
}

export async function exportToPDFDetail(
  title: string,
  headers: string[],
  rows: PDFDetailRow[],
  filename: string,
  includeSignature: boolean
) {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF({ orientation: includeSignature ? "landscape" : "portrait", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 64, 175);
  doc.text("CASITA DE TAREAS", 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Generado: ${dateStr}  ·  Total registros: ${rows.length}`, 14, 28);

  const hasCheckInCol = headers.includes("Hora");
  const body: string[][] = rows.map((row) => {
    const cells = [
      row.name,
      row.groupOrType,
      row.date,
      row.status,
    ];
    if (hasCheckInCol) {
      cells.push(row.checkIn || "—");
    }
    if (includeSignature) {
      cells.push("");
    }
    return cells;
  });

  const sigColIndex = headers.length - 1;

  autoTable(doc, {
    head: [headers],
    body: body as never[][],
    startY: 33,
    styles: {
      fontSize: includeSignature ? 8.5 : 9.5,
      cellPadding: includeSignature ? 3 : 3,
      minCellHeight: includeSignature ? 15 : 8,
      valign: "middle",
    },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    didDrawCell: (data) => {
      if (includeSignature && data.section === "body" && data.column.index === sigColIndex) {
        const row = rows[data.row.index];
        if (row?.signatureDataUrl && row.signatureDataUrl.startsWith("data:image")) {
          try {
            const imgWidth = Math.min(26, data.cell.width - 4);
            const imgHeight = Math.min(11, data.cell.height - 2);
            const x = data.cell.x + (data.cell.width - imgWidth) / 2;
            const y = data.cell.y + (data.cell.height - imgHeight) / 2;
            doc.addImage(row.signatureDataUrl, "PNG", x, y, imgWidth, imgHeight);
          } catch {
            /* skip invalid signature image */
          }
        }
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

export interface PersonAttendanceRangeRow {
  date: string;
  dateFormatted: string;
  dayName: string;
  status: "present" | "absent";
  statusLabel: string;
  checkIn?: string | null;
}

export interface PersonAttendanceRangePDFOptions {
  personName: string;
  personCode?: string;
  groupOrRole: string;
  personTypeLabel?: string;
  startDate: string;
  endDate: string;
  holidaysExcludedCount?: number;
  rows: PersonAttendanceRangeRow[];
  generatedByName: string;
  generatedByRole: string;
  filename: string;
}

function formatReadableSpanishDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function exportPersonAttendanceRangePDF(options: PersonAttendanceRangePDFOptions) {
  const {
    personName,
    personCode,
    groupOrRole,
    personTypeLabel = "Niño(a) / Estudiante",
    startDate,
    endDate,
    holidaysExcludedCount = 0,
    rows,
    generatedByName,
    generatedByRole,
    filename,
  } = options;

  const [{ jsPDF, autoTable }, logoBase64] = await Promise.all([
    getPdfLibs(),
    getReportLogoBase64(),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Ordenar cronológicamente (Desde -> Hasta) para que el reporte sea totalmente claro y secuencial
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const totalDays = sortedRows.length;
  const presentDays = sortedRows.filter((r) => r.status === "present").length;
  const absentDays = sortedRows.filter((r) => r.status === "absent").length;
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // 1. Encabezado Institucional con Logo Oficial
  let headerTextX = margin;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 11, 22, 22);
      headerTextX = margin + 26;
    } catch {
      headerTextX = margin;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text("CASITA DE TAREAS", headerTextX, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text("SISTEMA DE GESTIÓN DE ASISTENCIA INSTITUCIONAL", headerTextX, 22.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("REPORTE DE DÍAS DE ASISTENCIA E INASISTENCIA POR RANGO DE FECHAS", headerTextX, 29);

  // Línea separadora institucional
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.6);
  doc.line(margin, 35, pageWidth - margin, 35);

  // 2. Ficha informativa del Niño(a) / Persona y Período Evaluado
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 38, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${personTypeLabel.toUpperCase()}:`, margin + 4, 44);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const fullNameWithCode = personCode ? `${personName}  (ID: ${personCode})` : personName;
  doc.text(fullNameWithCode, margin + 4, 49.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("GRUPO / NIVEL:", pageWidth - margin - 62, 44);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 64, 175);
  doc.text(groupOrRole || "Sin grupo", pageWidth - margin - 62, 49.5);

  const startFormatted = formatReadableSpanishDate(startDate);
  const endFormatted = formatReadableSpanishDate(endDate);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Período evaluado: Desde el ${startFormatted} hasta el ${endFormatted}`,
    margin + 4,
    55.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const holidayNote =
    holidaysExcludedCount > 0
      ? ` (${holidaysExcludedCount} día(s) festivo(s) excluido(s) en este rango)`
      : "";
  doc.text(
    `Nota: Incluye únicamente días hábiles de lunes a viernes, excluyendo sábados, domingos y festivos oficiales${holidayNote}.`,
    margin + 4,
    60
  );

  // 3. Tarjetas de Resumen (Días Hábiles, Días que Asistió, Días que No Asistió, % Cumplimiento)
  const cardY = 65;
  const cardHeight = 18;
  const gap = 3.5;
  const cardWidth = (contentWidth - gap * 3) / 4;

  // Tarjeta 1: Total Días Hábiles
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalDays), margin + cardWidth / 2, cardY + 9.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("DÍAS HÁBILES (L-V)", margin + cardWidth / 2, cardY + 15, { align: "center" });

  // Tarjeta 2: Días que Asistió
  const card2X = margin + cardWidth + gap;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105);
  doc.text(String(presentDays), card2X + cardWidth / 2, cardY + 9.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text("DÍAS QUE ASISTIÓ", card2X + cardWidth / 2, cardY + 15, { align: "center" });

  // Tarjeta 3: Días que No Asistió
  const card3X = margin + (cardWidth + gap) * 2;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38);
  doc.text(String(absentDays), card3X + cardWidth / 2, cardY + 9.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text("DÍAS QUE NO ASISTIÓ", card3X + cardWidth / 2, cardY + 15, { align: "center" });

  // Tarjeta 4: % Asistencia
  const card4X = margin + (cardWidth + gap) * 3;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text(`${percentage}%`, card4X + cardWidth / 2, cardY + 9.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setTextColor(29, 78, 216);
  doc.text("% DE ASISTENCIA", card4X + cardWidth / 2, cardY + 15, { align: "center" });

  // 4. Tabla Detallada de Días Asistidos y No Asistidos
  const tableBody = sortedRows.map((r, idx) => {
    const capDay = r.dayName ? r.dayName.charAt(0).toUpperCase() + r.dayName.slice(1) : "";
    return [
      String(idx + 1),
      r.dateFormatted,
      capDay,
      r.status === "present" ? "ASISTIÓ" : "NO ASISTIÓ",
      r.checkIn || "—",
    ];
  });

  autoTable(doc, {
    head: [["N°", "Fecha", "Día Hábil", "Estado de Asistencia", "Hora de Llegada"]],
    body: tableBody as never[][],
    startY: 87,
    margin: { left: margin, right: margin, bottom: 36 },
    styles: {
      fontSize: 9,
      cellPadding: 2.8,
      valign: "middle",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { halign: "left", cellWidth: 62 },
      2: { halign: "left", cellWidth: 36 },
      3: { halign: "center", cellWidth: 40, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const rawVal = String(data.cell.raw || "");
        if (rawVal === "ASISTIÓ") {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [22, 101, 52];
        } else {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        }
      }
    },
  });

  // 5. Bloque Final de Certificación del Sistema (Sin firma, con atribución al usuario en sesión)
  const finalY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120) + 6;
  let footerBlockY = finalY;
  if (footerBlockY + 26 > pageHeight - 12) {
    doc.addPage();
    footerBlockY = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, footerBlockY, contentWidth, 23, 2, 2, "FD");

  const now = new Date();
  const genDateStr = now.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const genTimeStr = now.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 64, 175);
  doc.text(
    "CONSTANCIA AUTOMÁTICA DEL SISTEMA DE GESTIÓN DE ASISTENCIA — CASITA DE TAREAS",
    margin + 4,
    footerBlockY + 6
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "Este reporte fue generado oficialmente desde el Sistema de Gestión de Asistencia de Casita de Tareas.",
    margin + 4,
    footerBlockY + 11.5
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Generado por: ${generatedByName}  —  Rol: ${generatedByRole}`,
    margin + 4,
    footerBlockY + 17
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Fecha y hora de generación: ${genDateStr} a las ${genTimeStr}`,
    margin + 4,
    footerBlockY + 21.2
  );

  // Numeración de páginas en pie de página
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Casita de Tareas · Sistema de Gestión de Asistencia · Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}
