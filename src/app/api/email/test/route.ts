import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail, getEmailProviderInfo } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const info = await getEmailProviderInfo();
    return NextResponse.json(info);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener diagnóstico de correo" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetEmail, configOverride } = body;

    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "Debe ingresar un correo electrónico de destino válido" },
        { status: 400 }
      );
    }

    const providerInfo = await getEmailProviderInfo(configOverride);
    if (!providerInfo.configured) {
      return NextResponse.json(
        {
          error:
            "No se han detectado credenciales de correo (configure SMTP o Resend en los campos de Ajustes o en variables de entorno).",
          provider: providerInfo.provider,
        },
        { status: 400 }
      );
    }

    const result = await sendTestEmail(targetEmail.trim(), configOverride);
    if (!result.success) {
      let friendlyError = result.error || "No se pudo entregar el correo de prueba";
      if (friendlyError.includes("EAUTH") || friendlyError.includes("BadCredentials") || friendlyError.includes("Username and Password not accepted")) {
        friendlyError = "Error de autenticación: El usuario o contraseña es incorrecto. Si usa Gmail, debe generar una Contraseña de Aplicación de 16 caracteres en myaccount.google.com/apppasswords.";
      } else if (friendlyError.includes("ESOCKET") || friendlyError.includes("ETIMEDOUT") || friendlyError.includes("ECONNREFUSED")) {
        friendlyError = "Error de conexión con el servidor de correo: Verifique el Host y Puerto (use 465 con SSL o 587 con TLS).";
      }

      return NextResponse.json(
        {
          error: friendlyError,
          provider: result.provider || providerInfo.provider,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider || providerInfo.provider,
      messageId: result.messageId,
      sentTo: targetEmail.trim(),
    });
  } catch (err: unknown) {
    console.error("Error in email test route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
