import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartAxis } from '@/ui/axis/Axis'
import {
  createChartAxisDescriptor,
  normalizeChartAxisProps,
  type ChartAxisDescriptor,
} from '@/ui/axis/axis.config'
import type { NovaChartAxisProps } from '@/model/types/chart-components.types'

export const CHART_AXIS_DESCRIPTOR: ChartAxisDescriptor = createChartAxisDescriptor((context, schema) => {
  return new ChartAxis(
    context.app,
    context.surface,
    normalizeChartAxisProps(schema.props as NovaChartAxisProps),
    { componentId: schema.id },
    CHART_AXIS_DESCRIPTOR,
  )
})

export function registerChartAxis(registry: NovaSchemaRegistry): void {
  registry.register(CHART_AXIS_DESCRIPTOR, { override: true })
}
