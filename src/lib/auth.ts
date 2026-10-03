import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import type { Profile } from "@/types/database";

const googleProvider = new GoogleAuthProvider();

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  if (typeof document !== "undefined") {
    document.cookie = "auth-session=true; path=/; max-age=2592000; SameSite=Lax";
  }
  return result;
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
  if (typeof document !== "undefined") {
    document.cookie = "auth-session=true; path=/; max-age=2592000; SameSite=Lax";
  }
  return result;
}

export async function signOut() {
  if (typeof document !== "undefined") {
    document.cookie = "auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
  await fbSignOut(getFirebaseAuth());
}

export async function getProfile(): Promise<Profile | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  const docRef = doc(getFirebaseDb(), "profiles", user.uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Profile;
}

export async function createProfile(
  uid: string,
  email: string,
  displayName: string,
  role: "super_admin" | "operator"
) {
  await setDoc(doc(getFirebaseDb(), "profiles", uid), {
    email,
    display_name: displayName,
    role,
    created_at: new Date().toISOString(),
  });
}
