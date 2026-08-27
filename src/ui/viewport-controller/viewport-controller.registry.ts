import type { NovaChartViewportControllerProps } from '@/model/types/chart-components.types'
import type { ChartViewportControllerDescriptor } from '@/ui/viewport-controller/viewport-controller.config'
import {

  createChartViewportControllerDescriptor,
  normalizeChartViewportControllerProps,
} from '@/ui/viewport-controller/viewport-controller.config'
import { ChartViewportController } from '@/ui/viewport-controller/ViewportController'

export const CHART_VIEWPORT_CONTROLLER_DESCRIPTOR: ChartViewportControllerDescriptor
  = createChartViewportControllerDescriptor((context, schema) => new ChartViewportController(
    context.app,
    context.surface,
    normalizeChartViewportControllerProps(schema.props as NovaChartViewportControllerProps),
    { componentId: schema.id },
  ))
