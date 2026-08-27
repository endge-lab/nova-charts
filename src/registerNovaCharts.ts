import type { NovaComponentDescriptor, NovaSchemaRegistry } from '@endge/nova'
import { CHART_AREA_SERIES_DESCRIPTOR } from '@/ui/area-series/area-series.registry'
import { CHART_AXIS_DESCRIPTOR } from '@/ui/axis/axis.registry'
import { CHART_BAR_CHART_DESCRIPTOR } from '@/ui/bar-chart/bar-chart.registry'
import { CHART_BAR_SERIES_DESCRIPTOR } from '@/ui/bar-series/bar-series.registry'
import { CHART_BUBBLE_SERIES_DESCRIPTOR } from '@/ui/bubble-series/bubble-series.registry'
import { CHART_COMPOSED_CHART_DESCRIPTOR } from '@/ui/composed-chart/composed-chart.registry'
import { CHART_GRID_DESCRIPTOR } from '@/ui/grid/grid.registry'
import { CHART_INTERACTION_DESCRIPTOR } from '@/ui/interaction/interaction.registry'
import { CHART_LEGEND_DESCRIPTOR } from '@/ui/legend/legend.registry'
import { CHART_LINE_SERIES_DESCRIPTOR } from '@/ui/line-series/line-series.registry'
import { CHART_PLOT_DESCRIPTOR } from '@/ui/plot/plot.registry'
import { CHART_ROOT_DESCRIPTOR } from '@/ui/root/root.registry'
import { CHART_SCALE_DESCRIPTOR } from '@/ui/scale/scale.registry'
import { CHART_SCATTER_SERIES_DESCRIPTOR } from '@/ui/scatter-series/scatter-series.registry'
import { CHART_TOOLTIP_DESCRIPTOR } from '@/ui/tooltip/tooltip.registry'
import { CHART_VIEWPORT_CONTROLLER_DESCRIPTOR } from '@/ui/viewport-controller/viewport-controller.registry'
import { CHART_VIEWPORT_DESCRIPTOR } from '@/ui/viewport/viewport.registry'

const NOVA_CHARTS_DESCRIPTORS: Array<NovaComponentDescriptor<any, any, any, any>> = [
  CHART_ROOT_DESCRIPTOR,
  CHART_SCALE_DESCRIPTOR,
  CHART_PLOT_DESCRIPTOR,
  CHART_AXIS_DESCRIPTOR,
  CHART_GRID_DESCRIPTOR,
  CHART_BAR_CHART_DESCRIPTOR,
  CHART_COMPOSED_CHART_DESCRIPTOR,
  CHART_BAR_SERIES_DESCRIPTOR,
  CHART_LINE_SERIES_DESCRIPTOR,
  CHART_AREA_SERIES_DESCRIPTOR,
  CHART_SCATTER_SERIES_DESCRIPTOR,
  CHART_BUBBLE_SERIES_DESCRIPTOR,
  CHART_INTERACTION_DESCRIPTOR,
  CHART_TOOLTIP_DESCRIPTOR,
  CHART_VIEWPORT_CONTROLLER_DESCRIPTOR,
  CHART_VIEWPORT_DESCRIPTOR,
  CHART_LEGEND_DESCRIPTOR,
]

export function registerNovaCharts(registry: NovaSchemaRegistry): void {
  for (const descriptor of NOVA_CHARTS_DESCRIPTORS) {
    registry.reserveTag(descriptor.name)
    registry.register(descriptor, { override: true })
  }
}
