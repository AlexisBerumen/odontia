# Odontia

Aplicación web responsive para consultorios dentales: agenda, cuentas, pacientes y recordatorios.

## Ejecutar localmente

```powershell
npm install
npm run dev
```

Para desarrollo local necesitas una base PostgreSQL y dos variables de entorno:

```powershell
$env:DATABASE_URL="postgresql://usuario:contraseña@host:puerto/base"
$env:JWT_SECRET="una-frase-aleatoria-de-al-menos-32-caracteres"
npm run build
npm start
```

## Arquitectura

El servidor Express sirve la interfaz y una API. PostgreSQL guarda las cuentas, los pacientes y las citas. Las contraseñas se almacenan cifradas y toda consulta se filtra por el usuario autenticado. El esquema está documentado en [`database/schema.sql`](database/schema.sql) y se aplica automáticamente al iniciar el servidor.

## Desplegar en Railway

1. En Railway selecciona **New Project → Deploy from GitHub repo** y elige este repositorio.
2. En el servicio web, abre **Variables** y agrega:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (ajusta `Postgres` al nombre de tu servicio de base de datos).
   - `JWT_SECRET` = una cadena aleatoria privada de al menos 32 caracteres.
3. Railway detectará `railway.json`, ejecutará `npm run build` y arrancará el servidor.
4. En **Settings → Networking**, pulsa **Generate Domain** para obtener el enlace público.

No subas `JWT_SECRET` ni `DATABASE_URL` a GitHub. La base de datos debe seguir privada; solo el backend de Railway se conecta a ella.
