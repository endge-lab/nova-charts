import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartComposedChartApi,
  NovaChartComposedChartProps,
  NovaChartComposedChartResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartComposedChartProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartComposedChartDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartComposedChartResolvedProps<TData>,
  NovaChartComposedChartApi<TData>,
  Record<string, never>,
  NovaChartComposedChartProps<TData>
>

export type ChartComposedChartNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartComposedChartProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_COMPOSED_CHART_SCHEMA_TYPE = 'NovaCharts.ComposedChart'

export function createChartComposedChartDescriptor(createNode?: ChartComposedChartNodeFactory): ChartComposedChartDescriptor {
  const descriptor: ChartComposedChartDescriptor = {
    type: CHART_COMPOSED_CHART_SCHEMA_TYPE,
    name: 'NovaCharts.ComposedChart',
    title: 'NovaCharts.ComposedChart',
    version: '0.1.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      data: { type: 'record' },
      keyField: { type: 'field' },
      xAxis: { type: 'record' },
      yAxis: { type: 'record' },
      series: { type: 'record' },
      grid: { type: 'record' },
      axes: { type: 'record' },
      legend: { type: 'record' },
      tooltip: { type: 'record' },
      interaction: { type: 'record' },
      viewport: { type: 'record' },
      children: { type: 'record' },
    },
    normalize: schema => normalizeChartComposedChartProps(schema.props as NovaChartComposedChartProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartComposedChartProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_COMPOSED_CHART_NODE_DESCRIPTOR = createChartComposedChartDescriptor()

export { normalizeChartComposedChartProps }
