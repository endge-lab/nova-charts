import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartBubbleSeriesApi,
  NovaChartBubbleSeriesProps,
  NovaChartBubbleSeriesResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartBubbleSeriesProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartBubbleSeriesDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartBubbleSeriesResolvedProps<TData>,
  NovaChartBubbleSeriesApi<TData>,
  Record<string, never>,
  NovaChartBubbleSeriesProps<TData>
>

export type ChartBubbleSeriesNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartBubbleSeriesProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_BUBBLE_SERIES_SCHEMA_TYPE = 'NovaCharts.BubbleSeries'

export function createChartBubbleSeriesDescriptor(createNode?: ChartBubbleSeriesNodeFactory): ChartBubbleSeriesDescriptor {
  const descriptor: ChartBubbleSeriesDescriptor = {
    type: CHART_BUBBLE_SERIES_SCHEMA_TYPE,
    name: 'NovaCharts.BubbleSeries',
    title: 'NovaCharts.BubbleSeries',
    version: '0.1.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      xScaleId: { type: 'string' },
      yScaleId: { type: 'string' },
      xField: { type: 'field' },
      yField: { type: 'field' },
      sizeField: { type: 'field' },
      seriesField: { type: 'field' },
      labelField: { type: 'field' },
      radiusRange: { type: 'record' },
      sizeScale: { type: 'string' },
      minRadius: { type: 'number' },
      maxRadius: { type: 'number' },
      fill: { type: 'record' },
      strokeColor: { type: 'record' },
      strokeWidth: { type: 'number' },
      opacity: { type: 'number' },
      colors: { type: 'record' },
      highlight: { type: 'record' },
      hitRadiusPx: { type: 'number' },
      virtualization: { type: 'record' },
    },
    normalize: schema => normalizeChartBubbleSeriesProps(schema.props as NovaChartBubbleSeriesProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartBubbleSeriesProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_BUBBLE_SERIES_NODE_DESCRIPTOR = createChartBubbleSeriesDescriptor()

export { normalizeChartBubbleSeriesProps }
