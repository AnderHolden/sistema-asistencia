"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function getRedirectTarget() {
    if (typeof window !== "undefined") {
      const target = new URLSearchParams(window.location.search).get("redirect");
      if (target && target.startsWith("/")) return target;
    }
    return "/dashboard";
  }

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getRedirectTarget());
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Bienvenido al sistema");
      router.push(getRedirectTarget());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Bienvenido al sistema");
      router.push(getRedirectTarget());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error con Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12 animate-fade-in-up">
          <div className="w-32 h-32 mx-auto mb-6 bg-white rounded-3xl p-2.5 shadow-2xl flex items-center justify-center border border-white/40">
            <img
              src="/logo.png"
              alt="Casita de Tareas"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Casita de Tareas</h1>
          <p className="text-amber-300 text-lg font-bold tracking-wide mb-3">La alegría del conocimiento</p>
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#E53935] text-white shadow-md mb-6 border border-white/20">
            <span role="img" aria-label="Amor">❤️</span>
            <span>Enseñando con amor</span>
          </div>
          <p className="text-white/85 text-sm max-w-md mx-auto leading-relaxed font-medium">
            Plataforma institucional de asistencia, seguimiento académico y gestión de practicantes y docentes.
          </p>
          <div className="mt-10 flex justify-center gap-8">
            <div className="text-center"><div className="text-2xl font-bold text-white">Niños</div><div className="text-white/70 text-xs">Estudiantes</div></div>
            <div className="w-px bg-white/20" />
            <div className="text-center"><div className="text-2xl font-bold text-white">Personal</div><div className="text-white/70 text-xs">Docentes y Prácticas</div></div>
            <div className="w-px bg-white/20" />
            <div className="text-center"><div className="text-2xl font-bold text-white">Oficial</div><div className="text-white/70 text-xs">Certificados</div></div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-gray-50 dark:bg-[#0c1220]">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-3 bg-white p-2 rounded-2xl shadow-md border border-blue-100 flex items-center justify-center">
              <img src="/logo.png" alt="Casita de Tareas" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-extrabold text-blue-900 dark:text-white">Casita de Tareas</h2>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">La alegría del conocimiento • Enseñando con amor</p>
          </div>

          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-8 sm:p-10 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5">Bienvenido</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Ingresa tus credenciales para acceder al sistema institucional</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Correo electronico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" aria-hidden="true">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input id="login-email" type="email" placeholder="correo@institucion.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" required />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contrasena</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" aria-hidden="true">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input id="login-password" type={showPassword ? "text" : "password"} placeholder="Ingresa tu contrasena" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {showPassword ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3.5 px-6 bg-[#E53935] hover:bg-[#D32F2F] text-white font-bold rounded-xl shadow-lg shadow-red-500/25 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Iniciando sesion...
                  </span>
                ) : "Iniciar Sesion"}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-[#1a2438] text-gray-400">o continua con</span>
                </div>
              </div>
              <button onClick={handleGoogleLogin} disabled={loading} className="mt-4 w-full py-3 px-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Iniciar sesion con Google
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">Sistema de Gestion de Asistencia v1.0</p>
        </div>
      </div>
    </div>
  );
}
