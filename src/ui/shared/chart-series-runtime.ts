import type { NovaChartRuntime } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartInteractiveSeriesApi,
  NovaChartScaleDomainContribution,
  NovaChartSeriesDiagnostics,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

interface ChartSeriesRuntimeOwner {
  componentId: string
  dirty: (flags: { update?: boolean, render?: boolean }) => void
  props: {
    chartRef?: string
  }
}

/**
 * Общий runtime lifecycle для chart series providers.
 */
export class ChartSeriesRuntimeBinding<TData = Record<string, unknown>> {
  private _contributionIds = new Set<string>()

  /**
   * Создает binding для конкретной series node.
   */
  constructor(
    private readonly _owner: ChartSeriesRuntimeOwner,
    private readonly _api: NovaChartInteractiveSeriesApi<TData>,
  ) {}

  /**
   * Возвращает runtime текущего chart root.
   */
  runtime(): NovaChartRuntime<TData> | null {
    return resolveNovaChartRuntime<TData>(this._owner as any, this._owner.props.chartRef) ?? null
  }

  /**
   * Регистрирует series как interactive provider.
   */
  syncInteractive(): void {
    const runtime = this.runtime()
    runtime?.registerInteractiveSeries({
      id: this._owner.componentId,
      api: this._api,
      dirty: () => this._owner.dirty({ render: true }),
    })
  }

  /**
   * Публикует scale domain contributions.
   */
  publishContributions(runtime: NovaChartRuntime<TData>, contributions: Array<NovaChartScaleDomainContribution>): void {
    const nextIds = new Set(contributions.map(item => item.id))
    for (const id of this._contributionIds) {
      if (!nextIds.has(id)) {
        runtime.removeScaleDomainContribution(id)
      }
    }
    this._contributionIds = nextIds
    for (const contribution of contributions) {
      runtime.setScaleDomainContribution(contribution)
    }
  }

  /**
   * Публикует generic metadata для legend.
   */
  publishMetadata(runtime: NovaChartRuntime<TData>, metadata: Array<NovaChartSeriesMetadata>): void {
    runtime.setSeriesMetadata(this._owner.componentId, metadata)
  }

  /**
   * Публикует diagnostics series.
   */
  publishDiagnostics(runtime: NovaChartRuntime<TData>, diagnostics: NovaChartSeriesDiagnostics): void {
    runtime.setSeriesDiagnostics(this._owner.componentId, diagnostics)
  }

  /**
   * Чистит runtime регистрации на unmount.
   */
  cleanup(): void {
    const runtime = this.runtime()
    if (!runtime) {
      return
    }
    runtime.unregisterInteractiveSeries(this._owner.componentId)
    for (const id of this._contributionIds) {
      runtime.removeScaleDomainContribution(id)
    }
    this._contributionIds.clear()
    runtime.clearSemanticRegions(`${this._owner.componentId}:marks`)
    runtime.removeSeriesMetadata(this._owner.componentId)
    runtime.removeSeriesDiagnostics(this._owner.componentId)
  }
}
