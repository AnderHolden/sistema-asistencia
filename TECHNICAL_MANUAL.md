# Manual Técnico - Sistema de Gestión de Asistencia

## 1. Arquitectura del Sistema

### Stack Tecnológico
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Estilos**: Tailwind CSS 4, PostCSS
- **Backend / Base de Datos**: Google Firebase
  - **Firebase Authentication**: Gestión de usuarios y sesiones
  - **Cloud Firestore**: Base de datos NoSQL reactiva en tiempo real
  - **Firebase Storage**: Almacenamiento seguro de fotos y firmas
  - **Firebase Admin SDK**: Operaciones del lado del servidor en API Routes
- **Despliegue**: Vercel (Frontend & Serverless Functions) + Google Cloud / Firebase
- **PWA**: Web App Manifest (`manifest.json`) + Service Worker para instalación en dispositivos móviles y de escritorio

---

## 2. Estructura del Código

```
sistema-asistencia/
├── firestore.rules               # Reglas de seguridad de Cloud Firestore
├── cors.json                     # Configuración de orígenes cruzados (Storage)
├── DEPLOYMENT.md                 # Guía de despliegue en Vercel
├── .env.example                  # Plantilla de variables de entorno
└── src/
    ├── app/                      # Next.js App Router
    │   ├── layout.tsx            # Shell HTML principal y fuentes
    │   ├── client-provider.tsx   # Proveedor de autenticación y redirecciones
    │   ├── page.tsx              # Redirección raíz a /login o /dashboard
    │   ├── login/                # Inicio de sesión
    │   ├── dashboard/            # Métricas generales y accesos rápidos
    │   ├── attendance/
    │   │   ├── children/         # Toma de asistencia y solicitudes de niños
    │   │   ├── staff/            # Asistencia de profesores/practicantes con firma
    │   │   └── historical/       # Asistencia histórica y marcación masiva
    │   ├── corrections/          # Panel administrativo de correcciones
    │   ├── children/             # Gestión de niños matriculados
    │   ├── teachers/             # Gestión de profesores
    │   ├── practitioners/        # Gestión de practicantes
    │   ├── groups/               # Salones y grupos
    │   ├── reports/              # Reportes gráficos y exportación
    │   ├── audit/                # Bitácora inmutable de auditoría
    │   ├── users/                # Gestión de perfiles y roles de usuario
    │   ├── settings/             # Configuración del sistema y festivos
    │   └── api/                  # Serverless Functions (Upload, Email, Seed)
    ├── components/               # Componentes React modulares
    │   ├── layout/               # Sidebar, Header, ThemeToggle
    │   └── ui/                   # Modal, Input, Button, LoadingSpinner
    ├── lib/                      # Servicios y utilidades
    │   ├── firebase.ts           # Inicialización cliente de Firebase
    │   ├── firebase-admin.ts     # Firebase Admin SDK para Vercel
    │   ├── auth-context.tsx      # Contexto global de sesión y rol
    │   ├── attendance.ts         # Lógica de asistencia y autocierre
    │   ├── corrections.ts        # Flujo de aprobación y solicitudes
    │   ├── audit.ts              # Registro de logs de auditoría
    │   └── email.ts              # Servicio de notificaciones SMTP
    └── types/
        └── database.ts           # Modelos e interfaces TypeScript
```

---

## 3. Modelo de Datos (Cloud Firestore)

Firestore organiza los datos en colecciones de documentos:

### Colecciones Principales

1. **`profiles/{uid}`**
   - `email`: string
   - `display_name`: string
   - `role`: `"super_admin"` | `"admin"` | `"operator"`
   - `created_at`: string (ISO)

2. **`children/{childId}`**
   - `first_name`: string, `last_name`: string
   - `child_id_code`: string (ej: `"CT001"`)
   - `date_of_birth`: string
   - `group_id`: string (referencia a `groups`)
   - `shift`: `"Mañana"` | `"Tarde"`
   - `status`: `"active"` | `"inactive"`
   - `photo_url`: string | null

