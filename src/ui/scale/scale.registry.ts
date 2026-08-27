import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartScaleProps } from '@/model/types/chart-components.types'
import type { ChartScaleDescriptor } from '@/ui/scale/scale.config'
import { ChartScaleNode } from '@/ui/scale/Scale'
import {

  createChartScaleDescriptor,
  normalizeChartScaleProps,
} from '@/ui/scale/scale.config'

export const CHART_SCALE_DESCRIPTOR: ChartScaleDescriptor = createChartScaleDescriptor((context, schema) => {
  return new ChartScaleNode(
    context.app,
    context.surface,
    normalizeChartScaleProps(schema.props as NovaChartScaleProps),
    { componentId: schema.id },
    CHART_SCALE_DESCRIPTOR,
  )
})

export function registerChartScale(registry: NovaSchemaRegistry): void {
  registry.register(CHART_SCALE_DESCRIPTOR, { override: true })
}
