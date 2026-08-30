import * as Papa from "papaparse"
import { expose } from "comlink"

// Worker API
const workerApi = {
  /**
   * Parse CSV content using PapaParse in worker thread
   */
  parseCSV(content: string, config: Papa.ParseConfig = {}) {
    return new Promise((resolve, reject) => {
      try {
        const results = Papa.parse(content, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          ...config,
          complete: (results) => resolve(results),
          error: (error) => reject(error),
        })
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Parse JSON content in worker thread
   */
  parseJSON(content: string) {
    try {
      return JSON.parse(content)
    } catch (error) {
      throw new Error("Invalid JSON format")
    }
  },
}

// Expose the API to the main thread
expose(workerApi)

export type ParseWorkerAPI = typeof workerApi
