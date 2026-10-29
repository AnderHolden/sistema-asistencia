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

const FULL_WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SHORT_WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const FULL_MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const SHORT_MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatReadableSpanishDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} de ${FULL_MONTHS_ES[m - 1]} de ${y}`;
}

function formatDayPillLabel(dateStr: string, cols: number, index: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const dow = dateObj.getDay();
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const yy = String(y).slice(2);

  if (cols === 1) {
    return `${String(index + 1).padStart(2, "0")}. ${FULL_WEEKDAYS_ES[dow]}, ${d} de ${FULL_MONTHS_ES[m - 1]} de ${y}`;
  }
  if (cols === 2) {
    return `${SHORT_WEEKDAYS_ES[dow]}, ${dd} ${SHORT_MONTHS_ES[m - 1]} ${y}`;
  }
  if (cols === 3) {
    return `${SHORT_WEEKDAYS_ES[dow]} ${dd}/${mm}/${yy}`;
  }
  return `${SHORT_WEEKDAYS_ES[dow].slice(0, 2)} ${dd}/${mm}/${yy}`;
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

  const [{ jsPDF }, logoBase64] = await Promise.all([
    getPdfLibs(),
    getReportLogoBase64(),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;          // 182 mm

  // Ordenar cronológicamente (Desde -> Hasta)
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const presentRows = sortedRows.filter((r) => r.status === "present");
  const absentRows = sortedRows.filter((r) => r.status === "absent");
  const totalDays = sortedRows.length;
  const presentDays = presentRows.length;
  const absentDays = absentRows.length;
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // =========================================================================
  // 1. ENCABEZADO INSTITUCIONAL CON LOGO (y = 10mm a 31.5mm)
  // =========================================================================
  let headerTextX = margin;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 10, 19, 19);
      headerTextX = margin + 23;
    } catch {
      headerTextX = margin;
    }
  }
  const headerMaxW = pageWidth - margin - headerTextX;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 64, 175);
  doc.text("CASITA DE TAREAS", headerTextX, 15.5, { maxWidth: headerMaxW });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("SISTEMA DE GESTIÓN DE ASISTENCIA INSTITUCIONAL", headerTextX, 20.5, { maxWidth: headerMaxW });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("REPORTE DE DÍAS DE ASISTENCIA E INASISTENCIA POR FECHAS", headerTextX, 26.2, { maxWidth: headerMaxW });

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.6);
  doc.line(margin, 31.5, pageWidth - margin, 31.5);

  // =========================================================================
  // 2. RECUADRO DE DATOS DEL NIÑO(A) Y PERÍODO (100% ajustado sin salirse)
  // =========================================================================
  const boxY = 34;
  const padX = 4.5;
  const innerBoxW = contentWidth - padX * 2; // 173 mm
  const leftColMaxW = 110;
  const rightColX = margin + 118;
  const rightColMaxW = contentWidth - 118 - padX; // 59.5 mm

  const fullNameWithCode = personCode ? `${personName}  (ID: ${personCode})` : personName;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const nameLines: string[] = doc.splitTextToSize(fullNameWithCode, leftColMaxW);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const groupLines: string[] = doc.splitTextToSize(groupOrRole || "Sin grupo", rightColMaxW);

  const startFormatted = formatReadableSpanishDate(startDate);
  const endFormatted = formatReadableSpanishDate(endDate);
  const periodText = `Período evaluado: Desde el ${startFormatted} hasta el ${endFormatted}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const periodLines: string[] = doc.splitTextToSize(periodText, innerBoxW);

  const holidayNote =
    holidaysExcludedCount > 0
      ? ` (${holidaysExcludedCount} día(s) festivo(s) excluido(s) en este rango)`
      : "";
  const noteText = `Nota: Incluye únicamente días hábiles de lunes a viernes, excluyendo sábados, domingos y festivos oficiales${holidayNote}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  const noteLines: string[] = doc.splitTextToSize(noteText, innerBoxW);

  const row1LinesCount = Math.max(nameLines.length, groupLines.length);
  const nameStartY = boxY + 9.2;
  const periodStartY = nameStartY + row1LinesCount * 4.1 + 1.2;
  const noteStartY = periodStartY + periodLines.length * 3.8 + 0.8;
  const boxHeight = noteStartY - boxY + noteLines.length * 3.4 + 2.2;

  // Dibujar fondo y borde del recuadro antes de imprimir los textos envueltos
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, boxY, contentWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${personTypeLabel.toUpperCase()}:`, margin + padX, boxY + 4.8);
  doc.text("GRUPO / NIVEL:", rightColX, boxY + 4.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(nameLines, margin + padX, nameStartY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 64, 175);
  doc.text(groupLines, rightColX, nameStartY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(periodLines, margin + padX, periodStartY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(noteLines, margin + padX, noteStartY);

  // =========================================================================
  // 3. TARJETAS DE RESUMEN A COLOR (Días Hábiles, Asistió, No Asistió, %)
  // =========================================================================
  const cardY = boxY + boxHeight + 3.5;
  const cardHeight = 16.5;
  const cardGap = 3.5;
  const cardWidth = (contentWidth - cardGap * 3) / 4;

  // Tarjeta 1: DÍAS HÁBILES (L-V)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalDays), margin + cardWidth / 2, cardY + 8.8, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("DÍAS HÁBILES (L-V)", margin + cardWidth / 2, cardY + 14, { align: "center" });

  // Tarjeta 2: DÍAS QUE ASISTIÓ (Verde)
  const card2X = margin + cardWidth + cardGap;
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(74, 222, 128);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(21, 128, 61);
  doc.text(String(presentDays), card2X + cardWidth / 2, cardY + 8.8, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52);
  doc.text("DÍAS QUE ASISTIÓ", card2X + cardWidth / 2, cardY + 14, { align: "center" });

  // Tarjeta 3: DÍAS QUE NO ASISTIÓ (Rojo)
  const card3X = margin + (cardWidth + cardGap) * 2;
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(185, 28, 28);
  doc.text(String(absentDays), card3X + cardWidth / 2, cardY + 8.8, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(153, 27, 27);
  doc.text("DÍAS QUE NO ASISTIÓ", card3X + cardWidth / 2, cardY + 14, { align: "center" });

  // Tarjeta 4: % DE ASISTENCIA (Azul Institucional)
  const card4X = margin + (cardWidth + cardGap) * 3;
  doc.setFillColor(219, 234, 254);
  doc.setDrawColor(96, 165, 250);
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(30, 64, 175);
  doc.text(`${percentage}%`, card4X + cardWidth / 2, cardY + 8.8, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(29, 78, 216);
  doc.text("% DE ASISTENCIA", card4X + cardWidth / 2, cardY + 14, { align: "center" });

  // =========================================================================
  // 4. PREPARAR PIE DE ATRIBUCIÓN EN LA MISMA HOJA (Sin firma)
  // =========================================================================
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
  const genUserLines: string[] = doc.splitTextToSize(
    `Generado por: ${generatedByName}  —  Rol: ${generatedByRole}`,
    innerBoxW
  );
  const footerBoxHeight = 18.5 + genUserLines.length * 3.8;
  const footerBoxY = pageHeight - 11 - footerBoxHeight;

  // =========================================================================
  // 5. PANELES A COLOR EN UNA SOLA HOJA: DÍAS QUE ASISTIÓ vs DÍAS QUE NO ASISTIÓ
  // =========================================================================
  const panelsTop = cardY + cardHeight + 4;
  const panelsBottom = footerBoxY - 4;
  const panelHeight = Math.max(40, panelsBottom - panelsTop);
  const panelGap = 4;
  const panelWidth = (contentWidth - panelGap) / 2; // 89 mm cada columna

  function renderColoredDaysPanel(params: {
    x: number;
    title: string;
    items: PersonAttendanceRangeRow[];
    emptyText: string;
    theme: "green" | "red";
  }) {
    const { x, title, items, emptyText, theme } = params;
    const isGreen = theme === "green";

    // Contenedor principal del panel
    if (isGreen) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(134, 239, 172);
    } else {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
    }
    doc.setLineWidth(0.4);
    doc.roundedRect(x, panelsTop, panelWidth, panelHeight, 2.5, 2.5, "FD");

    // Encabezado a color dentro del panel
    if (isGreen) {
      doc.setFillColor(22, 163, 74);
    } else {
      doc.setFillColor(220, 38, 38);
    }
    doc.roundedRect(x + 1.5, panelsTop + 1.5, panelWidth - 3, 8, 1.6, 1.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + panelWidth / 2, panelsTop + 6.7, { align: "center" });

    const innerX = x + 2.5;
    const innerY = panelsTop + 11.5;
    const innerW = panelWidth - 5;
    const innerH = panelHeight - 14;

    if (items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(isGreen ? 21 : 185, isGreen ? 128 : 28, isGreen ? 61 : 28);
      const emptyLines: string[] = doc.splitTextToSize(emptyText, innerW - 8);
      doc.text(emptyLines, x + panelWidth / 2, innerY + innerH / 2 - 2, { align: "center" });
      return;
    }

    // Cálculo adaptativo de sub-columnas para garantizar que TODOS los días quepan en 1 sola hoja
    const count = items.length;
    let cols = 1;
    if (count > 108) cols = 4;
    else if (count > 56) cols = 3;
    else if (count > 22) cols = 2;

    const rowsCount = Math.ceil(count / cols);
    const gapX = cols >= 3 ? 1.5 : 2;
    const gapY = rowsCount > 45 ? 0.35 : rowsCount > 32 ? 0.6 : rowsCount > 22 ? 0.9 : 1.3;
    const pillW = (innerW - gapX * (cols - 1)) / cols;
    const rawPillH = Math.max(1.6, (innerH - gapY * (rowsCount - 1)) / rowsCount);
    const maxPillH = cols === 1 ? 6.2 : cols === 2 ? 5.2 : 4.2;
    const pillH = Math.min(maxPillH, rawPillH);

    let fontSize = 8;
    if (cols === 2) fontSize = 7.3;
    else if (cols === 3) fontSize = 6.3;
    else if (cols === 4) fontSize = 5.3;
    if (pillH < 3.4) fontSize = Math.min(fontSize, 5.5);

    doc.setLineWidth(0.2);

    items.forEach((item, idx) => {
      const colIdx = Math.floor(idx / rowsCount);
      const rowIdx = idx % rowsCount;
      const px = innerX + colIdx * (pillW + gapX);
      const py = innerY + rowIdx * (pillH + gapY);

      if (isGreen) {
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(134, 239, 172);
      } else {
        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(252, 165, 165);
      }
      doc.roundedRect(px, py, pillW, pillH, 1.2, 1.2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      if (isGreen) {
        doc.setTextColor(20, 83, 45);
      } else {
        doc.setTextColor(153, 27, 27);
      }

      const label = formatDayPillLabel(item.date, cols, idx);
      const textY = py + pillH / 2 + fontSize * 0.12;
      if (cols === 1) {
        doc.text(label, px + 3, textY, { maxWidth: pillW - 5 });
      } else {
        doc.text(label, px + pillW / 2, textY, { align: "center", maxWidth: pillW - 1.5 });
      }
    });
  }

  renderColoredDaysPanel({
    x: margin,
    title: `DÍAS QUE ASISTIÓ (${presentDays})`,
    items: presentRows,
    emptyText: "Ningún día de asistencia registrado en este rango de fechas.",
    theme: "green",
  });

  renderColoredDaysPanel({
    x: margin + panelWidth + panelGap,
    title: `DÍAS QUE NO ASISTIÓ (${absentDays})`,
    items: absentRows,
    emptyText: "¡Excelente! Ningún día de inasistencia en este rango de fechas.",
    theme: "red",
  });

  // =========================================================================
  // 6. BLOQUE FINAL DE CONSTANCIA DEL SISTEMA (Sin firma, en la misma hoja)
  // =========================================================================
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, footerBoxY, contentWidth, footerBoxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175);
  doc.text(
    "CONSTANCIA AUTOMÁTICA DEL SISTEMA DE GESTIÓN DE ASISTENCIA — CASITA DE TAREAS",
    margin + padX,
    footerBoxY + 5.2,
    { maxWidth: innerBoxW }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "Este reporte fue generado oficialmente desde el Sistema de Gestión de Asistencia de Casita de Tareas.",
    margin + padX,
    footerBoxY + 10,
    { maxWidth: innerBoxW }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(genUserLines, margin + padX, footerBoxY + 14.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Fecha y hora de generación: ${genDateStr} a las ${genTimeStr}`,
    margin + padX,
    footerBoxY + 14.8 + genUserLines.length * 3.8 + 0.8,
    { maxWidth: innerBoxW }
  );

  // Pie de página centrado dentro del margen inferior
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Casita de Tareas · Sistema de Gestión de Asistencia · Página 1 de 1",
    pageWidth / 2,
    pageHeight - 5.2,
    { align: "center" }
  );

  doc.save(`${filename}.pdf`);
}
