import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartTooltipProps } from '@/model/types/chart-components.types'
import type { ChartTooltipDescriptor } from '@/ui/tooltip/tooltip.config'
import { ChartTooltip } from '@/ui/tooltip/Tooltip'
import {

  createChartTooltipDescriptor,
  normalizeChartTooltipProps,
} from '@/ui/tooltip/tooltip.config'

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