3. **`groups/{groupId}`**
   - `name`: string, `description`: string, `color`: string

4. **`teachers/{teacherId}`** y **`practitioners/{practitionerId}`**
   - `first_name`: string, `last_name`: string
   - `document_type`: string, `document_number`: string
   - `email`: string, `phone`: string
   - `status`: `"active"` | `"inactive"`

5. **`attendance_children/{docId}`**
   - `child_id`: string, `child_name`: string
   - `attendance_date`: string (`YYYY-MM-DD`)
   - `status`: `"present"` | `"absent"`
   - `check_in`: string (ISO) | null
   - `registered_by`: string (UID del operador)
   - `modified_by`: string | null, `modification_note`: string | null

6. **`attendance_staff/{docId}`**
   - `staff_id`: string, `staff_type`: `"teacher"` | `"practitioner"`
   - `attendance_date`: string (`YYYY-MM-DD`)
   - `check_in`: string (ISO) | null
   - `signature_url`: string (Base64 data URL o Firebase Storage) | null
   - `status`: `"present"` | `"absent"` | null

7. **`correction_requests/{docId}`** (Personal)
   - `attendance_id`: string, `staff_id`: string, `staff_name`: string
   - `attendance_date`: string
   - `action_requested`: `"enable_signature"` | `"mark_present"`
   - `action_resolved`: `"signature_enabled"` | `"marked_present"` | null
   - `reason`: string
   - `status`: `"pending"` | `"approved"` | `"rejected"`
   - `requested_by`: string, `requested_by_email`: string
   - `resolved_by`: string | null, `admin_note`: string | null

8. **`correction_requests_children/{docId}`** (Niños)
   - `attendance_id`: string, `child_id`: string, `child_name`: string
   - `attendance_date`: string
   - `old_status`: `"present"` | `"absent"`
   - `new_status`: `"present"` | `"absent"`
   - `action_resolved`: `"update_status"` | `"clear_record"` | null
   - `reason`: string
   - `status`: `"pending"` | `"approved"` | `"rejected"`
   - `requested_by`: string, `resolved_by`: string | null

9. **`audit_logs/{logId}`**
   - `action`: `"create"` | `"update"` | `"delete"`
   - `entity_type`: string, `entity_id`: string | null
   - `user_email`: string, `details`: object, `created_at`: string

---

## 4. Matriz de Control de Acceso y Roles

| Módulo / Acción | Super Admin | Admin | Operador |
|---|:---:|:---:|:---:|
| Ver Dashboard y Estadísticas | ✅ | ✅ | ✅ |
| Marcar Asistencia Diaria (Niños y Personal) | ✅ | ✅ | ✅ |
| Solicitar Corrección de Asistencia | ✅ | ✅ | ✅ |
| Ver Historial Propio de Solicitudes | ✅ | ✅ | ✅ |
| Aprobar / Rechazar Correcciones | ✅ | ✅ | ❌ |
| Edición Directa de Asistencia | ✅ | ✅ | ❌ |
| Crear / Editar / Borrar Niños | ✅ | ✅ | ❌ |
| Crear / Editar / Borrar Personal Docente | ✅ | ✅ | ❌ |
| Configuración del Sistema y Festivos | ✅ | ❌ | ❌ |
| Auditoría Completa de Acciones | ✅ | ❌ | ❌ |
| Crear y Administrar Usuarios del Sistema | ✅ | ❌ | ❌ |

---

## 5. Variables de Entorno en Producción (Vercel)

| Variable | Tipo | Propósito |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Pública | Clave API del cliente web de Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Pública | Dominio de autenticación de Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Pública | ID del proyecto de Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Pública | Bucket de almacenamiento |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Pública | ID del remitente de mensajería |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Pública | Identificador de aplicación web |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Pública | Correo que asume rol `super_admin` |
| `FIREBASE_SERVICE_ACCOUNT` | Secreta | JSON o Base64 de la cuenta de servicio |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Secretas | Configuración del servidor de correo |