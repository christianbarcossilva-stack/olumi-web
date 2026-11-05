# Ondi · de la carpeta al iPhone (TestFlight) y Android

Es el mismo camino que hiciste con Olumi. Lo marcado con ⏱ se hace una sola vez.

---

## 1. Herramientas en la Mac ⏱

Si ya compilaste Olumi, **Xcode** y **Node.js** ya están instalados: pasá al punto 2.

## 2. Preparar la carpeta ⏱

1. Descomprimí `ondi-app.zip` donde quieras (por ejemplo en Documentos).
2. Abrí la app **Terminal**, escribí `cd ` (con espacio al final), arrastrá la carpeta `ondi-app` a la ventana y tocá Enter.
3. Escribí `npm install` y Enter. Tarda uno o dos minutos.

Para verla en la computadora antes de compilar: `npm run web` y abrí **http://localhost:8080**. Se cierra con Ctrl + C.

## 3. Crear el proyecto de iPhone ⏱

```
npm run ios:crear
npm run ios
```
El segundo comando abre **Xcode**. Ahí:

1. En la columna izquierda tocá **App** (el ícono azul de arriba) → pestaña **Signing & Capabilities**.
2. **Team**: elegí tu cuenta (Christian Barcos), la misma que usaste para Olumi.
3. **Bundle Identifier**: `uy.unitytech.ondi`.
4. Conectá el iPhone con el cable, elegilo arriba al lado de «App» y tocá ▶︎ para probarla.

## 4. Crear la ficha de Ondi en App Store Connect ⏱

Es una ficha nueva, separada de la de Olumi.

1. Entrá a **appstoreconnect.apple.com → Apps** y tocá el **+** azul (arriba a la izquierda) → **Nueva app**.
2. Completá:
   - Plataforma: **iOS**
   - Nombre: **Ondi** (si Apple dice que está ocupado, poné **Ondi Monitor**; el ícono del iPhone igual dice «Ondi»)
   - Idioma principal: **Español (México)**
   - ID del paquete: **uy.unitytech.ondi** (aparece en la lista después del paso 3, cuando Xcode lo registra)
   - SKU: **ONDI-001**
   - Acceso: **Acceso total**
3. Tocá **Crear**.

## 5. Subir la app

1. En Xcode, arriba, elegí **Any iOS Device (arm64)** como destino.
2. Menú **Product → Archive**. Cuando termina se abre el Organizer.
3. **Distribute App → App Store Connect → Distribute**. Dejá todo en automático.

## 6. TestFlight

1. En App Store Connect → **Ondi → TestFlight**. La compilación aparece en 15 a 30 minutos.
2. Si pregunta por cifrado: **Ninguno de los algoritmos mencionados** (la app solo usa https).
3. **Testers internos**: agregá a tu equipo. No necesita revisión de Apple.
4. Cada uno instala **TestFlight** desde el App Store y acepta la invitación del mail.

## 7. Android ⏱

1. Instalá **Android Studio** (developer.android.com/studio) y abrilo una vez.
2. En la Terminal, dentro de la carpeta: `npm run android:crear` y después `npm run android`.
3. Se abre Android Studio. Conectá un Android con cable (Opciones de desarrollador → Depuración USB) y tocá ▶︎.
4. Para Google Play: **Build → Generate Signed App Bundle or APK → Android App Bundle** → crear un keystore nuevo. **Guardá ese archivo y su contraseña para siempre**: sin él no se pueden publicar actualizaciones.

---

## Enlaces directos

La app responde a estos enlaces, útiles para accesos directos y para el televisor: `#panel`, `#clientes`, `#pantallas`, `#pantalla-p1` (abre directo el modo pantalla), `#alertas` y `#ajustes`. En iPhone y Android, al mantener apretado el ícono aparecen accesos directos a Alertas y a Pantalla 1.

## Cuando cambie algo en la app

1. Reemplazá la carpeta `www` por la nueva que te pase.
2. En Xcode → **App → General**, subí el **Build** en 1 (por ejemplo 1 → 2).
3. `npm run ios` → **Product → Archive → Distribute App**.
