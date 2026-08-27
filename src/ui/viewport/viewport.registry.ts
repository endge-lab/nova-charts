import type { NovaChartViewportProps } from '@/model/types/chart-components.types'
import type { ChartViewportDescriptor } from '@/ui/viewport/viewport.config'
import { ChartViewport } from '@/ui/viewport/Viewport'
import {

  createChartViewportDescriptor,
  normalizeChartViewportProps,
} from '@/ui/viewport/viewport.config'

export const CHART_VIEWPORT_DESCRIPTOR: ChartViewportDescriptor = createChartViewportDescriptor((context, schema) => {
  return new ChartViewport(
    context.app,
    context.surface,
    normalizeChartViewportProps(schema.props as NovaChartViewportProps),
    { componentId: schema.id },
    CHART_VIEWPORT_DESCRIPTOR,
  )
})
