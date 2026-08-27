import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartAxisApi,
  NovaChartAxisProps,
  NovaChartAxisResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartAxisProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartAxisDescriptor = NovaComponentDescriptor<
  NovaChartAxisResolvedProps,
  NovaChartAxisApi,
  Record<string, never>,
  NovaChartAxisProps
>

export type ChartAxisNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartAxisProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_AXIS_SCHEMA_TYPE = 'NovaCharts.Axis'

export function createChartAxisDescriptor(createNode?: ChartAxisNodeFactory): ChartAxisDescriptor {
  const descriptor: ChartAxisDescriptor = {
    type: CHART_AXIS_SCHEMA_TYPE,
    name: 'NovaCharts.Axis',
    title: 'NovaCharts.Axis',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      scaleId: { type: 'string' },
      orientation: { type: 'string' },
      tickSide: { type: 'string' },
      labelSide: { type: 'string' },
      labelRotation: { type: 'string' },
      tickSize: { type: 'number' },
      labelPadding: { type: 'number' },
      ticks: { type: 'record' },
      lineColor: { type: 'string' },
      tickColor: { type: 'string' },
      labelColor: { type: 'string' },
    },
    normalize: schema => normalizeChartAxisProps(schema.props as NovaChartAxisProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartAxisProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_AXIS_NODE_DESCRIPTOR = createChartAxisDescriptor()

export { normalizeChartAxisProps }
