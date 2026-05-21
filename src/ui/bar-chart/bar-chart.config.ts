import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartBarChartApi,
  NovaChartBarChartProps,
  NovaChartBarChartResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartBarChartProps,
} from '@/ui/shared/chart-props'

export type ChartBarChartDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartBarChartResolvedProps<TData>,
  NovaChartBarChartApi<TData>,
  Record<string, never>,
  NovaChartBarChartProps<TData>
>

export type ChartBarChartNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartBarChartProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_BAR_CHART_SCHEMA_TYPE = 'NovaCharts.BarChart'

export function createChartBarChartDescriptor<TData = Record<string, unknown>>(
  createNode?: ChartBarChartNodeFactory,
): ChartBarChartDescriptor<TData> {
  const descriptor: ChartBarChartDescriptor<TData> = {
    type: CHART_BAR_CHART_SCHEMA_TYPE,
    name: 'NovaCharts.BarChart',
    title: 'NovaCharts.BarChart',
    version: '0.4.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      data: { type: 'array' },
      keyField: { type: 'string' },
      categoryField: { type: 'field' },
      valueField: { type: 'field' },
      seriesField: { type: 'field' },
      orientation: { type: 'string' },
      mode: { type: 'string' },
      axes: { type: 'record' },
      grid: { type: 'any' },
      legend: { type: 'any' },
      tooltip: { type: 'any' },
      interaction: { type: 'any' },
      viewport: { type: 'any' },
      colors: { type: 'record' },
      labels: { type: 'record' },
      children: { type: 'array' },
    },
    normalize: schema => normalizeChartBarChartProps(schema.props as NovaChartBarChartProps<TData>),
    measureBounds: (_context, schema) => commonMeasureBounds(
      schema as NovaComponentSchema<NovaChartBarChartProps<TData>>,
      normalizeChartBarChartProps,
    ),
  }

  if (createNode) descriptor.createNode = createNode as any
  return descriptor
}

export const CHART_BAR_CHART_NODE_DESCRIPTOR = createChartBarChartDescriptor()

export { normalizeChartBarChartProps }
