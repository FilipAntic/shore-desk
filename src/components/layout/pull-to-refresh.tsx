'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = useCallback(() => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1000)
  }, [router])

  // Pull-to-refresh gesture
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0) startY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshing) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        // dampen: pull feels heavier as it extends
        setPullY(Math.min(delta * 0.4, 64))
        e.preventDefault()
      }
    }

    const onTouchEnd = () => {
      if (pullY >= 56) doRefresh()
      setPullY(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullY, refreshing, doRefresh])

  // Auto-refresh when app comes back to foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') doRefresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [doRefresh])

  const showIndicator = pullY > 8 || refreshing
  const progress = Math.min(pullY / 56, 1)

  return (
    <div ref={containerRef} className="flex-1 overflow-auto pb-16 md:pb-0 relative">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center z-50 pointer-events-none transition-opacity duration-150"
        style={{
          top: showIndicator ? Math.max(pullY - 24, 8) : -40,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div className="bg-white rounded-full shadow-md p-1.5 border border-slate-100">
          <svg
            className={`w-5 h-5 text-sky-600 ${refreshing ? 'animate-spin' : ''}`}
            style={!refreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>

      <div style={{ transform: pullY > 0 ? `translateY(${pullY}px)` : undefined, transition: pullY === 0 ? 'transform 0.2s ease' : undefined }}>
        {children}
      </div>
    </div>
  )
}