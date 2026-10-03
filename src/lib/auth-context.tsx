"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import type { Profile } from "@/types/database";

interface AuthCtxType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => void;
}

const AuthCtx = createContext<AuthCtxType>({ user: null, profile: null, loading: true, signOut: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        document.cookie = "auth-session=true; path=/; max-age=2592000; SameSite=Lax";
        await loadProfile(firebaseUser.uid);
      } else {
        document.cookie = "auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    try {
      console.log("[Auth] Loading profile for:", uid);
      const docRef = doc(getFirebaseDb(), "profiles", uid);
      const docSnap = await getDoc(docRef);
      console.log("[Auth] Profile exists:", docSnap.exists());
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<Profile, "id">;
        setProfile({ id: docSnap.id, ...data, role: data.role || "operator" } as Profile);
      } else {
        // Create profile for new user with default operator role
        console.log("[Auth] Creating new profile for:", uid);
        const currentUser = getFirebaseAuth().currentUser;
        const email = currentUser?.email || "";
        
        let isFirstUser = false;
        try {
          const profilesSnap = await getDocs(collection(getFirebaseDb(), "profiles"));
          isFirstUser = profilesSnap.empty;
        } catch (readErr) {
          // If security rules prevent standard users from reading all profiles,
          // safely default to operator role without crashing.
          console.warn("[Auth] Could not check profiles collection, defaulting to operator:", readErr);
          isFirstUser = false;
        }

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
        const isAdmin = (adminEmail && email.toLowerCase() === adminEmail) || isFirstUser;

        const newProfile = {
          email,
          display_name: currentUser?.displayName || email?.split("@")[0] || "Usuario",
          role: isAdmin ? ("super_admin" as const) : ("operator" as const),
          avatar_url: currentUser?.photoURL || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        console.log("[Auth] Creating profile:", newProfile);
        await setDoc(docRef, newProfile);
        console.log("[Auth] Profile created successfully");
        setProfile({ id: uid, ...newProfile });
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      setProfile(null);
    }
  }

  function signOut() {
    document.cookie = "auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    import("firebase/auth").then(({ signOut: fbSignOut }) => {
      fbSignOut(getFirebaseAuth()).then(() => { window.location.href = "/login"; });
    });
  }

  return <AuthCtx.Provider value={{ user, profile, loading, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
