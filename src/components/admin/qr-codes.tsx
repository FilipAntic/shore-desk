'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Bed } from '@/types'
import { Button } from '@/components/ui/button'

interface QrCodesProps {
  beds: Bed[]
  beachSlug: string
}

function QrCard({ bed, baseUrl, beachSlug }: { bed: Bed; baseUrl: string; beachSlug: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = `${baseUrl}/order/${beachSlug}/${bed.label}`

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 160,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
    }
  }, [url])

  return (
    <div className="flex flex-col items-center bg-white border-2 border-slate-200 rounded-xl p-4 gap-2 print:border print:rounded-none print:break-inside-avoid">
      <canvas ref={canvasRef} className="rounded" />
      <div className="text-center">
        <p className="text-2xl font-black text-slate-900">Bed {bed.label}</p>
        <p className="text-xs text-slate-400 mt-0.5">Scan to order</p>
      </div>
    </div>
  )
}

export function QrCodes({ beds, beachSlug }: QrCodesProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [filter, setFilter] = useState<'all' | 'active'>('active')

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const visibleBeds = beds.filter(b => filter === 'all' || b.is_active)

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['active', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {f === 'active' ? 'Active beds only' : 'All beds'}
            </button>
          ))}
        </div>
        <Button onClick={handlePrint} variant="outline">
          🖨️ Print all QR codes
        </Button>
      </div>

      <p className="text-xs text-slate-400">
        Each QR code links to: <code className="bg-slate-100 px-1 rounded">{baseUrl}/order/{beachSlug}/[BED]</code>
      </p>

      <div
        ref={printRef}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 print:grid-cols-4"
      >
        {visibleBeds
          .sort((a, b) => a.row - b.row || a.col - b.col)
          .map(bed => (
            <QrCard key={bed.id} bed={bed} baseUrl={baseUrl} beachSlug={beachSlug} />
          ))}
      </div>

      {visibleBeds.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-8">No beds to show</p>
      )}

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: absolute; top: 0; left: 0; }
        }
      `}</style>
    </div>
  )
}
