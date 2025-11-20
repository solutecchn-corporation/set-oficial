Deploy / GitHub Pages
=====================

Instrucciones rápidas para publicar el proyecto en GitHub Pages y comprobar problemas de CORS/Storage.

1) Añadir secretos en GitHub
- Ve a `Settings -> Secrets and variables -> Actions` de tu repositorio y añade estos secrets:
  - `VITE_SUPABASE_URL` (ej: `https://<project>.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY` (anon/public key)
  - `VITE_SUPABASE_STORAGE_BUCKET` (ej: `inventario`)

2) Flujo automático (ya incluido)
- El archivo `.github/workflows/deploy.yml` está incluido y se dispara al hacer push a `main`.
- El workflow ejecuta `npm ci`, `npm run build` con las variables anteriores y publica `dist/` en la rama `gh-pages`.

3) Habilitar GitHub Pages
- Después del primer despliegue, ve a `Settings -> Pages` y pon que sirva desde la rama `gh-pages` (carpeta `/`).

4) CORS / Storage
- Si las imágenes no se muestran en producción revisa la consola `Network` y `Console` en el navegador.
- Para pruebas rápidas deja el bucket `inventario` como *Public* en Supabase Storage para que `getPublicUrl` devuelva URLs válidas.
- Si mantienes el bucket `Private`, la app intentará usar `createSignedUrl` para generar URLs temporales (la app necesita las credenciales en tiempo de ejecución para solicitar signed URLs — en este repo el cliente usa la anon key; con buckets privados normalmente se recomienda generar signed URLs desde un backend seguro).

5) Notas de seguridad
- Nunca publiques claves de servicio (`service_role`) en el frontend. El `anon` key está pensado para operaciones cliente públicas y tiene restricciones según tus políticas RLS.

6) Si quieres que haga el push y active el workflow
- No puedo ejecutar `git push` desde aquí por ti. Puedo preparar los archivos (ya creados) y tú solo harías:

```bash
git add .github/workflows/deploy.yml DEPLOY.md
git commit -m "Add GH Pages deploy workflow and deploy notes"
git push origin main
```

Luego revisa la pestaña `Actions` en GitHub para seguir el build y el despliegue.
