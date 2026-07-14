'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfigRow { key: string; value: string }

const EDITABLE_KEYS: { key: string; label: string; description: string; prefix?: string; suffix?: string }[] = [
  { key: 'price_full_day', label: 'Full day price',   description: 'Price charged per sun bed per day', prefix: '€' },
  { key: 'closing_time',   label: 'Closing time',     description: 'Time when full day rentals expire', suffix: 'HH:MM' },
  { key: 'late_arrival_price', label: 'Late arrival price', description: 'Price charged when renting after the late arrival time', prefix: '€' },
  { key: 'late_arrival_time',  label: 'Late arrival time',  description: 'From this time, the late arrival price applies instead', suffix: 'HH:MM' },
  { key: 'beach_name',     label: 'Beach / bar name', description: 'Shown on customer ordering page' },
  { key: 'order_timeout_minutes', label: 'Order timeout', description: 'Minutes before an unaccepted order is flagged', suffix: 'min' },
]

interface PricingConfigProps {
  config: ConfigRow[]
}

export function PricingConfig({ config }: PricingConfigProps) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(config.map(c => [c.key, c.value]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    await Promise.all(
      EDITABLE_KEYS.map(({ key }) =>
        supabase
          .from('config')
          .upsert({ key, value: values[key] ?? '', updated_at: new Date().toISOString() })
      )
    )

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      {EDITABLE_KEYS.map(field => (
        <div key={field.key} className="space-y-1">
          <Label>{field.label}</Label>
          <div className="flex items-center gap-2">
            {field.prefix && (
              <span className="text-sm text-slate-500 font-medium">{field.prefix}</span>
            )}
            <Input
              value={values[field.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
            />
            {field.suffix && (
              <span className="text-sm text-slate-400">{field.suffix}</span>
            )}
          </div>
          <p className="text-xs text-slate-400">{field.description}</p>
        </div>
      ))}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
      </Button>
    </form>
  )
}
