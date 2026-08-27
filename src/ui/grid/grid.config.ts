import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartGridApi,
  NovaChartGridProps,
  NovaChartGridResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartGridProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartGridDescriptor = NovaComponentDescriptor<
  NovaChartGridResolvedProps,
  NovaChartGridApi,
  Record<string, never>,
  NovaChartGridProps
>

export type ChartGridNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartGridProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_GRID_SCHEMA_TYPE = 'NovaCharts.Grid'

export function createChartGridDescriptor(createNode?: ChartGridNodeFactory): ChartGridDescriptor {
  const descriptor: ChartGridDescriptor = {
    type: CHART_GRID_SCHEMA_TYPE,
    name: 'NovaCharts.Grid',
    title: 'NovaCharts.Grid',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      xScaleId: { type: 'string' },
      yScaleId: { type: 'string' },
      xTicks: { type: 'record' },
      yTicks: { type: 'record' },
      lineColor: { type: 'string' },
    },
    normalize: schema => normalizeChartGridProps(schema.props),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartGridProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_GRID_NODE_DESCRIPTOR = createChartGridDescriptor()

export { normalizeChartGridProps }
