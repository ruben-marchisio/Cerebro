import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function WindowControls() {
  return (
    <div
      className="no-drag flex items-center overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-sm"
      data-tauri-drag-region-exclude
    >
      <button
        type="button"
        aria-label="Minimizar"
        onClick={async () => {
          try {
            await appWindow.minimize();
          } catch (e) {
            console.error(e);
          }
        }}
        className="flex h-8 w-10 items-center justify-center text-sm text-slate-300 transition hover:bg-white/10"
      >
        <span role="img" aria-hidden="true">
          🗕
        </span>
      </button>
      <button
        type="button"
        aria-label="Maximizar o restaurar"
        onClick={async () => {
          try {
            await appWindow.toggleMaximize();
          } catch (e) {
            console.error(e);
          }
        }}
        className="flex h-8 w-10 items-center justify-center border-l border-white/10 text-sm text-slate-300 transition hover:bg-white/10"
      >
        <span role="img" aria-hidden="true">
          🗖
        </span>
      </button>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={async () => {
          try {
            await appWindow.close();
          } catch (e) {
            console.error(e);
          }
        }}
        className="flex h-8 w-10 items-center justify-center border-l border-white/10 text-sm text-slate-300 transition hover:bg-red-500/70 hover:text-white"
      >
        <span role="img" aria-hidden="true">
          ✕
        </span>
      </button>
    </div>
  );
}
