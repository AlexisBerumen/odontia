# Odontia

Panel responsive para consultorios dentales: agenda, pacientes, tratamientos y recordatorios.

## Ejecutar localmente

```powershell
npm install
npm run dev
```

La demostración guarda las nuevas citas en el navegador para que pueda probarse sin configuración.

## Publicarlo con cuentas en línea

1. Crea un proyecto en [Supabase](https://supabase.com) y activa Email/Password en **Authentication**.
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor. Sus políticas de seguridad impiden que un dentista vea datos de otro.
3. Conecta las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` al cliente web y sustituye la capa temporal de `localStorage` en `src/main.js` por consultas a Supabase.
4. Despliega el sitio en Vercel o Netlify y configura allí las mismas variables.

Nunca uses la clave `service_role` en el navegador. Para recordatorios de WhatsApp, llama a su API desde una función de servidor (por ejemplo, Supabase Edge Function), no desde el cliente.
