# Guía Completa de Despliegue - Sistema de Asistencia

Esta guía detalla los pasos para desplegar el **Sistema de Gestión de Asistencia** en producción utilizando **Vercel** para el frontend/API y **Google Firebase** (Authentication, Cloud Firestore, Cloud Storage) para el backend.

---

## Arquitectura de Producción

- **Frontend & API Routes:** Next.js 16 (App Router) alojado en **Vercel**.
- **Autenticación:** Firebase Authentication (Email y Contraseña).
- **Base de Datos NoSQL en Tiempo Real:** Google Cloud Firestore.
- **Almacenamiento de Archivos (Fotos y Firmas):** Google Firebase Storage.
- **Acceso Administrativo Seguro:** Firebase Admin SDK ejecutado en Vercel Serverless Functions.
- **Integración Continua:** Cada `git push origin main` desencadena un despliegue automático en Vercel.

---

## 1. Configuración de Firebase

### 1.1. Crear o Seleccionar Proyecto en Firebase
1. Ingresa a la consola de [Firebase Console](https://console.firebase.google.com/).
2. Si ya tienes el proyecto creado (ej: `sistema-asistencia-fb5f5`), selecciónalo. Si no, crea un nuevo proyecto desactivando o activando Google Analytics según prefieras.

### 1.2. Habilitar Firebase Authentication
1. En el menú lateral, dirígete a **Compilación > Authentication**.
2. Haz clic en **Comenzar** y en la pestaña **Sign-in method**, habilita el proveedor **Correo electrónico/Contraseña**.
3. Guarda los cambios.

### 1.3. Configurar Cloud Firestore
1. En el menú lateral, ve a **Compilación > Firestore Database**.
2. Haz clic en **Crear base de datos** y selecciona la ubicación más cercana (ej: `us-east1` o `southamerica-east1`).
3. Ve a la pestaña **Reglas** y copia el contenido del archivo [`firestore.rules`](./firestore.rules) del repositorio.
4. Haz clic en **Publicar**.

### 1.4. Configurar Firebase Storage
1. Ve a **Compilación > Storage** y haz clic en **Comenzar**.
2. Acepta la ubicación predeterminada del bucket (ej: `sistema-asistencia-fb5f5.firebasestorage.app`).
3. En la pestaña **Reglas**, asegúrate de que los usuarios autenticados puedan leer y escribir:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```
4. **Configurar CORS en el Bucket:**  
   Para permitir la subida de fotos y firmas desde el navegador sin bloqueos de origen cruzado:
   - Abre Google Cloud Shell o tu terminal local con `gcloud` instalado:
   ```bash
   gcloud storage buckets update gs://sistema-asistencia-fb5f5.firebasestorage.app --cors-file=cors.json
   # O con gsutil:
   gsutil cors set cors.json gs://sistema-asistencia-fb5f5.firebasestorage.app
   ```

### 1.5. Generar Clave de Cuenta de Servicio (Firebase Admin SDK)
1. En la consola de Firebase, haz clic en el ícono de engranaje ⚙️ junto a *Descripción general del proyecto* > **Configuración del proyecto**.
2. Ve a la pestaña **Cuentas de servicio**.
3. Haz clic en **Generar nueva clave privada** y confirma descargando el archivo JSON.
4. **Guarda este archivo en un lugar seguro.** Lo necesitarás para configurar Vercel en el siguiente paso.

---

## 2. Despliegue en Vercel

### 2.1. Conectar el Repositorio de GitHub
1. Inicia sesión en [Vercel](https://vercel.com).
2. Haz clic en **Add New... > Project**.
3. Selecciona tu repositorio de GitHub: `AnderHolden/sistema-asistencia`.
4. Vercel detectará automáticamente que es un proyecto **Next.js**.

### 2.2. Configurar Variables de Entorno en Vercel
En la sección **Environment Variables** de la pantalla de configuración en Vercel (o en **Project Settings > Environment Variables**), agrega las siguientes claves:

#### A. Variables Públicas de Firebase Client:
| Variable | Descripción / Ejemplo |
| :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Tu API Key web de Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `sistema-asistencia-fb5f5.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `sistema-asistencia-fb5f5` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `sistema-asistencia-fb5f5.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `809785160456` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:809785160456:web:490613b53adfc0586332bd` |
| `NEXT_PUBLIC_ADMIN_EMAIL` | `admin@casitadetareas.com` *(O el correo de tu Super Admin)* |

#### B. Variable de Servicio para Firebase Admin (Crítica):
> **Recomendación para evitar errores de formato en Vercel:**  
> Vercel puede alterar los saltos de línea (`\n`) de las claves PEM privadas. Nuestro código soporta el JSON en una sola línea o codificado en **Base64**.

Para obtener el valor en Base64 desde tu terminal:
```bash
# En Linux / Mac / WSL:
base64 -w 0 < tu-archivo-service-account.json

# En Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tu-archivo-service-account.json"))
```
Agrega la variable:
- `FIREBASE_SERVICE_ACCOUNT` = *(Pega la cadena Base64 generada o el JSON completo)*

*(Alternativamente, puedes configurar las variables individuales `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`)*.

#### C. Variables de Notificaciones por Correo (Opcionales / SMTP):
| Variable | Descripción / Ejemplo |
| :--- | :--- |
| `SMTP_HOST` | `smtp.gmail.com` o `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `notificaciones@casitadetareas.com` |
| `SMTP_PASS` | Contraseña de aplicación o token |
| `SMTP_FROM` | `"Sistema Asistencia <notificaciones@casitadetareas.com>"` |

### 2.3. Ejecutar Despliegue
1. Haz clic en **Deploy**.
2. Vercel compilará la aplicación con Next.js y Turbopack.
3. Al finalizar, tu aplicación estará disponible en una URL como `https://sistema-asistencia.vercel.app`.

---

## 3. Configuración Post-Despliegue

### 3.1. Primer Inicio de Sesión y Super Administrador
1. Abre la aplicación desplegada en Vercel.
2. Si aún no existe el usuario, créalo en Firebase Authentication (o mediante `/api/seed` si está habilitado).
3. Asegúrate de que el correo coincida con el valor configurado en `NEXT_PUBLIC_ADMIN_EMAIL` (por ejemplo `admin@casitadetareas.com`).
4. Al iniciar sesión, el sistema le asignará automáticamente el rol `super_admin` en su perfil de Firestore, otorgando acceso completo al panel de control, gestión de personal, configuración y correcciones.

### 3.2. Autorizar el Dominio de Vercel en Firebase Auth
1. En Firebase Console, ve a **Authentication > Configuración > Dominios autorizados**.
2. Haz clic en **Agregar dominio**.
3. Añade el dominio generado por Vercel (ej: `sistema-asistencia.vercel.app` o tu dominio personalizado).
4. Sin este paso, Firebase bloqueará las operaciones de inicio de sesión desde la web pública.

---

## 4. Flujo de Desarrollo y Actualizaciones Continuas (CI/CD)

Cada vez que se sube un cambio a la rama principal (`main`):
```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```
1. **GitHub** notifica automáticamente a **Vercel** mediante Webhooks.
2. Vercel ejecuta `npm run build` y corre la verificación de tipos de TypeScript.
3. Si el build es exitoso, Vercel publica la nueva versión en producción **sin tiempo de inactividad** (zero-downtime deployment).