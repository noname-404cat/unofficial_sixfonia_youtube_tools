"use client"

import { useEffect, useState } from "react"
import { fetchSnapshot, type Snapshot } from "@/lib/snapshot"

/** 動画マスタを読み込む。アプリ起動時に一度だけ取得する。 */
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSnapshot(controller.signal)
      .then((data) => {
        setSnapshot(data)
        setError(null)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : "動画マスタを取得できませんでした")
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [])

  return { snapshot, isLoading, error }
}
