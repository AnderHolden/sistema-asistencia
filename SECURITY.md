# Política de Seguridad — Sistema de Gestión de Asistencia (Casita de Tareas)

## 1. Principios de Protección de Datos

El sistema procesa información personal de menores de edad, acudientes, docentes y practicantes. Todas las operaciones cumplen con las siguientes medidas técnicas:

- **Autenticación Obligatoria:** Ningún módulo operativo es accesible sin sesión activa en Firebase Authentication.
- **Control de Acceso Basado en Roles (RBAC):**
  - `super_admin`: Acceso administrativo completo, gestión de usuarios, configuración, festivos, historial, auditoría y aprobación de justificaciones.
  - `operator`: Acceso operativo limitado a registro diario de asistencia, directorios, certificados y reportes.
- **Reglas de Base de Datos (`firestore.rules`):** Todas las lecturas y escrituras se validan en los servidores de Google Cloud Firestore. Las colecciones sensibles (`groups`, `teachers`, `practitioners`, `system_settings`, `holidays`, `users/profiles`) restringen escritura únicamente a administradores verificados (`isAdmin()`).
- **Auditoría Inmutable (`audit_logs`):** Los registros de auditoría permiten creación autenticada, pero bloquean cualquier actualización o eliminación (`allow update, delete: if false`).

---

## 2. Manejo de Credenciales y Secretos

- **Prohibido subir secretos al repositorio:** Archivos `.env.local`, `.env` y claves JSON de Firebase Admin (`service-account.json`) están excluidos en `.gitignore`.
- **Variables de Servidor en Vercel:**
  - `FIREBASE_SERVICE_ACCOUNT` (o `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) se almacena cifrada en Vercel Environment Variables.
  - `SMTP_PASS` / contraseñas de aplicación nunca se exponen en el navegador.
  - `CRON_SECRET` protege los endpoints automáticos `/api/cron/*` mediante cabecera `Authorization: Bearer <CRON_SECRET>`.

---

## 3. Recomendaciones Operativas para la Institución

1. **No compartir cuentas:** Cada operador y administrador debe tener su propio usuario y contraseña para mantener la trazabilidad en auditoría y en los reportes PDF generados.
2. **Desactivar usuarios salientes:** Si un operador o practicante deja la institución, revocar o cambiar su acceso inmediatamente desde Firebase Authentication / Gestión de Usuarios.
3. **Rotación de contraseñas:** Cambiar periódicamente la contraseña de aplicación SMTP y la clave de `super_admin`.

---

## 4. Reporte de Incidentes o Vulnerabilidades

Si se detecta algún comportamiento anómalo, acceso no autorizado o fuga de credenciales:
1. Revocar inmediatamente el token o contraseña comprometida en **Firebase Console** o **Vercel Dashboard**.
2. Revisar la **Bitácora de Auditoría** (`/audit`) en el sistema.
3. Notificar al responsable técnico o administrador del sistema de **Casita de Tareas**.
