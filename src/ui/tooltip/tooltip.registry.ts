import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartTooltip } from '@/ui/tooltip/Tooltip'
import {
  createChartTooltipDescriptor,
  normalizeChartTooltipProps,
  type ChartTooltipDescriptor,
} from '@/ui/tooltip/tooltip.config'
import type { NovaChartTooltipProps } from '@/model/types/chart-components.types'

export const CHART_TOOLTIP_DESCRIPTOR: ChartTooltipDescriptor = createChartTooltipDescriptor((context, schema) => {
  return new ChartTooltip(
    context.app,
    context.surface,
    normalizeChartTooltipProps(schema.props as NovaChartTooltipProps),
    { componentId: schema.id },
    CHART_TOOLTIP_DESCRIPTOR,
  )
})

export function registerChartTooltip(registry: NovaSchemaRegistry): void {
  registry.register(CHART_TOOLTIP_DESCRIPTOR, { override: true })
}
