import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartPlotApi,
  NovaChartPlotProps,
  NovaChartPlotResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartPlotProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartPlotDescriptor = NovaComponentDescriptor<
  NovaChartPlotResolvedProps,
  NovaChartPlotApi,
  Record<string, never>,
  NovaChartPlotProps
>

export type ChartPlotNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartPlotProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_PLOT_SCHEMA_TYPE = 'NovaCharts.Plot'

export function createChartPlotDescriptor(createNode?: ChartPlotNodeFactory): ChartPlotDescriptor {
  const descriptor: ChartPlotDescriptor = {
    type: CHART_PLOT_SCHEMA_TYPE,
    name: 'NovaCharts.Plot',
    title: 'NovaCharts.Plot',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      xScaleId: { type: 'string' },
      yScaleId: { type: 'string' },
    },
    normalize: schema => normalizeChartPlotProps(schema.props),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartPlotProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_PLOT_NODE_DESCRIPTOR = createChartPlotDescriptor()

export { normalizeChartPlotProps }
