# Sistema de Gestión de Asistencia - Institución Infantil

Plataforma web moderna y progresiva (PWA) para el control digital integral de asistencia de niños, profesores y practicantes. Diseñada para operar en tiempo real y reemplazar planillas físicas.

Desplegado en producción en **Vercel** y respaldado por la infraestructura de **Google Firebase**.

---

## Características Principales

- **PWA Instalable:** Funciona como aplicación nativa en dispositivos móviles (Android/iOS) y computadoras de escritorio.
- **Asistencia de Niños:** Marcado rápido por grupos/jornadas, detección de inasistencias y autocierre programado.
- **Asistencia de Personal Docente y Practicantes:** Registro con firma digital táctil en pantalla y verificación horaria.
- **Flujo Avanzado de Correcciones:** Los operadores pueden solicitar correcciones de estado justificadas; los administradores pueden aprobar y aplicar el cambio con un solo clic o reiniciar registros.
- **Historial y Auditoría Completa:** Registro inmutable de cada acción (creación, edición, corrección, usuario responsable e IP).
- **Reportes y Estadísticas:** Gráficas en tiempo real, desglose mensual/anual y exportación a Excel (.xlsx) y PDF.
- **Seguridad y Control de Roles:** Autenticación robusta y control de acceso basado en roles (`super_admin`, `admin`, `operator`).
- **Modo Claro / Modo Oscuro:** Interfaz optimizada con Tailwind CSS y soporte de accesibilidad.

---

## Tecnologías Utilizadas

- **Framework Web:** [Next.js 16 (App Router)](https://nextjs.org/) con React 19 y TypeScript.
- **Estilos e Iconos:** [Tailwind CSS 4](https://tailwindcss.com/) y [Heroicons](https://heroicons.com/).
- **Plataforma Backend:** [Google Firebase](https://firebase.google.com/):
  - **Firebase Authentication:** Gestión de cuentas y sesiones seguras.
  - **Cloud Firestore:** Base de datos NoSQL reactiva en tiempo real con reglas de seguridad granulares.
  - **Firebase Storage:** Almacenamiento seguro de fotos y firmas digitales.
  - **Firebase Admin SDK:** Operaciones privilegiadas desde Serverless Functions.
- **Notificaciones por Correo:** [Nodemailer](https://nodemailer.com/) con soporte para cualquier proveedor SMTP.
- **Plataforma de Despliegue:** [Vercel](https://vercel.com/) con CI/CD automatizado en cada commit a `main`.

---

## Inicio Rápido (Desarrollo Local)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/AnderHolden/sistema-asistencia.git
cd sistema-asistencia
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Copia la plantilla `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
Completa las variables con las credenciales de tu proyecto de Firebase.

### 4. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## Despliegue en Producción (Vercel)

La guía detallada paso a paso para desplegar en **Vercel** y vincular **Firebase** se encuentra en:
📖 **[Guía de Despliegue en Producción (DEPLOYMENT.md)](./DEPLOYMENT.md)**

---

## Estructura del Proyecto

```
sistema-asistencia/
├── firestore.rules        # Reglas de seguridad de Cloud Firestore
├── cors.json              # Configuración CORS para Firebase Storage
├── DEPLOYMENT.md          # Manual de despliegue en Vercel y Firebase
├── .env.example           # Plantilla documentada de variables de entorno
└── src/
    ├── app/               # Páginas y API Routes (Next.js App Router)
    │   ├── attendance/    # Páginas de asistencia (niños, personal, histórico)
    │   ├── corrections/   # Panel administrativo de correcciones
    │   ├── children/      # Gestión de niños matriculados
    │   ├── teachers/      # Gestión de profesores
    │   ├── practitioners/ # Gestión de practicantes
    │   ├── groups/        # Gestión de grupos y salones
    │   ├── reports/       # Reportes y exportación
    │   ├── settings/      # Configuración del sistema
    │   └── api/           # Endpoints del servidor (upload, email, users)
    ├── components/        # Componentes UI reutilizables
    ├── lib/               # Clientes Firebase, utilidades y servicios
    └── types/             # Definiciones de tipos TypeScript
```

---

## Licencia

Este proyecto está bajo la Licencia MIT.