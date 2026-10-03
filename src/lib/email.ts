import nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const config: EmailConfig = {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  };

  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: {
      rejectUnauthorized: false, // Prevents certificate self-signed issues in cloud environments
    },
  });

  return transporter;
}

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getEmailProviderInfo(): { configured: boolean; provider: "resend" | "smtp" | "none"; from: string } {
  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: "resend",
      from: process.env.RESEND_FROM || "Casita de Tareas <onboarding@resend.dev>",
    };
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      configured: true,
      provider: "smtp",
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    };
  }
  return {
    configured: false,
    provider: "none",
    from: "",
  };
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    return { success: false, error: "No recipients specified" };
  }

  // 1. Prioritize Resend API if API Key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const fromEmail = process.env.RESEND_FROM || "Casita de Tareas <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ""),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Resend API error:", data);
        return { success: false, error: data.message || "Error al enviar correo con Resend" };
      }
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      console.error("Resend HTTP request failed:", err);
      // Fallback to SMTP if configured
    }
  }

  // 2. SMTP Transporter fallback
  const t = getTransporter();
  if (!t) {
    console.warn("Email service is not configured (missing SMTP or RESEND env vars).");
    return { success: false, error: "Servicio de correo no configurado" };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await t.sendMail({
      from: `Casita de Tareas <${fromAddress}>`,
      to: recipients.join(", "),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    console.error("SMTP send failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido en SMTP" };
  }
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapEmailTemplate(title: string, badgeText: string, badgeBg: string, contentHtml: string): string {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Header Brand -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      Casita de Tareas
                    </span>
                    <p style="margin: 4px 0 0; color: #bfdbfe; font-size: 12px; font-weight: 500;">
                      Sistema de Control y Gestión Institucional
                    </p>
                  </td>
                  <td align="right">
                    <span style="background-color: ${badgeBg}; color: #ffffff; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                ${escapeHtml(title)}
              </h2>
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Casita de Tareas · Refuerzo Escolar y Formación Integral
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                Este es un mensaje automático generado por la plataforma institucional. Por favor no responder directamente a este buzón.
                <br>© ${currentYear} Casita de Tareas. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// -----------------------------------------------------------------------------
// Notification: New Correction Request (To Super Admins)
// -----------------------------------------------------------------------------
export async function sendCorrectionNotification(
  adminEmails: string[],
  childName: string,
  childCode: string,
  date: string,
  reason: string,
  newStatus?: string
): Promise<void> {
  const title = "Nueva Solicitud de Corrección de Asistencia";
  const statusLabel = newStatus === "present" ? "Marcar Como Presente" : newStatus === "absent" ? "Marcar Como Ausente" : "Corrección solicitada";

  const contentHtml = `
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Se ha registrado una nueva solicitud de corrección de asistencia en la plataforma que requiere su revisión y aprobación.
    </p>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;" width="40%">Persona / Estudiante:</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(childName)}</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">Código / Identificador:</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #2563eb;">${escapeHtml(childCode)}</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">Fecha de Asistencia:</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${escapeHtml(date)}</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">Acción Solicitada:</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #059669;">${escapeHtml(statusLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; font-size: 13px; font-weight: 600; color: #64748b; vertical-align: top;">Motivo / Justificación:</td>
        <td style="padding: 16px 20px; font-size: 13px; color: #334155; line-height: 1.5; font-style: italic;">&ldquo;${escapeHtml(reason)}&rdquo;</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="https://sistema-asistencia.vercel.app/corrections" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
        Revisar Solicitud en el Panel
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, "Solicitud Pendiente", "#d97706", contentHtml);
  const subject = `[Corrección Asistencia] Solicitud para ${childName} (${childCode})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// Notification: Correction Resolution (To Operator who requested it)
// -----------------------------------------------------------------------------
export async function sendCorrectionResolutionNotification(
  operatorEmail: string,
  childName: string,
  childCode: string,
  date: string,
  approved: boolean,
  adminNote?: string
): Promise<void> {
  const title = approved ? "Solicitud de Corrección Aprobada" : "Solicitud de Corrección Rechazada";
  const badgeText = approved ? "Aprobada" : "Rechazada";
  const badgeBg = approved ? "#059669" : "#dc2626";

  const contentHtml = `
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Le informamos que la solicitud de corrección de asistencia para <strong>${escapeHtml(childName)}</strong> ha sido revisada por la administración.
    </p>

    <div style="background-color: ${approved ? "#ecfdf5" : "#fef2f2"}; border: 1px solid ${approved ? "#a7f3d0" : "#fecaca"}; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: ${approved ? "#065f46" : "#991b1b"};">
        Estado de la Solicitud: ${approved ? "Aprobada Satisfactoriamente" : "No Aprobada / Rechazada"}
      </p>
      <p style="margin: 0; font-size: 13px; color: ${approved ? "#047857" : "#b91c1c"};">
        ${approved
          ? "El registro de asistencia ha sido actualizado conforme a su solicitud."
          : "La solicitud no fue aprobada con los datos suministrados. Revise las observaciones a continuación."}
      </p>
    </div>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;" width="40%">Persona / Alumno:</td>
        <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(childName)} (${escapeHtml(childCode)})</td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">Fecha Asistencia:</td>
        <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${escapeHtml(date)}</td>
      </tr>
      ${adminNote ? `
      <tr>
        <td style="padding: 14px 20px; font-size: 13px; font-weight: 600; color: #64748b; vertical-align: top;">Observación Administración:</td>
        <td style="padding: 14px 20px; font-size: 13px; color: #334155; line-height: 1.5;">${escapeHtml(adminNote)}</td>
      </tr>
      ` : ""}
    </table>

    <div style="text-align: center; margin: 24px 0 12px 0;">
      <a href="https://sistema-asistencia.vercel.app/attendance/children" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700;">
        Ir a Control de Asistencias
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, badgeText, badgeBg, contentHtml);
  const subject = `[Resolución] Corrección ${badgeText.toLowerCase()} - ${childName} (${childCode})`;
  await sendEmail(operatorEmail, subject, html);
}

// -----------------------------------------------------------------------------
// Notification: Daily Absence Report
// -----------------------------------------------------------------------------
export async function sendAbsenceReport(
  adminEmails: string[],
  date: string,
  absentChildren: { name: string; code: string }[],
  absentStaff: { name: string; role: string }[]
): Promise<void> {
  const title = `Reporte Consolidado de Inasistencias (${date})`;
  const totalAbsent = absentChildren.length + absentStaff.length;

  const contentHtml = `
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      A continuación se presenta el consolidado oficial de inasistencias registradas durante la jornada de hoy (<strong>${escapeHtml(date)}</strong>).
    </p>

    <!-- Summary Box -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
      <tr>
        <td width="48%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 24px; font-weight: 800; color: #1e40af;">${absentChildren.length}</p>
          <p style="margin: 4px 0 0; font-size: 12px; font-weight: 600; color: #3b82f6;">Niños Ausentes</p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 24px; font-weight: 800; color: #9d174d;">${absentStaff.length}</p>
          <p style="margin: 4px 0 0; font-size: 12px; font-weight: 600; color: #db2777;">Personal Ausente</p>
        </td>
      </tr>
    </table>

    <!-- Children Table -->
    <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
      Estudiantes con Inasistencia (${absentChildren.length})
    </h3>
    ${absentChildren.length > 0 ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <tr style="background-color: #f8fafc;">
          <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">Código</th>
          <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">Nombre Completo</th>
        </tr>
        ${absentChildren.map((c, i) => `
          <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 700; color: #2563eb; border-bottom: 1px solid #e2e8f0;">${escapeHtml(c.code)}</td>
            <td style="padding: 10px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">${escapeHtml(c.name)}</td>
          </tr>
        `).join("")}
      </table>
    ` : `<p style="margin: 0 0 24px 0; font-size: 13px; color: #059669; font-weight: 600;">✓ Asistencia completa de niños.</p>`}

    <!-- Staff Table -->
    <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
      Personal / Docentes Ausentes (${absentStaff.length})
    </h3>
    ${absentStaff.length > 0 ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <tr style="background-color: #f8fafc;">
          <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">Rol</th>
          <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">Nombre</th>
        </tr>
        ${absentStaff.map((s, i) => `
          <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">${escapeHtml(s.role)}</td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(s.name)}</td>
          </tr>
        `).join("")}
      </table>
    ` : `<p style="margin: 0 0 24px 0; font-size: 13px; color: #059669; font-weight: 600;">✓ Asistencia completa del personal.</p>`}

    <div style="text-align: center; margin: 20px 0 10px 0;">
      <a href="https://sistema-asistencia.vercel.app/attendance/historical" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700;">
        Ver Reporte Histórico Completo
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, `${totalAbsent} Ausencias`, totalAbsent > 0 ? "#dc2626" : "#059669", contentHtml);
  const subject = `[Reporte Diario] ${absentChildren.length} niños y ${absentStaff.length} colaboradores ausentes (${date})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// Notification: Auto-Mark Closure
// -----------------------------------------------------------------------------
export async function sendAutoMarkNotification(
  adminEmails: string[],
  type: "children" | "staff",
  count: number
): Promise<void> {
  const typeLabel = type === "children" ? "Niños / Estudiantes" : "Personal / Docentes";
  const title = `Auto-Cierre de Asistencia: ${count} ${typeLabel}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      El cronómetro automático institucional ha ejecutado el cierre de la jornada para <strong>${escapeHtml(typeLabel)}</strong>.
    </p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 32px; font-weight: 800; color: #1d4ed8;">${count}</p>
      <p style="margin: 6px 0 0; font-size: 13px; font-weight: 600; color: #2563eb;">
        Registros marcados automáticamente como ausentes por límite horario
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #64748b;">
      Hora del sistema: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}
    </p>
  `;

  const html = wrapEmailTemplate(title, "Auto-Cierre", "#2563eb", contentHtml);
  const subject = `[Auto-Cierre] Se marcaron ${count} ausencias automáticas (${type === "children" ? "Niños" : "Personal"})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// Notification: Backup Status
// -----------------------------------------------------------------------------
export async function sendBackupNotification(
  adminEmails: string[],
  success: boolean,
  details?: string
): Promise<void> {
  const title = success ? "Copia de Seguridad Completada con Éxito" : "Alerta: Error en Copia de Seguridad";

  const contentHtml = `
    <div style="background-color: ${success ? "#ecfdf5" : "#fef2f2"}; border: 1px solid ${success ? "#a7f3d0" : "#fecaca"}; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: ${success ? "#065f46" : "#991b1b"};">
        ${success ? "✓ Respaldo Institucional Exitoso" : "⚠ Error al generar el respaldo"}
      </p>
      <p style="margin: 0; font-size: 13px; color: ${success ? "#047857" : "#b91c1c"};">
        ${escapeHtml(details || (success ? "La base de datos institucional y los registros de asistencia fueron respaldados correctamente." : "Ocurrió un fallo durante el proceso de exportación y respaldo."))}
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #64748b;">
      Fecha y hora: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}
    </p>
  `;

  const html = wrapEmailTemplate(title, success ? "Backup OK" : "Fallo Backup", success ? "#059669" : "#dc2626", contentHtml);
  const subject = `[Backup Casita de Tareas] ${success ? "Completado con éxito" : "Fallo en respaldo"}`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// Test Email Function
// -----------------------------------------------------------------------------
export async function sendTestEmail(targetEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const title = "Prueba de Configuración de Correo Electrónico";
  const contentHtml = `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #065f46;">
        ¡Conexión Exitosa con el Servidor de Correo!
      </p>
      <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.5;">
        Este es un mensaje de prueba enviado desde el panel de configuración de <strong>Casita de Tareas</strong>.
        Indica que las credenciales de correo (SMTP o Resend) están configuradas y funcionando con normalidad.
      </p>
    </div>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;" width="40%">Destinatario:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(targetEmail)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">Proveedor Detectado:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #2563eb;">${process.env.RESEND_API_KEY ? "Resend REST API" : "Servidor SMTP / Nodemailer"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748b;">Fecha y Hora:</td>
        <td style="padding: 12px 18px; font-size: 13px; color: #334155;">${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
      </tr>
    </table>
  `;

  const html = wrapEmailTemplate(title, "Test Conexión", "#2563eb", contentHtml);
  const subject = "✓ Prueba Exitosa de Notificaciones - Casita de Tareas";
  return await sendEmail(targetEmail, subject, html);
}