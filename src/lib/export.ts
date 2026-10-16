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