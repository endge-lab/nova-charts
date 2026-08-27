import type { NovaSchemaRegistry } from '@endge/nova'
import type { NovaChartInteractionProps } from '@/model/types/chart-components.types'
import type { ChartInteractionDescriptor } from '@/ui/interaction/interaction.config'
import { ChartInteraction } from '@/ui/interaction/Interaction'
import {

  createChartInteractionDescriptor,
  normalizeChartInteractionProps,
} from '@/ui/interaction/interaction.config'

export const CHART_INTERACTION_DESCRIPTOR: ChartInteractionDescriptor = createChartInteractionDescriptor((context, schema) => {
  return new ChartInteraction(
    context.app,
    context.surface,
    normalizeChartInteractionProps(schema.props as NovaChartInteractionProps),
    { componentId: schema.id },
    CHART_INTERACTION_DESCRIPTOR,
  )
})

export function registerChartInteraction(registry: NovaSchemaRegistry): void {
  registry.register(CHART_INTERACTION_DESCRIPTOR, { override: true })
}
