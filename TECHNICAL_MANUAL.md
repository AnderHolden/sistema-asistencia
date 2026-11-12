# Manual Técnico — Sistema de Gestión de Asistencia (Casita de Tareas)

## 1. Descripción General y Arquitectura

El **Sistema de Gestión de Asistencia de Casita de Tareas** es una **Aplicación Web Progresiva (PWA)** diseñada para el control integral de asistencia de niños, docentes y practicantes, generación de certificaciones oficiales, reportes estadísticos en PDF/Excel/CSV y auditoría de operaciones en tiempo real.

### Stack Tecnológico
- **Framework Web:** Next.js `16.2.11` (App Router) con React `19.2.4` y TypeScript `5`
- **Estilos y UI:** Tailwind CSS `4`, Heroicons `2.2.0`, Recharts `3.10.0` (gráficas dinámicas) y `react-hot-toast`
- **Generación de Documentos:** `jspdf` `4.2.1` + `jspdf-autotable` `5.0.8` (certificados y reportes PDF) y `xlsx` `0.18.5` (exportación Excel/CSV)
- **Backend como Servicio (BaaS):** Google Firebase
  - **Firebase Authentication:** Autenticación por correo y contraseña
  - **Cloud Firestore:** Base de datos NoSQL en tiempo real con reglas de seguridad por rol
  - **Firebase Storage:** Almacenamiento de fotografías y firmas digitales
  - **Firebase Admin SDK (`firebase-admin`):** Creación de usuarios y operaciones privilegiadas desde Serverless Functions
- **Notificaciones por Correo:** `nodemailer` `9.0.5` vía SMTP (configurable en variables de entorno o en `system_settings`)
- **Despliegue y Automatización:** Vercel (Frontend, API Routes y Cron Jobs programados en `vercel.json`)
- **PWA Offline / Caché:** Web App Manifest (`public/manifest.json`) + Service Worker (`public/sw.js`, versión `asistencia-v3` con estrategia **Network-First**)

---

## 2. Estructura del Proyecto

```text
sistema-asistencia/
├── .env.example                 # Plantilla de variables de entorno
├── cors.json                    # Configuración CORS para Firebase Storage
├── DEPLOYMENT.md                # Guía de despliegue en Vercel y Firebase
├── DELIVERY_CHECKLIST.md        # Acta de entrega, pruebas UAT y mantenimiento anual
├── firestore.rules              # Reglas de seguridad de Cloud Firestore
├── SECURITY.md                  # Políticas de seguridad y privacidad
├── TECHNICAL_MANUAL.md          # Este manual técnico
├── USER_MANUAL.md               # Manual operativo para SuperAdmin y Operadores
├── vercel.json                  # Programación de Cron Jobs (Lunes a Viernes)
├── public/
│   ├── manifest.json            # Manifiesto PWA (nombre, colores, íconos)
│   ├── sw.js                    # Service Worker (estrategia Network-First, asistencia-v3)
│   ├── logo.png / logo-doc.png  # Logos institucionales de Casita de Tareas
│   └── icons/                   # Íconos PNG (favicon-32x32, apple-touch-icon, 192, 512, maskable)
└── src/
    ├── middleware.ts            # Redirección temprana a /login si falta cookie auth-session
    ├── types/database.ts        # Interfaces TypeScript de todas las entidades
    ├── app/
    │   ├── layout.tsx           # Metadatos PWA, favicon, viewport y script de tema oscuro
    │   ├── client-provider.tsx  # Shell de la aplicación, Sidebar, Header, NotificationBell
    │   ├── login/               # Inicio de sesión
    │   ├── dashboard/           # Panel principal con métricas y caché de sesión
    │   ├── attendance/
    │   │   ├── children/        # Toma de asistencia diaria de niños y solicitudes de corrección
    │   │   ├── staff/           # Asistencia de profesores y practicantes con firma táctil
    │   │   └── historical/      # Registro y consulta histórica (solo super_admin)
    │   ├── children/            # Directorio de niños (CRUD, códigos CT001..., carnets)
    │   ├── groups/              # Grupos y niveles (solo super_admin)
    │   ├── teachers/            # Directorio de profesores
    │   ├── practitioners/       # Directorio de practicantes
    │   ├── certificates/        # Centro de Certificados y Constancias PDF (niños, practicantes, profesores)
    │   ├── reports/             # Reportes Consolidados, Por Fecha (Desde-Hasta) y Por Persona
    │   ├── corrections/         # Aprobación/rechazo de justificaciones (solo super_admin)
    │   ├── audit/               # Bitácora inmutable de auditoría (solo super_admin)
    │   ├── users/               # Gestión de usuarios y roles (solo super_admin)
    │   ├── settings/            # Perfil institucional, horarios, SMTP y festivos (solo super_admin)
    │   └── api/
    │       ├── cron/
    │       │   ├── auto-mark-children/   # Cierre automático de asistencia infantil
    │       │   ├── auto-mark-staff/      # Cierre automático de asistencia de personal
    │       │   └── daily-absence-report/ # Envío diario de reporte de inasistencias
    │       ├── email/           # Endpoints de envío de correos (ausencias, correcciones, pruebas)
    │       ├── upload/          # Subida de archivos a Storage
    │       └── users/create/    # Creación segura de cuentas Auth + Firestore (solo super_admin)
    ├── components/              # Componentes UI, gráficas dinámicas, campana de notificaciones
    └── lib/
        ├── firebase.ts          # Cliente Firebase (Auth, Firestore, Storage)
        ├── firebase-admin.ts    # SDK Admin para API Routes
        ├── auth-context.tsx     # Contexto de sesión con caché localStorage y timeout de 5s
        ├── attendance.ts        # Lógica de asistencia
        ├── certificates.ts      # Generación de certificados PDF institucionales
        ├── corrections.ts       # Flujo de solicitudes de justificación/corrección
        ├── cron-auth.ts         # Validación de CRON_SECRET y zona horaria America/Bogota
        ├── email.ts             # Transporte SMTP con Nodemailer
        ├── export.ts            # Exportación Excel, CSV, PDF consolidado y PDF individual 1 hoja
        ├── audit.ts             # Registro de auditoría
        └── utils.ts             # Utilidades de fecha, festivos de Colombia (Ley Emiliani) y días hábiles
```

