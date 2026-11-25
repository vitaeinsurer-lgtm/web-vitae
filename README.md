# VITAE Seguros de Vida — sitio web

Proyecto académico. VITAE no es una institución de seguros autorizada por la CNSF y sus productos no pueden contratarse.

Sitio estático (HTML, CSS y JavaScript, sin compilación):

- `index.html` — la página.
- `css/styles.css` — estilos con la identidad de las entregas de VITAE.
- `js/cotizador.js` — motor del cotizador; reproduce la hoja "Cotizador" de `BasesVitae_Cotizador_Interno.xlsm` (tabla CNSF M 2013, interés técnico del 6%).
- `js/main.js` — menú, línea de vida y cotizador en vivo con envío por WhatsApp.
- `img/` — logotipo de VITAE.

Se publica con GitHub Pages desde la rama `main`, carpeta raíz.

## Asistente con IA (`chatbot/`)

Chat en la página que responde dudas y cotiza con **Claude Haiku 5.5**. La página nunca ve la clave de la API: habla con un intermediario en Cloudflare Workers (`chatbot/src/worker.js`) que guarda la clave como secreto, solo acepta peticiones del sitio, limita el tamaño y la frecuencia de los mensajes y le da a Haiku la herramienta `cotizar`, que usa `js/cotizador.js` para no inventar primas.

- Instrucciones del asistente: `chatbot/src/prompt.js`.
- Pruebas contra una API simulada (sin gastar saldo): `cd chatbot && npm install && npm test`.
- Desplegar: `npx wrangler login`, `npx wrangler secret put ANTHROPIC_API_KEY` y `npx wrangler deploy`; después se pone la dirección del Worker en `CHAT_ENDPOINT` de `js/chat.js`. Mientras esté vacía, el chat no aparece.
