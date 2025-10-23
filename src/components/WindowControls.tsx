import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function WindowControls() {
  return (
    <div className="no-drag flex items-center overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-sm">
      <button
        type="button"
        aria-label="Minimizar"
        onClick={() => {
          void appWindow.minimize();
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
        onClick={() => {
          void appWindow.toggleMaximize();
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
        onClick={() => {
          void appWindow.close();
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