---

## 3. Modelo de Datos (Cloud Firestore)

1. **`profiles/{uid}`**
   - `email`: string
   - `display_name`: string
   - `role`: `"super_admin"` | `"operator"`
   - `avatar_url`: string | null
   - `created_at`, `updated_at`: string (ISO)

2. **`children/{childId}`**
   - `child_id_code`: string (ej. `"CT001"`)
   - `first_name`, `last_name`: string
   - `document`, `document_type`: string | null
   - `guardian_name`, `guardian_phone`, `guardian_email`: string | null
   - `date_of_birth`: string (`YYYY-MM-DD`), `age`: number
   - `group_id`: string | null (referencia a `groups`)
   - `shift`: string (`"Mañana"` | `"Tarde"` | `"Completa"`)
   - `status`: `"active"` | `"inactive"`
   - `photo_url`: string | null, `enrollment_date`: string

3. **`groups/{groupId}`**
   - `name`: string, `description`: string | null

4. **`teachers/{teacherId}`** y **`practitioners/{practitionerId}`**
   - `first_name`, `last_name`, `document`, `document_type`, `email`, `phone`, `role`, `status`
   - En `teachers`: `job_title`, `contract_type`, `hire_date`, `end_date`, `salary`
   - En `practitioners`: `university`, `career`, `supervisor_name`, `daily_hours`, `study`, `start_date`, `end_date`

5. **`attendance_children/{docId}`**
   - `child_id`: string, `attendance_date`: string (`YYYY-MM-DD`)
   - `status`: `"present"` | `"absent"`
   - `check_in`: string | null, `registered_by`: string | null

6. **`attendance_staff/{docId}`**
   - `staff_id`: string, `staff_type`: `"teacher"` | `"practitioner"`
   - `attendance_date`: string (`YYYY-MM-DD`)
   - `check_in`, `check_out`: string | null
   - `status`: `"present"` | `"absent"` | null
   - `signature_url`: string | null (firma digital)
   - `auto_marked`: boolean | null

7. **`correction_requests/{docId}`** y **`correction_requests_children/{docId}`**
   - Solicitudes de corrección/justificación enviadas por operadores y resueltas (`pending` -> `approved` / `rejected`) por `super_admin`.

8. **`holidays/{holidayId}`**
   - `holiday_date`: string (`YYYY-MM-DD`), `name` / `description`: string. Complementa los festivos oficiales de Colombia calculados automáticamente en `src/lib/utils.ts` (`getColombianHolidays` con Ley 51 de 1983 / Ley Emiliani y Pascua).

