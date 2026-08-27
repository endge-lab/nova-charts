import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartScatterSeriesApi,
  NovaChartScatterSeriesProps,
  NovaChartScatterSeriesResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartScatterSeriesProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartScatterSeriesDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartScatterSeriesResolvedProps<TData>,
  NovaChartScatterSeriesApi<TData>,
  Record<string, never>,
  NovaChartScatterSeriesProps<TData>
>

export type ChartScatterSeriesNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartScatterSeriesProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_SCATTER_SERIES_SCHEMA_TYPE = 'NovaCharts.ScatterSeries'

export function createChartScatterSeriesDescriptor(createNode?: ChartScatterSeriesNodeFactory): ChartScatterSeriesDescriptor {
  const descriptor: ChartScatterSeriesDescriptor = {
    type: CHART_SCATTER_SERIES_SCHEMA_TYPE,
    name: 'NovaCharts.ScatterSeries',
    title: 'NovaCharts.ScatterSeries',
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
      seriesField: { type: 'field' },
      labelField: { type: 'field' },
      radius: { type: 'record' },
      fill: { type: 'record' },
      strokeColor: { type: 'record' },
      strokeWidth: { type: 'number' },
      opacity: { type: 'number' },
      colors: { type: 'record' },
      highlight: { type: 'record' },
      hitRadiusPx: { type: 'number' },
      virtualization: { type: 'record' },
    },
    normalize: schema => normalizeChartScatterSeriesProps(schema.props as NovaChartScatterSeriesProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartScatterSeriesProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_SCATTER_SERIES_NODE_DESCRIPTOR = createChartScatterSeriesDescriptor()

export { normalizeChartScatterSeriesProps }
