import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartInteractionApi,
  NovaChartInteractionProps,
  NovaChartInteractionResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartInteractionProps,
} from '@/ui/shared/chart-props'

export type ChartInteractionDescriptor = NovaComponentDescriptor<
  NovaChartInteractionResolvedProps,
  NovaChartInteractionApi,
  Record<string, never>,
  NovaChartInteractionProps
>

export type ChartInteractionNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartInteractionProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_INTERACTION_SCHEMA_TYPE = 'NovaCharts.Interaction'

export function createChartInteractionDescriptor(createNode?: ChartInteractionNodeFactory): ChartInteractionDescriptor {
  const descriptor: ChartInteractionDescriptor = {
    type: CHART_INTERACTION_SCHEMA_TYPE,
    name: 'NovaCharts.Interaction',
    title: 'NovaCharts.Interaction',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      chartRef: { type: 'string' },
      enabled: { type: 'boolean' },
      hover: { type: 'boolean' },
      tooltip: { type: 'boolean' },
      mode: { type: 'string' },
      maxDistancePx: { type: 'number' },
      seriesIds: { type: 'array' },
    },
    normalize: schema => normalizeChartInteractionProps(schema.props),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartInteractionProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_INTERACTION_NODE_DESCRIPTOR = createChartInteractionDescriptor()

export { normalizeChartInteractionProps }
