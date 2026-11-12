import { NextRequest } from "next/server";

export function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Si CRON_SECRET aún no está definido en el entorno, permitir invocación de Vercel Cron
  if (!cronSecret) {
    return true;
  }

  // 1. Verificar cabecera Bearer estándar de Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 2. Permitir ejecución manual con secreto en query param
  const urlSecret = req.nextUrl.searchParams.get("secret");
  if (urlSecret === cronSecret) {
    return true;
  }

  return false;
}

export function getBogotaDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export function isBogotaWeekend(): boolean {
  const bogotaDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const day = bogotaDate.getDay();
  return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
}
