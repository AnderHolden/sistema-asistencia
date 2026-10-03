import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail, getEmailProviderInfo } from "@/lib/email";

export async function GET() {
  const info = getEmailProviderInfo();
  return NextResponse.json(info);
}

export async function POST(req: NextRequest) {
  try {
    const { targetEmail } = await req.json();
    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "Debe ingresar un correo electrónico de destino válido" },
        { status: 400 }
      );
    }

    const providerInfo = getEmailProviderInfo();
    if (!providerInfo.configured) {
      return NextResponse.json(
        {
          error:
            "No se han configurado credenciales de correo (SMTP o RESEND_API_KEY) en las variables de entorno de Vercel/servidor.",
          provider: providerInfo.provider,
        },
        { status: 400 }
      );
    }

    const result = await sendTestEmail(targetEmail.trim());
    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "No se pudo entregar el correo de prueba",
          provider: providerInfo.provider,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: providerInfo.provider,
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
