import nodemailer from "nodemailer";

export interface EmailConfig {
  provider: "resend" | "smtp" | "none";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  resendApiKey: string;
  resendFrom: string;
  directorEmail: string;
  notifyGuardiansEnabled: boolean;
  notifyDailyReportEnabled: boolean;
}

let cachedSettings: { data: Record<string, string>; timestamp: number } | null = null;

async function getStoredSettings(): Promise<Record<string, string>> {
  // Cache settings for 10 seconds to avoid hitting Firestore on rapid calls
  if (cachedSettings && Date.now() - cachedSettings.timestamp < 10000) {
    return cachedSettings.data;
  }

  try {
    const { getAdminDb } = await import("@/lib/firebase-admin");
    const snap = await getAdminDb().collection("system_settings").get();
    const map: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data && data.setting_key && data.setting_value !== undefined && data.setting_value !== null) {
        map[data.setting_key] = String(data.setting_value).trim();
      }
    });
    cachedSettings = { data: map, timestamp: Date.now() };
    return map;
  } catch (err) {
    // If Firebase Admin is not yet initialized or unreachable, gracefully return empty map
    return {};
  }
}

export async function resolveEmailConfig(override?: Partial<Record<string, string>>): Promise<EmailConfig> {
  const db = await getStoredSettings();
  const getVal = (key: string, envVal?: string): string => {
    if (override && override[key] !== undefined) return String(override[key]);
    if (db[key]) return db[key];
    return envVal || "";
  };

  const resendApiKey = getVal("resend_api_key", process.env.RESEND_API_KEY);
  const resendFrom = getVal("resend_from", process.env.RESEND_FROM) || "Casita de Tareas <onboarding@resend.dev>";

  const host = getVal("smtp_host", process.env.SMTP_HOST);
  const port = parseInt(getVal("smtp_port", process.env.SMTP_PORT || "587"), 10) || 587;
  const secureVal = getVal("smtp_secure", process.env.SMTP_SECURE);
  const secure = secureVal === "true" || port === 465;
  const user = getVal("smtp_user", process.env.SMTP_USER);
  const pass = getVal("smtp_pass", process.env.SMTP_PASS);
  const from = getVal("smtp_from", process.env.SMTP_FROM) || user;

  const forcedProvider = getVal("email_provider", "");
  const directorEmail = getVal("director_notification_email", getVal("institution_email", "direccion@casitadetareas.com"));
  const notifyGuardiansVal = getVal("notify_guardians_enabled", "true");
  const notifyDailyReportVal = getVal("notify_admin_daily_report", "true");

  let provider: "resend" | "smtp" | "none" = "none";
  if (forcedProvider === "resend" && resendApiKey) {
    provider = "resend";
  } else if (forcedProvider === "smtp" && host && user && pass) {
    provider = "smtp";
  } else if (resendApiKey) {
    provider = "resend";
  } else if (host && user && pass) {
    provider = "smtp";
  }

  return {
    provider,
    host,
    port,
    secure,
    user,
    pass,
    from: from || (provider === "resend" ? resendFrom : "Casita de Tareas <notificaciones@casitadetareas.com>"),
    resendApiKey,
    resendFrom,
    directorEmail,
    notifyGuardiansEnabled: notifyGuardiansVal !== "false",
    notifyDailyReportEnabled: notifyDailyReportVal !== "false",
  };
}

export async function isEmailConfigured(): Promise<boolean> {
  const cfg = await resolveEmailConfig();
  return cfg.provider !== "none";
}

