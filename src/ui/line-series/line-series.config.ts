import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartLineSeriesApi,
  NovaChartLineSeriesProps,
  NovaChartLineSeriesResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartLineSeriesProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartLineSeriesDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartLineSeriesResolvedProps<TData>,
  NovaChartLineSeriesApi<TData>,
  Record<string, never>,
  NovaChartLineSeriesProps<TData>
>

export type ChartLineSeriesNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartLineSeriesProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_LINE_SERIES_SCHEMA_TYPE = 'NovaCharts.LineSeries'

export function createChartLineSeriesDescriptor(createNode?: ChartLineSeriesNodeFactory): ChartLineSeriesDescriptor {
  const descriptor: ChartLineSeriesDescriptor = {
    type: CHART_LINE_SERIES_SCHEMA_TYPE,
    name: 'NovaCharts.LineSeries',
    title: 'NovaCharts.LineSeries',
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
      curve: { type: 'string' },
      stroke: { type: 'string' },
      strokeWidth: { type: 'number' },
      opacity: { type: 'number' },
      dashPattern: { type: 'record' },
      markers: { type: 'record' },
      colors: { type: 'record' },
      defined: { type: 'record' },
      connectNulls: { type: 'boolean' },
      hitRadiusPx: { type: 'number' },
      virtualization: { type: 'record' },
    },
    normalize: schema => normalizeChartLineSeriesProps(schema.props as NovaChartLineSeriesProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartLineSeriesProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_LINE_SERIES_NODE_DESCRIPTOR = createChartLineSeriesDescriptor()

export { normalizeChartLineSeriesProps }
