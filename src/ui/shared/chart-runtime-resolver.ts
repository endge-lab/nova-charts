import type { NovaComponentNode } from '@endge/nova'
import {
  NovaChartRuntimeToken,
  isNovaChartRuntimeHost,
  type NovaChartRuntime,
} from '@/model/context/nova-chart-runtime'

export function resolveNovaChartRuntime<TData>(
  node: NovaComponentNode<any>,
  chartRef?: string,
): NovaChartRuntime<TData> | null {
  const scoped = node.injectOptional(NovaChartRuntimeToken)
  if (scoped) return scoped as NovaChartRuntime<TData>

  if (!chartRef) return null
  const host = node.nova.components.get(chartRef)
  if (isNovaChartRuntimeHost<TData>(host)) return host.getNovaChartRuntime()
  return null
}

export function requireNovaChartRuntime<TData>(
  node: NovaComponentNode<any>,
  chartRef?: string,
): NovaChartRuntime<TData> {
  const runtime = resolveNovaChartRuntime<TData>(node, chartRef)
  if (!runtime) {
    throw new Error(`[NovaCharts] Chart runtime is not available${chartRef ? ` for "${chartRef}"` : ''}`)
  }
  return runtime
}
