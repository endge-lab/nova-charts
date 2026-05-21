import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartLegendApi,
  NovaChartLegendProps,
  NovaChartLegendResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartLegendProps,
} from '@/ui/shared/chart-props'

export type ChartLegendDescriptor = NovaComponentDescriptor<
  NovaChartLegendResolvedProps,
  NovaChartLegendApi,
  Record<string, never>,
  NovaChartLegendProps
>

export type ChartLegendNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartLegendProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_LEGEND_SCHEMA_TYPE = 'NovaCharts.Legend'

export function createChartLegendDescriptor(createNode?: ChartLegendNodeFactory): ChartLegendDescriptor {
  const descriptor: ChartLegendDescriptor = {
    type: CHART_LEGEND_SCHEMA_TYPE,
    name: 'NovaCharts.Legend',
    title: 'NovaCharts.Legend',
    version: '0.4.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      orientation: { type: 'string' },
      hiddenSeriesIds: { type: 'array' },
      labels: { type: 'record' },
    },
    normalize: schema => normalizeChartLegendProps(schema.props as NovaChartLegendProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartLegendProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_LEGEND_NODE_DESCRIPTOR = createChartLegendDescriptor()

export { normalizeChartLegendProps }
