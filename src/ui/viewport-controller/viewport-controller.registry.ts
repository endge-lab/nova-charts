import { ChartViewportController } from '@/ui/viewport-controller/ViewportController'
import {
  createChartViewportControllerDescriptor,
  normalizeChartViewportControllerProps,
  type ChartViewportControllerDescriptor,
} from '@/ui/viewport-controller/viewport-controller.config'
import type { NovaChartViewportControllerProps } from '@/model/types/chart-components.types'

export const CHART_VIEWPORT_CONTROLLER_DESCRIPTOR: ChartViewportControllerDescriptor =
  createChartViewportControllerDescriptor((context, schema) => new ChartViewportController(
    context.app,
    context.surface,
    normalizeChartViewportControllerProps(schema.props as NovaChartViewportControllerProps),
    { componentId: schema.id },
  ))