export async function getEmailProviderInfo(override?: Partial<Record<string, string>>): Promise<{
  configured: boolean;
  provider: "resend" | "smtp" | "none";
  from: string;
  directorEmail: string;
  notifyGuardiansEnabled: boolean;
  notifyDailyReportEnabled: boolean;
}> {
  const cfg = await resolveEmailConfig(override);
  return {
    configured: cfg.provider !== "none",
    provider: cfg.provider,
    from: cfg.from,
    directorEmail: cfg.directorEmail,
    notifyGuardiansEnabled: cfg.notifyGuardiansEnabled,
    notifyDailyReportEnabled: cfg.notifyDailyReportEnabled,
  };
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  configOverride?: Partial<Record<string, string>>
): Promise<{ success: boolean; messageId?: string; error?: string; provider?: string }> {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    return { success: false, error: "No se especificaron destinatarios válidos." };
  }

  const config = await resolveEmailConfig(configOverride);

  if (config.provider === "none") {
    console.warn("Email service is not configured (missing SMTP or Resend credentials).");
    return {
      success: false,
      error: "Servicio de correo no configurado. Configure SMTP o Resend en Ajustes > Notificaciones.",
    };
  }

  // 1. Resend API
  if (config.provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.resendFrom || "Casita de Tareas <onboarding@resend.dev>",
          to: recipients,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ""),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Resend API error:", data);
        return { success: false, error: data.message || "Error al enviar correo con Resend API." };
      }
      return { success: true, messageId: data.id, provider: "resend" };
    } catch (err: unknown) {
      console.error("Resend HTTP request failed:", err);
      return { success: false, error: err instanceof Error ? err.message : "Fallo de conexión con Resend" };
    }
  }

  // 2. SMTP Transporter
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: config.from.includes("<") ? config.from : `Casita de Tareas <${config.from}>`,
      to: recipients.join(", "),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    return { success: true, messageId: info.messageId, provider: "smtp" };
  } catch (err: unknown) {
    console.error("SMTP send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido en el servidor SMTP",
      provider: "smtp",
    };
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
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 26px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          <!-- 4-Color Top Brand Stripe -->
          <tr>
            <td style="padding: 0; line-height: 0; font-size: 0; height: 6px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="height: 6px;">
                <tr>
                  <td width="25%" style="background-color: #E53935; height: 6px;"></td>
                  <td width="25%" style="background-color: #FBC02D; height: 6px;"></td>
                  <td width="25%" style="background-color: #2E7D32; height: 6px;"></td>
                  <td width="25%" style="background-color: #1E40AF; height: 6px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E40AF 0%, #172554 100%); padding: 22px 28px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: block; font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
                      Casita de Tareas
                    </span>
                    <span style="display: block; margin-top: 4px; color: #FDE047; font-size: 12px; font-weight: 600; font-style: italic;">
                      &ldquo;La Alegría del Conocimiento, Enseñando con Amor&rdquo;
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: ${badgeBg}; color: #ffffff; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 28px 24px 28px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 800; line-height: 1.35;">
                ${escapeHtml(title)}
              </h2>
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #1E40AF;">
                Fundación Casita de Tareas · Refuerzo Escolar y Formación Integral
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                Mensaje generado automáticamente por el Sistema Institucional. Por favor no responder a este buzón.
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
// 1. Notification: Guardian Absence Alert (Alerta a Acudiente)
// -----------------------------------------------------------------------------
export async function sendGuardianAbsenceAlert(params: {
  guardianName?: string;
  guardianEmail: string;
  childName: string;
  childCode?: string;
  date: string;
  shift?: string;
  reason?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { guardianName, guardianEmail, childName, childCode, date, shift, reason } = params;

  const shiftLabel =
    shift === "tarde" ? "Jornada de la Tarde" : shift === "manana" ? "Jornada de la Mañana" : "Jornada Regular";

  const title = `Aviso de Inasistencia: ${childName}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
      Estimado(a) acudiente <strong>${escapeHtml(guardianName || "de familia")}</strong>:
    </p>

    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #E53935; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
      <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #991B1B;">
        Registro de Inasistencia de Hoy
      </p>
      <p style="margin: 0; font-size: 13px; color: #B91C1C; line-height: 1.5;">
        Le informamos que el día de hoy (<strong>${escapeHtml(date)}</strong>) no se registró la asistencia presencial del estudiante <strong>${escapeHtml(childName)}</strong> a su horario habitual en Casita de Tareas.
      </p>
    </div>

    <!-- Details Table -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 22px; overflow: hidden;">
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 12.5px; font-weight: 700; color: #64748B;" width="40%">Estudiante:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: 800; color: #0F172A;">${escapeHtml(childName)}</td>
      </tr>
      ${childCode ? `
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 12.5px; font-weight: 700; color: #64748B;">Código Institucional:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; font-weight: 700; color: #1E40AF;">${escapeHtml(childCode)}</td>
      </tr>
      ` : ""}
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 12.5px; font-weight: 700; color: #64748B;">Jornada:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; font-weight: 600; color: #334155;">${escapeHtml(shiftLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 12.5px; font-weight: 700; color: #64748B;">Fecha:</td>
        <td style="padding: 12px 18px; font-size: 13.5px; font-weight: 600; color: #334155;">${escapeHtml(date)}</td>
      </tr>
      ${reason ? `
      <tr>
        <td style="padding: 12px 18px; border-top: 1px solid #E2E8F0; font-size: 12.5px; font-weight: 700; color: #64748B;">Observación:</td>
        <td style="padding: 12px 18px; border-top: 1px solid #E2E8F0; font-size: 13px; font-style: italic; color: #475569;">${escapeHtml(reason)}</td>
      </tr>
      ` : ""}
    </table>

    <!-- Recommendation Box -->
    <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1E40AF;">
        ¿Se trata de una inasistencia justificada?
      </p>
      <p style="margin: 0; font-size: 12.5px; color: #1E3A8A; line-height: 1.55;">
        Para Casita de Tareas la seguridad y bienestar de cada niño es nuestra prioridad. Si el estudiante se ausentó por motivo médico, familiar o fuerza mayor, por favor póngase en contacto con la docente titular o envíenos el soporte para justificar su registro.
      </p>
    </div>

    <!-- Contact details -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-top: 10px;">
      <tr>
        <td style="font-size: 12px; color: #64748B;">
          Línea de Atención Institucional: <strong>(+57) 310 854 9210</strong> · Sede Principal Centro
        </td>
      </tr>
    </table>
  `;

  const html = wrapEmailTemplate(title, "Alerta Inasistencia", "#E53935", contentHtml);
  const subject = `[Casita de Tareas] Registro de inasistencia para ${childName} (${date})`;
  return await sendEmail(guardianEmail, subject, html);
}

// -----------------------------------------------------------------------------
// 2. Notification: New Correction Request (To Super Admins)
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
  const statusLabel =
    newStatus === "present"
      ? "Marcar Como Presente"
      : newStatus === "absent"
      ? "Marcar Como Ausente"
      : "Corrección solicitada";

  const contentHtml = `
    <p style="margin: 0 0 18px 0; font-size: 14.5px; line-height: 1.6; color: #475569;">
      Se ha radicado una nueva solicitud de corrección de asistencia en la plataforma que requiere su revisión y aprobación directiva.
    </p>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;" width="40%">Persona / Estudiante:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(childName)}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;">Código / Identificador:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #1E40AF;">${escapeHtml(childCode)}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;">Fecha de Asistencia:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${escapeHtml(date)}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;">Acción Solicitada:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 800; color: #2E7D32;">${escapeHtml(statusLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; font-weight: 700; color: #64748b; vertical-align: top;">Motivo / Justificación:</td>
        <td style="padding: 14px 18px; font-size: 13px; color: #334155; line-height: 1.5; font-style: italic;">&ldquo;${escapeHtml(reason)}&rdquo;</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 24px 0 12px 0;">
      <a href="https://sistema-asistencia-theta.vercel.app/corrections" style="display: inline-block; background-color: #1E40AF; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.25);">
        Revisar Solicitud en el Panel
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, "Solicitud Pendiente", "#F59E0B", contentHtml);
  const subject = `[Corrección Asistencia] Solicitud para ${childName} (${childCode})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// 3. Notification: Correction Resolution (To Operator who requested it)
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
  const badgeBg = approved ? "#2E7D32" : "#E53935";

  const contentHtml = `
    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Le informamos que la solicitud de corrección de asistencia para <strong>${escapeHtml(childName)}</strong> ha sido revisada por la administración institucional.
    </p>

    <div style="background-color: ${approved ? "#ECFDF5" : "#FEF2F2"}; border: 1px solid ${approved ? "#A7F3D0" : "#FECACA"}; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: ${approved ? "#065F46" : "#991B1B"};">
        Estado de la Solicitud: ${approved ? "Aprobada Satisfactoriamente" : "No Aprobada / Rechazada"}
      </p>
      <p style="margin: 0; font-size: 13px; color: ${approved ? "#047857" : "#B91C1C"};">
        ${approved
          ? "El registro de asistencia ha sido corregido conforme a su solicitud."
          : "La solicitud no fue aprobada con los datos suministrados. Revise las observaciones a continuación."}
      </p>
    </div>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;" width="40%">Persona / Estudiante:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(childName)} (${escapeHtml(childCode)})</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #64748b;">Fecha Asistencia:</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${escapeHtml(date)}</td>
      </tr>
      ${adminNote ? `
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; font-weight: 700; color: #64748b; vertical-align: top;">Observación Dirección:</td>
        <td style="padding: 14px 18px; font-size: 13px; color: #334155; line-height: 1.5;">${escapeHtml(adminNote)}</td>
      </tr>
      ` : ""}
    </table>

    <div style="text-align: center; margin: 22px 0 10px 0;">
      <a href="https://sistema-asistencia-theta.vercel.app/attendance/children" style="display: inline-block; background-color: #1E40AF; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700;">
        Ir a Control de Asistencias
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, badgeText, badgeBg, contentHtml);
  const subject = `[Resolución] Corrección ${badgeText.toLowerCase()} - ${childName} (${childCode})`;
  await sendEmail(operatorEmail, subject, html);
}

// -----------------------------------------------------------------------------
// 4. Notification: Daily Absence Report (Consolidado Diario a Dirección)
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
    <p style="margin: 0 0 18px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
      A continuación se presenta el consolidado oficial de inasistencias registradas durante la jornada de hoy (<strong>${escapeHtml(date)}</strong>).
    </p>

    <!-- Summary Box -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
      <tr>
        <td width="48%" style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 26px; font-weight: 800; color: #1E40AF;">${absentChildren.length}</p>
          <p style="margin: 4px 0 0; font-size: 12.5px; font-weight: 700; color: #2563EB;">Niños Ausentes</p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 26px; font-weight: 800; color: #E53935;">${absentStaff.length}</p>
          <p style="margin: 4px 0 0; font-size: 12.5px; font-weight: 700; color: #DC2626;">Personal Ausente</p>
        </td>
      </tr>
    </table>

    <!-- Children Table -->
    <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0F172A;">
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
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 700; color: #1E40AF; border-bottom: 1px solid #e2e8f0;">${escapeHtml(c.code)}</td>
            <td style="padding: 10px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">${escapeHtml(c.name)}</td>
          </tr>
        `).join("")}
      </table>
    ` : `<p style="margin: 0 0 24px 0; font-size: 13px; color: #2E7D32; font-weight: 700;">✓ Asistencia completa de niños hoy.</p>`}

    <!-- Staff Table -->
    <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0F172A;">
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
            <td style="padding: 10px 16px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">${escapeHtml(s.role)}</td>
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(s.name)}</td>
          </tr>
        `).join("")}
      </table>
    ` : `<p style="margin: 0 0 24px 0; font-size: 13px; color: #2E7D32; font-weight: 700;">✓ Asistencia completa del personal hoy.</p>`}

    <div style="text-align: center; margin: 20px 0 10px 0;">
      <a href="https://sistema-asistencia-theta.vercel.app/attendance/historical" style="display: inline-block; background-color: #1E40AF; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700;">
        Ver Reporte Histórico Completo
      </a>
    </div>
  `;

  const html = wrapEmailTemplate(title, `${totalAbsent} Ausencias`, totalAbsent > 0 ? "#E53935" : "#2E7D32", contentHtml);
  const subject = `[Reporte Diario] ${absentChildren.length} niños y ${absentStaff.length} colaboradores ausentes (${date})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// 5. Notification: Auto-Mark Closure (Auto-Cierre)
// -----------------------------------------------------------------------------
export async function sendAutoMarkNotification(
  adminEmails: string[],
  type: "children" | "staff",
  count: number
): Promise<void> {
  const typeLabel = type === "children" ? "Niños / Estudiantes" : "Personal / Docentes";
  const title = `Auto-Cierre de Asistencia: ${count} ${typeLabel}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #475569;">
      El cronómetro automático institucional ha ejecutado el cierre de la jornada para <strong>${escapeHtml(typeLabel)}</strong>.
    </p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 32px; font-weight: 800; color: #1E40AF;">${count}</p>
      <p style="margin: 6px 0 0; font-size: 13px; font-weight: 700; color: #2563EB;">
        Registros marcados automáticamente como ausentes por límite horario
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #64748b;">
      Hora del sistema: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}
    </p>
  `;

  const html = wrapEmailTemplate(title, "Auto-Cierre", "#1E40AF", contentHtml);
  const subject = `[Auto-Cierre] Se marcaron ${count} ausencias automáticas (${type === "children" ? "Niños" : "Personal"})`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// 6. Notification: Backup Status
// -----------------------------------------------------------------------------
export async function sendBackupNotification(
  adminEmails: string[],
  success: boolean,
  details?: string
): Promise<void> {
  const title = success ? "Copia de Seguridad Completada con Éxito" : "Alerta: Error en Copia de Seguridad";

  const contentHtml = `
    <div style="background-color: ${success ? "#ecfdf5" : "#fef2f2"}; border: 1px solid ${success ? "#a7f3d0" : "#fecaca"}; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 800; color: ${success ? "#065f46" : "#991b1b"};">
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

  const html = wrapEmailTemplate(title, success ? "Backup OK" : "Fallo Backup", success ? "#2E7D32" : "#E53935", contentHtml);
  const subject = `[Backup Casita de Tareas] ${success ? "Completado con éxito" : "Fallo en respaldo"}`;
  await sendEmail(adminEmails, subject, html);
}

