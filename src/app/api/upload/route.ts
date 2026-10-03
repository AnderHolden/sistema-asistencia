import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { getFirebaseServiceAccount } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const collection = formData.get("collection") as string || "children";
    const entityId = formData.get("entityId") as string || "unknown";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const sa = getFirebaseServiceAccount();
    if (!sa || !sa.client_email || !sa.private_key) {
      return NextResponse.json({ error: "Service account not configured" }, { status: 500 });
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const bucketName = "sistema-asistencia-fb5f5.appspot.com";
    const fileName = `${collection}/${entityId}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

    const response = await client.request({
      url: uploadUrl,
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    });

    if (response.status !== 200) {
      throw new Error(`Storage returned ${response.status}`);
    }

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media`;

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("Upload API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
