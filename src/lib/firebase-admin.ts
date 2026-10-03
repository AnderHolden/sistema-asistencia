import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let app: App | null = null;

export interface ServiceAccountCredentials {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
}

export function getFirebaseServiceAccount(): ServiceAccountCredentials | null {
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saRaw && saRaw.trim() && saRaw.trim() !== "{}") {
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(saRaw);
      } catch {
        // Fallback: parse as Base64 encoded JSON (recommended for Vercel env vars)
        const decoded = Buffer.from(saRaw, "base64").toString("utf8");
        parsed = JSON.parse(decoded);
      }

      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", err);
    }
  }

  // Fallback to individual variables if configured in Vercel
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sistema-asistencia-fb5f5",
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

function getApp(): App {
  if (app) return app;

  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const credentials = getFirebaseServiceAccount();
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT not configured or missing valid credentials");
  }

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "sistema-asistencia-fb5f5.firebasestorage.app";

  app = initializeApp({
    credential: cert({
      projectId: credentials.project_id || credentials.projectId,
      clientEmail: credentials.client_email || credentials.clientEmail,
      privateKey: credentials.private_key || credentials.privateKey,
    }),
    storageBucket,
  });

  return app;
}

export function getAdminDb() {
  return getFirestore(getApp());
}

export function getAdminAuth() {
  return getAuth(getApp());
}

export function getAdminStorage() {
  return getStorage(getApp());
}
