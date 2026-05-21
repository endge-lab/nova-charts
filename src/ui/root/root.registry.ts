import type { NovaSchemaRegistry } from '@endge/nova'
import { ChartRoot } from '@/ui/root/Root'
import {
  CHART_ROOT_NODE_DESCRIPTOR,
  createChartRootDescriptor,
  normalizeChartRootProps,
  type ChartRootDescriptor,
} from '@/ui/root/root.config'
import type { NovaChartRootProps } from '@/model/types/chart-components.types'

export const CHART_ROOT_DESCRIPTOR: ChartRootDescriptor = createChartRootDescriptor((context, schema) => {
  return new ChartRoot(
    context.app,
    context.surface,
    normalizeChartRootProps(schema.props as NovaChartRootProps),
    {
      componentId: schema.id,
      children: schema.children ?? [],
    },
    CHART_ROOT_DESCRIPTOR,
  )
})

export function registerChartRoot(registry: NovaSchemaRegistry): void {
  registry.register(CHART_ROOT_DESCRIPTOR, { override: true })
}

export { CHART_ROOT_NODE_DESCRIPTOR }
