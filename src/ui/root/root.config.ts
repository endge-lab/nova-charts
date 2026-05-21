import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartRootApi,
  NovaChartRootProps,
  NovaChartRootResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartRootProps,
} from '@/ui/shared/chart-props'

export type ChartRootDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartRootResolvedProps<TData>,
  NovaChartRootApi<TData>,
  Record<string, never>,
  NovaChartRootProps<TData>
>

export type ChartRootNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartRootProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_ROOT_SCHEMA_TYPE = 'NovaCharts.Root'

export function createChartRootDescriptor(createNode?: ChartRootNodeFactory): ChartRootDescriptor {
  const descriptor: ChartRootDescriptor = {
    type: CHART_ROOT_SCHEMA_TYPE,
    name: 'NovaCharts.Root',
    title: 'NovaCharts.Root',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      data: { type: 'array' },
      keyField: { type: 'field' },
      refScope: { type: 'record' },
    },
    normalize: schema => normalizeChartRootProps(schema.props),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartRootProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_ROOT_NODE_DESCRIPTOR = createChartRootDescriptor()

export { normalizeChartRootProps }
