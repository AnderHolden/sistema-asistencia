import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function fixEncoding(text: string): string {
  return text
    .replace(/Ã¡/g, "\u00e1").replace(/Ã©/g, "\u00e9").replace(/Ã­/g, "\u00ed")
    .replace(/Ã³/g, "\u00f3").replace(/Ãº/g, "\u00fa").replace(/Ã±/g, "\u00f1")
    .replace(/Ã\x81/g, "\u00c1").replace(/Ã‰/g, "\u00c9").replace(/Ã\x8d/g, "\u00cd")
    .replace(/Ã"/g, "\u00d3").replace(/Ãš/g, "\u00da").replace(/Ã‘/g, "\u00d1")
    .replace(/Ã¼/g, "\u00fc").replace(/Ãœ/g, "\u00dc");
}

function findChildMatch(recordNormName: string, children: Array<{ id: string; normName: string; name: string }>): { child: typeof children[0]; strategy: string } | null {
  // 1. Exact match
  for (const child of children) {
    if (child.normName === recordNormName) {
      return { child, strategy: "exact" };
    }
  }

  // 2. Try matching by parts (first name + last name combinations)
  const recordParts = recordNormName.split(" ").filter(p => p.length > 2);
  if (recordParts.length >= 2) {
    for (const child of children) {
      const keyParts = child.normName.split(" ");
      const firstMatch = recordParts.some(rp => keyParts.some(kp => kp.startsWith(rp) || rp.startsWith(kp)));
      const lastMatch = recordParts.some(rp => keyParts.some(kp => kp.endsWith(rp) || rp.endsWith(kp)));
      if (firstMatch && lastMatch) {
        return { child, strategy: "parts" };
      }
    }
  }

  // 3. Fuzzy similarity (Jaccard on words)
  let bestMatch: typeof children[0] | null = null;
  let bestScore = 0;
  
  for (const child of children) {
    const score = similarity(recordNormName, child.normName);
    if (score > 0.6 && score > bestScore) {
      bestScore = score;
      bestMatch = child;
    }
  }
  
  return bestMatch ? { child: bestMatch, strategy: `fuzzy(${Math.round(bestScore * 100)}%)` } : null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt") && !file.name.endsWith(".tsv")) {
      return NextResponse.json({ error: "El archivo debe ser .csv, .txt o .tsv" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Try UTF-8 first, then Latin1
    let text: string;
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      text = utf8Decoder.decode(uint8Array);
    } catch {
      text = new TextDecoder("latin1").decode(uint8Array);
    }

    text = fixEncoding(text);

    // Detect delimiter (comma, tab, or semicolon)
    const firstLine = text.split("\n")[0];
    let delimiter = ",";
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";")) delimiter = ";";

    // Parse CSV
    const parseCSV = (csvText: string, sep: string): string[][] => {
      const result: string[][] = [];
      let current = "";
      let inQuotes = false;
      let row: string[] = [];

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === sep && !inQuotes) {
          row.push(current);
          current = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
          if (char === "\r" && nextChar === "\n") i++;
          row.push(current);
          if (row.some(c => c.trim())) result.push(row);
          row = [];
          current = "";
        } else {
          current += char;
        }
      }
      if (current || row.length > 0) {
        row.push(current);
        if (row.some(c => c.trim())) result.push(row);
      }
      return result;
    };

    const parsed = parseCSV(text, delimiter);

    if (parsed.length < 2) {
      return NextResponse.json({ error: "CSV vacío o inválido (menos de 2 líneas)" }, { status: 400 });
    }

    const header = parsed[0].map(h => h.toLowerCase().trim());
    const fechaIdx = header.findIndex(h => h.includes("fecha"));
    const nombreIdx = header.findIndex(h => h.includes("nombre"));
    const estadoIdx = header.findIndex(h => h.includes("asist") || h.includes("estado"));

    // Build details for debugging
    const headerInfo = parsed[0].map((h, i) => `[${i}] "${h}"`).join(", ");
    console.log(`[Import] Header: ${headerInfo}`);
    console.log(`[Import] Indices - fecha:${fechaIdx} nombre:${nombreIdx} estado:${estadoIdx}`);
    console.log(`[Import] Delimiter: "${delimiter === "\t" ? "TAB" : delimiter}"`);
    console.log(`[Import] Total rows: ${parsed.length - 1}`);

    if (fechaIdx === -1 || nombreIdx === -1 || estadoIdx === -1) {
      return NextResponse.json({
        error: `Columnas no encontradas. Header detectado: "${parsed[0].join(", ")}". Se esperaba: Fecha, Nombre, Estado/Asistencia`,
        headerDetected: parsed[0],
      }, { status: 400 });
    }

    // Parse records with details
    interface ImportRecord {
      rowNumber: number;
      name: string;
      normName: string;
      date: string;
      status: "present" | "absent";
      rawEstado: string;
    }

    const records: ImportRecord[] = [];
    const skippedRows: { row: number; reason: string; data: string }[] = [];

    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      const rowStr = row.join(", ");

      if (row.length <= Math.max(fechaIdx, nombreIdx, estadoIdx)) {
        skippedRows.push({ row: i + 1, reason: "Pocas columnas", data: rowStr });
        continue;
      }

      const fecha = row[fechaIdx]?.trim() || "";
      const nombre = row[nombreIdx]?.trim() || "";
      const estadoRaw = row[estadoIdx]?.toLowerCase().trim() || "";

      if (!fecha || !nombre) {
        skippedRows.push({ row: i + 1, reason: !fecha ? "Sin fecha" : "Sin nombre", data: rowStr });
        continue;
      }

      let status: "present" | "absent" = "absent";
      if (estadoRaw.includes("no asist")) status = "absent";
      else if (estadoRaw.includes("asist")) status = "present";
      else if (estadoRaw.includes("presente") || estadoRaw === "p" || estadoRaw === "1") status = "present";
      else if (estadoRaw.includes("ausente") || estadoRaw === "a" || estadoRaw === "0") status = "absent";

      const fixedName = fixEncoding(nombre);
      records.push({
        rowNumber: i + 1,
        name: fixedName,
        normName: normalizeName(fixedName),
        date: fecha,
        status,
        rawEstado: estadoRaw,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No se encontraron registros válidos", skippedRows }, { status: 400 });
    }

    console.log(`[Import] Parsed ${records.length} valid records, ${skippedRows.length} skipped`);

    // Load children from Firestore
    const adminDb = getAdminDb();
    const childrenSnap = await adminDb.collection("children").where("status", "==", "active").get();

    const children: Array<{ id: string; normName: string; name: string }> = [];
    childrenSnap.docs.forEach(d => {
      const data = d.data();
      const fullName = `${data.first_name} ${data.last_name}`;
      children.push({
        id: d.id,
        normName: normalizeName(fullName),
        name: fullName,
      });
    });

    console.log(`[Import] Loaded ${children.length} children from Firestore`);

    // Match and import
    let imported = 0;
    let skippedExisting = 0;
    const unmatched: { name: string; date: string; row: number }[] = [];
    const matchedDetails: { name: string; childName: string; date: string; status: string; strategy: string }[] = [];

    for (const record of records) {
      const matchResult = findChildMatch(record.normName, children);

      if (!matchResult) {
        unmatched.push({ name: record.name, date: record.date, row: record.rowNumber });
        continue;
      }

      // Check if already exists
      const existingSnap = await adminDb.collection("attendance_children")
        .where("child_id", "==", matchResult.child.id)
        .where("attendance_date", "==", record.date)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        skippedExisting++;
        continue;
      }

      try {
        await adminDb.collection("attendance_children").add({
          child_id: matchResult.child.id,
          attendance_date: record.date,
          status: record.status,
          check_in: record.status === "present" ? new Date().toISOString() : null,
          registered_by: "csv-import",
          created_at: new Date().toISOString(),
        });
        imported++;
        matchedDetails.push({
          name: record.name,
          childName: matchResult.child.name,
          date: record.date,
          status: record.status === "present" ? "Presente" : "Ausente",
          strategy: matchResult.strategy,
        });
      } catch (e) {
        console.error(`Error importing ${record.name}:`, e);
        unmatched.push({ name: record.name, date: record.date, row: record.rowNumber });
      }
    }

    return NextResponse.json({
      success: true,
      totalRecords: records.length,
      imported,
      skippedExisting,
      unmatchedCount: unmatched.length,
      unmatched: unmatched.slice(0, 100),
      matchedDetails: matchedDetails.slice(0, 100),
      skippedRows: skippedRows.slice(0, 50),
      headerDetected: parsed[0],
    });

  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
