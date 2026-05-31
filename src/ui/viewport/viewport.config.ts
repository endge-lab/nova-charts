import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartViewportApi,
  NovaChartViewportProps,
  NovaChartViewportResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartViewportProps,
} from '@/ui/shared/chart-props'

export type ChartViewportDescriptor = NovaComponentDescriptor<
  NovaChartViewportResolvedProps,
  NovaChartViewportApi,
  Record<string, never>,
  NovaChartViewportProps
>

export type ChartViewportNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartViewportProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_VIEWPORT_SCHEMA_TYPE = 'NovaCharts.Viewport'

export function createChartViewportDescriptor(createNode?: ChartViewportNodeFactory): ChartViewportDescriptor {
  const descriptor: ChartViewportDescriptor = {
    type: CHART_VIEWPORT_SCHEMA_TYPE,
    name: 'NovaCharts.Viewport',
    title: 'NovaCharts.Viewport',
    version: '0.4.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      scaleId: { type: 'string' },
      orientation: { type: 'string' },
      enabled: { type: 'boolean' },
      value: { type: 'number' },
      visibleCount: { type: 'number' },
      wheelStep: { type: 'number' },
      controller: { type: 'record' },
      scrollbar: { type: 'record' },
      onChange: { type: 'function' },
    },
    normalize: schema => normalizeChartViewportProps(schema.props as NovaChartViewportProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartViewportProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_VIEWPORT_NODE_DESCRIPTOR = createChartViewportDescriptor()

export { normalizeChartViewportProps }
