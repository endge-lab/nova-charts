import type {
  NovaComponentCreateContext,
  NovaComponentDescriptor,
  NovaComponentNode,
  NovaComponentSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import { commonMeasureBounds } from '@endge/nova-ui-kit'
import type {
  NovaChartScaleApi,
  NovaChartScaleProps,
  NovaChartScaleResolvedProps,
} from '@/model/types/chart-components.types'
import {
  NOVA_CHARTS_COMMON_DIRTY_POLICY,
  NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
  normalizeChartScaleProps,
} from '@/ui/shared/chart-props'

export type ChartScaleDescriptor<TData = Record<string, unknown>> = NovaComponentDescriptor<
  NovaChartScaleResolvedProps<TData>,
  NovaChartScaleApi,
  Record<string, never>,
  NovaChartScaleProps<TData>
>

export type ChartScaleNodeFactory = <E extends EventList>(
  context: NovaComponentCreateContext<E>,
  schema: NovaComponentSchema<NovaChartScaleProps>,
) => NovaComponentNode<any, any, any, any, E>

export const CHART_SCALE_SCHEMA_TYPE = 'NovaCharts.Scale'

export function createChartScaleDescriptor(createNode?: ChartScaleNodeFactory): ChartScaleDescriptor {
  const descriptor: ChartScaleDescriptor = {
    type: CHART_SCALE_SCHEMA_TYPE,
    name: 'NovaCharts.Scale',
    title: 'NovaCharts.Scale',
    version: '0.2.0',
    kind: 'node-component',
    dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
    fields: {
      ...NOVA_CHARTS_COMMON_FIELD_DEFINITIONS,
      scaleId: { type: 'string' },
      scaleType: { type: 'string' },
      field: { type: 'field' },
      domain: { type: 'array' },
      zero: { type: 'boolean' },
      nice: { type: 'boolean' },
      clamp: { type: 'boolean' },
      paddingInner: { type: 'number' },
      paddingOuter: { type: 'number' },
      locale: { type: 'string' },
      timezone: { type: 'string' },
    },
    normalize: schema => normalizeChartScaleProps(schema.props as NovaChartScaleProps),
    measureBounds: (_context, schema) => commonMeasureBounds(schema, normalizeChartScaleProps),
  }

  if (createNode) descriptor.createNode = createNode
  return descriptor
}

export const CHART_SCALE_NODE_DESCRIPTOR = createChartScaleDescriptor()

export { normalizeChartScaleProps }