9. **`system_settings/{settingId}`**
   - Pares `setting_key` / `setting_value` para datos institucionales (nombre, NIT, eslogan, dirección, ciudad, teléfono, correo, representante legal, firma, horarios de jornada y configuración SMTP).

10. **`audit_logs/{logId}`**
    - Registro inmutable (`allow update, delete: if false`) con `user_id`, `user_email`, `action`, `entity_type`, `entity_id`, `details`, `created_at`.

---

## 4. Roles, Permisos y Seguridad

### Control de Acceso
- **`super_admin` (Super Administrador):** Acceso total. Puede gestionar grupos, usuarios, configuración institucional, festivos, historial de asistencia, auditoría y aprobar/rechazar justificaciones.
- **`operator` (Operador):** Toma de asistencia diaria de niños y personal, gestión de directorio de niños/profesores/practicantes, envío de solicitudes de justificación, generación de certificados y reportes. No accede a `/groups`, `/users`, `/settings`, `/audit`, `/corrections` ni `/attendance/historical`.

### Seguridad de Sesiones y API
- `src/middleware.ts` valida la presencia de la cookie `auth-session` para redirección rápida hacia `/login`.
- La autorización real de datos en base de datos se garantiza mediante **`firestore.rules`** usando la función `isAuth()` e `isAdmin()` (verificando `profiles/{uid}.role == 'super_admin'`).
- `POST /api/users/create` verifica el ID Token de Firebase Admin SDK (`verifyIdToken`) y exige que el invocador tenga `role === "super_admin"`.
- Las rutas `/api/cron/*` validan la cabecera `Authorization: Bearer <CRON_SECRET>` mediante `src/lib/cron-auth.ts`.

---

## 5. Automatizaciones (Vercel Cron Jobs) y Rendimiento

En `vercel.json` están programadas 3 tareas automáticas de **Lunes a Viernes** (horarios en UTC, correspondientes a la tarde/noche de Colombia `UTC-5`):

| Ruta | Expresión Cron (UTC) | Hora Colombia (aprox.) | Función |
| :--- | :--- | :--- | :--- |
| `/api/cron/auto-mark-staff` | `30 21 * * 1-5` | 4:30 PM L-V | Marca ausentes a profesores/practicantes sin registro del día. |
| `/api/cron/auto-mark-children` | `50 22 * * 1-5` | 5:50 PM L-V | Cierra asistencia infantil marcando pendientes como ausentes. |
| `/api/cron/daily-absence-report` | `0 23 * * 1-5` | 6:00 PM L-V | Envía el consolidado diario de inasistencias por correo SMTP. |

### Optimizaciones de Rendimiento y PWA
- **Caché de Perfil (`auth-context.tsx`):** Almacena temporalmente el perfil en `localStorage` para renderizado inmediato y ejecuta la revalidación con Firestore con límite de tiempo de 5 segundos.
- **Caché de Dashboard:** Almacena estadísticas del día en `sessionStorage` (`dashboard_cache_v1`) con actualización en segundo plano.
- **Service Worker (`public/sw.js` v3):** Usa estrategia **Network-First** para evitar servir HTML o código obsoleto, excluyendo peticiones a `/api/`, orígenes externos de Firebase y parámetros `_rsc` de Next.js.

---

## 6. Generación de Documentos PDF y Cálculo de Días Hábiles

- **Días Hábiles (`src/lib/utils.ts`):** `getBusinessDaysBetween(startDate, endDate, customHolidays)` filtra exclusivamente **Lunes a Viernes**, excluyendo sábados, domingos, festivos oficiales colombianos (fijos, Ley Emiliani y Semana Santa/Pascua) y los festivos personalizados de la colección `holidays`.
- **Certificados (`src/lib/certificates.ts`):** Genera constancias para niños, practicantes y profesores con logotipo institucional (`/logo-doc.png`), márgenes controlados (`18 mm`), texto justificado/envuelto y bloque de firma del representante legal.
- **Reporte Individual por Rango de Fechas (`src/lib/export.ts` -> `exportPersonAttendanceRangePDF`):** Genera un PDF de **1 sola hoja A4** con logotipo, ficha del estudiante, 4 tarjetas de resumen, dos paneles paralelos a color (**Días que Asistió** en verde vs. **Días que No Asistió** en rojo) y bloque final automático sin firma indicando nombre y rol del usuario autenticado que generó el reporte.
