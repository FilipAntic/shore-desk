'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ShiftReport } from '@/components/reports/shift-report'
import { RevenueReport } from '@/components/reports/revenue-report'

export function ReportsTabs({ beachId }: { beachId: string }) {
  return (
    <Tabs defaultValue="shift">
      <TabsList className="mb-6">
        <TabsTrigger value="shift">Daily Shift</TabsTrigger>
        <TabsTrigger value="revenue">Revenue</TabsTrigger>
      </TabsList>

      <TabsContent value="shift">
        <ShiftReport beachId={beachId} />
      </TabsContent>

      <TabsContent value="revenue">
        <RevenueReport beachId={beachId} />
      </TabsContent>
    </Tabs>
  )
}
