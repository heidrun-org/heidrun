import "./dev/install_tauri_mock";
import { DurableStorage } from "./lib/durable_storage";

// The stores read their saved state when their file is imported, so the restore of `localStorage` comes first (issue 772).
async function start(): Promise<void> {
  await DurableStorage.restore();
  await import("./lib/legacy_storage");
  await import("./start_application");
  DurableStorage.startMirroring();
}

void start();
