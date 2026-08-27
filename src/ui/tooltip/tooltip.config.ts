import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartTooltipApi,
  NovaChartTooltipProps,
  NovaChartTooltipResolvedProps,
} from '@/model/types/chart-components.types'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import {
  normalizeChartTooltipProps,
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
} from '@/ui/shared/chart-props'

export type ChartTooltipDescriptor = NovaComponentDescriptor<
  NovaChartTooltipResolvedProps,
  NovaChartTooltipApi,
  Record<string, never>,
  NovaChartTooltipProps
>

export type ChartTooltipNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartTooltipProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_TOOLTIP_SCHEMA_TYPE = 'NovaCharts.Tooltip'

export function createChartTooltipDescriptor(createNode?: ChartTooltipNodeFactory): ChartTooltipDescriptor {
  const descriptor: ChartTooltipDescriptor = {
    type: CHART_TOOLTIP_SCHEMA_TYPE,
    name: 'NovaCharts.Tooltip',
    title: 'NovaCharts.Tooltip',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      enabled: { type: 'boolean' },
      offsetX: { type: 'number' },
      offsetY: { type: 'number' },
      maxWidth: { type: 'number' },
      background: { type: 'string' },
      color: { type: 'string' },
      borderColor: { type: 'string' },
      content: { type: 'record' },
      contentFormatter: { type: 'function' },
      labelFormatter: { type: 'function' },
      valueFormatter: { type: 'function' },
      placement: { type: 'string' },
      collision: { type: 'record' },
      followCursor: { type: 'boolean' },
      animation: { type: 'record' },
    },
    normalize: schema => normalizeChartTooltipProps(schema.props),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartTooltipProps),
  }

  if (createNode) {
    descriptor.createNode = createNode
  }
  return descriptor
}

export const CHART_TOOLTIP_NODE_DESCRIPTOR = createChartTooltipDescriptor()

export { normalizeChartTooltipProps }
