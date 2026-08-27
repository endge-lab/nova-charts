import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartViewportControllerApi,
  NovaChartViewportControllerProps,
  NovaChartViewportControllerResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartViewportControllerProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartViewportControllerDescriptor = NovaComponentDescriptor<
  NovaChartViewportControllerResolvedProps,
  NovaChartViewportControllerApi,
  Record<string, never>,
  NovaChartViewportControllerProps
>

export type ChartViewportControllerNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartViewportControllerProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_VIEWPORT_CONTROLLER_SCHEMA_TYPE = 'NovaCharts.ViewportController'

export function createChartViewportControllerDescriptor(
  createNode?: ChartViewportControllerNodeFactory,
): ChartViewportControllerDescriptor {
  const descriptor: ChartViewportControllerDescriptor = {
    type: CHART_VIEWPORT_CONTROLLER_SCHEMA_TYPE,
    name: 'NovaCharts.ViewportController',
    title: 'NovaCharts.ViewportController',
    version: '0.10.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      scaleId: { type: 'string' },
      enabled: { type: 'boolean' },
      viewportRef: { type: 'string' },
      wheel: { type: 'record' },
      trackpad: { type: 'record' },
      pointerPan: { type: 'record' },
      keyboard: { type: 'record' },
      scrollbar: { type: 'record' },
      mapWheel: { type: 'function' },
      onInput: { type: 'function' },
    },
    normalize: schema => normalizeChartViewportControllerProps(schema.props as NovaChartViewportControllerProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartViewportControllerProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_VIEWPORT_CONTROLLER_NODE_DESCRIPTOR = createChartViewportControllerDescriptor()

export { normalizeChartViewportControllerProps }
