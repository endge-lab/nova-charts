import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartBarSeriesApi,
  NovaChartBarSeriesProps,
  NovaChartBarSeriesResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartBarSeriesProps,
} from '@/ui/shared/chart-props'

export type ChartBarSeriesDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartBarSeriesResolvedProps<TData>,
  NovaChartBarSeriesApi<TData>,
  Record<string, never>,
  NovaChartBarSeriesProps<TData>
>

export type ChartBarSeriesNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartBarSeriesProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_BAR_SERIES_SCHEMA_TYPE = 'NovaCharts.BarSeries'

export function createChartBarSeriesDescriptor(createNode?: ChartBarSeriesNodeFactory): ChartBarSeriesDescriptor {
  const descriptor: ChartBarSeriesDescriptor = {
    type: CHART_BAR_SERIES_SCHEMA_TYPE,
    name: 'NovaCharts.BarSeries',
    title: 'NovaCharts.BarSeries',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      xScaleId: { type: 'string' },
      yScaleId: { type: 'string' },
      xField: { type: 'field' },
      yField: { type: 'field' },
      categoryField: { type: 'field' },
      valueField: { type: 'field' },
      seriesField: { type: 'field' },
      labelField: { type: 'field' },
      orientation: { type: 'string' },
      mode: { type: 'string' },
      fill: { type: 'string' },
      radius: { type: 'number' },
      minBarSize: { type: 'number' },
      virtualization: { type: 'record' },
      highlight: { type: 'record' },
      labels: { type: 'record' },
      colors: { type: 'record' },
    },
    normalize: schema => normalizeChartBarSeriesProps(schema.props as NovaChartBarSeriesProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartBarSeriesProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_BAR_SERIES_NODE_DESCRIPTOR = createChartBarSeriesDescriptor()

export { normalizeChartBarSeriesProps }