// -----------------------------------------------------------------------------
// 7. Test Email Function
// -----------------------------------------------------------------------------
export async function sendTestEmail(
  targetEmail: string,
  configOverride?: Partial<Record<string, string>>
): Promise<{ success: boolean; messageId?: string; error?: string; provider?: string }> {
  const title = "Prueba de Configuración de Correo Electrónico";
  const config = await resolveEmailConfig(configOverride);

  const contentHtml = `
    <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 800; color: #065F46;">
        ¡Conexión Exitosa con el Servidor de Correo!
      </p>
      <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.55;">
        Este es un mensaje de prueba enviado en tiempo real desde el panel de control institucional de <strong>Casita de Tareas</strong>.
        Indica que las credenciales de correo (${config.provider.toUpperCase()}) están configuradas y funcionando con normalidad.
      </p>
    </div>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 700; color: #64748B;" width="40%">Destinatario de Prueba:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; font-weight: 800; color: #0F172A;">${escapeHtml(targetEmail)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 700; color: #64748B;">Proveedor Utilizado:</td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; font-weight: 800; color: #1E40AF;">
          ${config.provider === "resend" ? "Resend REST API" : `Servidor SMTP (${config.host}:${config.port})`}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; font-size: 13px; font-weight: 700; color: #64748B;">Fecha y Hora:</td>
        <td style="padding: 12px 18px; font-size: 13px; color: #334155;">${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
      </tr>
    </table>

    <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 14px 18px;">
      <p style="margin: 0; font-size: 12px; color: #92400E; line-height: 1.5;">
        💡 <strong>Recomendación:</strong> Si utilizas una cuenta de Gmail institucional o personal, recuerda que Google exige utilizar una <strong>Contraseña de Aplicación de 16 caracteres</strong> generada en la configuración de seguridad de Google.
      </p>
    </div>
  `;

  const html = wrapEmailTemplate(title, "Test Conexión", "#1E40AF", contentHtml);
  const subject = "✓ Prueba Exitosa de Notificaciones - Casita de Tareas";
  return await sendEmail(targetEmail, subject, html, undefined, configOverride);
}