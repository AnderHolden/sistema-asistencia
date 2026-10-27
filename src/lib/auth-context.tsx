"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
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

  function buildFallbackProfile(uid: string, firebaseUser: User | null): Profile {
    const email = firebaseUser?.email || "";
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
    const isAdmin = Boolean(adminEmail && email.toLowerCase() === adminEmail);
    return {
      id: uid,
      email,
      display_name: firebaseUser?.displayName || email?.split("@")[0] || "Usuario",
      role: isAdmin ? "super_admin" : "operator",
      avatar_url: firebaseUser?.photoURL || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function loadProfile(uid: string, firebaseUser: User) {
    try {
      const docRef = doc(getFirebaseDb(), "profiles", uid);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);

      if (!docSnap) {
        console.warn("[Auth] Timeout loading profile from Firestore, using fallback/cached profile");
        setProfile((prev) => prev || buildFallbackProfile(uid, firebaseUser));
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<Profile, "id">;
        const loadedProfile: Profile = { id: docSnap.id, ...data, role: data.role || "operator" } as Profile;
        setProfile(loadedProfile);
        if (typeof window !== "undefined") {
          localStorage.setItem(`cached_profile_${uid}`, JSON.stringify(loadedProfile));
        }
      } else {
        const fallback = buildFallbackProfile(uid, firebaseUser);
        const { id: _unusedId, ...profileData } = fallback;
        void _unusedId;
        await setDoc(docRef, profileData).catch((e) => console.warn("[Auth] Could not save new profile:", e));
        setProfile(fallback);
        if (typeof window !== "undefined") {
          localStorage.setItem(`cached_profile_${uid}`, JSON.stringify(fallback));
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      setProfile((prev) => prev || buildFallbackProfile(uid, firebaseUser));
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        document.cookie = "auth-session=true; path=/; max-age=2592000; SameSite=Lax";
        // Cargar perfil instantáneamente desde caché local si existe para no bloquear la interfaz
        let hasCached = false;
        if (typeof window !== "undefined") {
          const cachedRaw = localStorage.getItem(`cached_profile_${firebaseUser.uid}`);
          if (cachedRaw) {
            try {
              const cachedProfile = JSON.parse(cachedRaw) as Profile;
              if (cachedProfile && cachedProfile.id === firebaseUser.uid) {
                setProfile(cachedProfile);
                setLoading(false);
                hasCached = true;
              }
            } catch {
              /* ignore invalid cache */
            }
          }
        }
        if (hasCached) {
          // Actualizar en segundo plano sin bloquear la pantalla
          loadProfile(firebaseUser.uid, firebaseUser);
        } else {
          await loadProfile(firebaseUser.uid, firebaseUser);
          setLoading(false);
        }
      } else {
        document.cookie = "auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  function signOut() {
    document.cookie = "auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    if (typeof window !== "undefined" && user) {
      localStorage.removeItem(`cached_profile_${user.uid}`);
      sessionStorage.removeItem("dashboard_cache_v1");
    }
    import("firebase/auth").then(({ signOut: fbSignOut }) => {
      fbSignOut(getFirebaseAuth()).then(() => { window.location.href = "/login"; });
    });
  }

  return <AuthCtx.Provider value={{ user, profile, loading, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
