import type {
  NovaChartInteractiveSeriesApi,
  NovaChartScaleDomainContribution,
  NovaChartSeriesDiagnostics,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

interface ChartSeriesRuntimeOwner {
  componentId: string
  dirty: (flags: { update?: boolean; render?: boolean }) => void
  props: {
    chartRef?: string
  }
}

/**
 * Общий runtime lifecycle для chart series providers.
 */
export class ChartSeriesRuntimeBinding<TData = Record<string, unknown>> {
  private contributionIds = new Set<string>()

  /**
   * Создает binding для конкретной series node.
   */
  constructor(
    private readonly owner: ChartSeriesRuntimeOwner,
    private readonly api: NovaChartInteractiveSeriesApi<TData>,
  ) {}

  /**
   * Возвращает runtime текущего chart root.
   */
  runtime(): NovaChartRuntime<TData> | null {
    return resolveNovaChartRuntime<TData>(this.owner as any, this.owner.props.chartRef) ?? null
  }

  /**
   * Регистрирует series как interactive provider.
   */
  syncInteractive(): void {
    const runtime = this.runtime()
    runtime?.registerInteractiveSeries({
      id: this.owner.componentId,
      api: this.api,
      dirty: () => this.owner.dirty({ render: true }),
    })
  }

  /**
   * Публикует scale domain contributions.
   */
  publishContributions(runtime: NovaChartRuntime<TData>, contributions: Array<NovaChartScaleDomainContribution>): void {
    const nextIds = new Set(contributions.map(item => item.id))
    for (const id of this.contributionIds) {
      if (!nextIds.has(id)) runtime.removeScaleDomainContribution(id)
    }
    this.contributionIds = nextIds
    for (const contribution of contributions) runtime.setScaleDomainContribution(contribution)
  }

  /**
   * Публикует generic metadata для legend.
   */
  publishMetadata(runtime: NovaChartRuntime<TData>, metadata: Array<NovaChartSeriesMetadata>): void {
    runtime.setSeriesMetadata(this.owner.componentId, metadata)
  }

  /**
   * Публикует diagnostics series.
   */
  publishDiagnostics(runtime: NovaChartRuntime<TData>, diagnostics: NovaChartSeriesDiagnostics): void {
    runtime.setSeriesDiagnostics(this.owner.componentId, diagnostics)
  }

  /**
   * Чистит runtime регистрации на unmount.
   */
  cleanup(): void {
    const runtime = this.runtime()
    if (!runtime) return
    runtime.unregisterInteractiveSeries(this.owner.componentId)
    for (const id of this.contributionIds) runtime.removeScaleDomainContribution(id)
    this.contributionIds.clear()
    runtime.clearSemanticRegions(`${this.owner.componentId}:marks`)
    runtime.removeSeriesMetadata(this.owner.componentId)
    runtime.removeSeriesDiagnostics(this.owner.componentId)
  }
}
