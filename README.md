# Sistema de Gestión de Asistencia — Casita de Tareas

Plataforma web progresiva (**PWA**) para el control digital integral de asistencia de niños, profesores y practicantes, emisión de certificaciones institucionales, reportes estadísticos y auditoría en tiempo real.

Desplegado en **Vercel** y respaldado por **Google Firebase**.

---

## Características Principales

- **PWA Instalable con Identidad Oficial:** Funciona como aplicación en Android, iOS y escritorio con el logotipo y favicon de **Casita de Tareas**.
- **Asistencia de Niños y Personal:** Marcado rápido por grupos/jornadas para niños y registro con firma digital táctil para profesores y practicantes.
- **Justificaciones y Correcciones:** Los operadores pueden solicitar correcciones justificadas; el Super Administrador aprueba o rechaza desde un panel centralizado con notificaciones en tiempo real.
- **Centro de Certificados y Constancias:** Generación en PDF con vista previa para niños, practicantes y profesores, calculando días hábiles reales y excluyendo festivos colombianos.
- **Reportes Consolidados y por Rango de Fechas:** Gráficas interactivas, exportación a Excel (`.xlsx`), CSV y **PDF de 1 sola hoja** por niño y rango *Desde — Hasta* (solo Lunes a Viernes, sin sábados, domingos ni festivos), con atribución automática del usuario en sesión.
- **Automatizaciones Programadas (Cron Jobs):** Cierre diario automático de jornadas y envío de reporte de inasistencias por correo SMTP.
- **Auditoría y Control de Roles:** Roles `super_admin` y `operator`, bitácora inmutable y modo Claro/Oscuro.

---

## Documentación del Proyecto

| Documento | Descripción |
| :--- | :--- |
| **[Manual de Usuario (USER_MANUAL.md)](./USER_MANUAL.md)** | Guía paso a paso para Operadores y Super Administradores. |
| **[Manual Técnico (TECHNICAL_MANUAL.md)](./TECHNICAL_MANUAL.md)** | Arquitectura, modelo de datos en Firestore, roles, Cron Jobs y PWA. |
| **[Guía de Despliegue (DEPLOYMENT.md)](./DEPLOYMENT.md)** | Configuración de Firebase, Vercel, CORS y variables de entorno. |
| **[Política de Seguridad (SECURITY.md)](./SECURITY.md)** | Manejo de secretos, control de acceso y protección de datos. |
| **[Checklist de Entrega y UAT (DELIVERY_CHECKLIST.md)](./DELIVERY_CHECKLIST.md)** | Pruebas de aceptación, verificación pre-entrega y mantenimiento anual. |

---

## Tecnologías Utilizadas

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Heroicons, Recharts.
- **Backend / BaaS:** Google Firebase (Authentication, Cloud Firestore, Firebase Storage, Firebase Admin SDK).
- **Documentos y Correo:** jsPDF, jspdf-autotable, SheetJS (`xlsx`), Nodemailer.
- **Infraestructura:** Vercel (Serverless Functions & Cron Jobs).

---

## Inicio Rápido (Desarrollo Local)

1. Clonar el repositorio e instalar dependencias:
   ```bash
   git clone https://github.com/AnderHolden/sistema-asistencia.git
   cd sistema-asistencia
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y completar las credenciales de Firebase, SMTP y `CRON_SECRET`:
   ```bash
   cp .env.example .env.local
   ```
3. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Disponible en [http://localhost:3000](http://localhost:3000).
