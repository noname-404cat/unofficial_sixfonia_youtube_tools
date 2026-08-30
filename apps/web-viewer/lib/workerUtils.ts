import { wrap } from "comlink"
import type { ParseWorkerAPI } from "../workers/parseWorker"

// Create and wrap the worker with comlink
export function createParseWorker() {
  // Use ?worker to tell Webpack/Vite to bundle this as a worker
  const worker = new Worker(new URL("../workers/parseWorker.ts", import.meta.url), {
    type: "module",
  })

  return wrap<ParseWorkerAPI>(worker)
}
