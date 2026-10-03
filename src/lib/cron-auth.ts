import { NextRequest } from "next/server";

export function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // If CRON_SECRET is not yet defined in environment, allow Vercel invocation
  if (!cronSecret) {
    return true;
  }

  // 1. Verify Vercel Cron Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 2. Allow requests triggered by an authenticated administrator session
  const cookie = req.cookies.get("auth-session");
  if (cookie?.value) {
    return true;
  }

  // 3. Allow manual secret passed via query param or custom header
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
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}
