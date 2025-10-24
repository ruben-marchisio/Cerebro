# Cerebro

Asistente de desarrollo para escritorio construido con Tauri + React. Ofrece chat con modelos locales (Ollama) y remoto (DeepSeek) con auto detección y un modo de respaldo en memoria.

## Desarrollo local

- `pnpm dev`: sirve la app web.
- `pnpm tauri dev`: ejecuta la aplicación nativa.
- `pnpm build && pnpm tauri build`: genera los artefactos de producción.

## Runtime local

1. **Instala Ollama** siguiendo la guía oficial: <https://ollama.com/download>.
2. **Inicia el servicio** con `ollama serve` (la mayoría de instalaciones lo hacen automáticamente). Verifica el estado con `curl http://127.0.0.1:11434/api/version`.
3. **Descarga un modelo ligero recomendado**: `ollama run mistral`. Este paso lo instala y valida en un solo comando.

## Modelos recomendados

- ⚡ Fast (`llama3.2:3b-instruct`): ideal cuando necesitas respuestas casi instantáneas para tareas cortas o debugging rápido.
- 🎯 Balanced (`qwen2.5:3b-instruct`): equilibrio entre velocidad y calidad para trabajo diario y prompts variados.
- 🧩 Pensativo (`mistral`): úsalos en prompts más largos o cuando buscas análisis más detallado aunque tarde un poco más.

Con el servicio activo, la aplicación mostrará el modo `Local (Ollama)` y podrá generar respuestas en streaming con el botón **Detener** funcionando para cortar la petición.

### ¿Y si Ollama no está disponible?

- Configura la variable `DEEPSEEK_API_KEY` para usar el modo `Remoto (DeepSeek)`.
- Sin Ollama ni API key, el chat mostrará mensajes guía del modo `Sin modelo` sin romper la interfaz.

### Troubleshooting

- **Modelo faltante**: si lees `model "<nombre>" not found`, instala uno existente (`ollama run mistral`) o actualiza el nombre en la configuración.
- **Servicio caído o puerto ocupado**: reinicia con `ollama serve` y comprueba que el puerto `11434` no esté en uso (`lsof -i :11434` en macOS/Linux, `netstat -ano | find "11434"` en Windows).
- **Tiempo de espera agotado**: confirma que tu firewall permita conexiones locales y repite `curl http://127.0.0.1:11434/api/version`.

Cuando el modo local se recupera, la etiqueta vuelve a `Local (Ollama)` automáticamente.
