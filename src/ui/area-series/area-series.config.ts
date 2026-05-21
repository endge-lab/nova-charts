import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartAreaSeriesApi,
  NovaChartAreaSeriesProps,
  NovaChartAreaSeriesResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartAreaSeriesProps,
} from '@/ui/shared/chart-props'

export type ChartAreaSeriesDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartAreaSeriesResolvedProps<TData>,
  NovaChartAreaSeriesApi<TData>,
  Record<string, never>,
  NovaChartAreaSeriesProps<TData>
>

export type ChartAreaSeriesNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartAreaSeriesProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_AREA_SERIES_SCHEMA_TYPE = 'NovaCharts.AreaSeries'

export function createChartAreaSeriesDescriptor(createNode?: ChartAreaSeriesNodeFactory): ChartAreaSeriesDescriptor {
  const descriptor: ChartAreaSeriesDescriptor = {
    type: CHART_AREA_SERIES_SCHEMA_TYPE,
    name: 'NovaCharts.AreaSeries',
    title: 'NovaCharts.AreaSeries',
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
      baselineValue: { type: 'number' },
      baselineField: { type: 'field' },
      mode: { type: 'string' },
      fill: { type: 'string' },
      stroke: { type: 'string' },
      strokeWidth: { type: 'number' },
      opacity: { type: 'number' },
      colors: { type: 'record' },
      markers: { type: 'record' },
      defined: { type: 'record' },
      connectNulls: { type: 'boolean' },
      hitRadiusPx: { type: 'number' },
      virtualization: { type: 'record' },
    },
    normalize: schema => normalizeChartAreaSeriesProps(schema.props as NovaChartAreaSeriesProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartAreaSeriesProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_AREA_SERIES_NODE_DESCRIPTOR = createChartAreaSeriesDescriptor()

export { normalizeChartAreaSeriesProps }
