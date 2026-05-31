import { Nova } from '@endge/nova'
import type { NovaScope, NovaSemanticRegisterOptions, NovaTemplateChildSchema } from '@endge/nova'
import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type { ChartScaleRegistry } from '@/model/scale/ChartScaleRegistry'
import type {
  ChartScale,
  ChartScaleDomain,
  ChartScaleRange,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import type {
  NovaChartBarSeriesDiagnostics,
  NovaChartDataListener,
  NovaChartInteractiveSeriesRegistration,
  NovaChartInteractionListener,
  NovaChartInteractionState,
  NovaChartRootApi,
  NovaChartRootDiagnostics,
  NovaChartRootResolvedProps,
  NovaChartScaleResolvedProps,
  NovaChartScaleDomainContribution,
  NovaChartSeriesMetadata,
  NovaChartSeriesDiagnostics,
} from '@/model/types/chart-components.types'
import type { NovaChartCustomizationRuntime } from '@/model/customization/chart-customization'

export const NovaChartRuntimeToken = Nova.createContextToken<NovaChartRuntime>('NovaCharts.Runtime')

export interface NovaChartScaleRegistration<TData = Record<string, unknown>> {
  id: string
  props: NovaChartScaleResolvedProps<TData>
  scale: ChartScale
}

export interface NovaChartRuntime<TData = Record<string, unknown>> {
  readonly id: string
  readonly props: NovaChartRootResolvedProps<TData>
  readonly dataStore: ChartDataStore<TData>
  readonly scales: ChartScaleRegistry
  readonly customization: NovaChartCustomizationRuntime<TData>
  refScope?: NovaScope

  registerScale: (registration: NovaChartScaleRegistration<TData>) => void
  unregisterScale: (id: string) => void
  refreshScale: (id: string) => void
  refreshScales: () => void
  getScale: <TValue extends ChartScaleValue = ChartScaleValue>(id: string) => ChartScale<TValue> | undefined
  requireScale: <TValue extends ChartScaleValue = ChartScaleValue>(id: string) => ChartScale<TValue>
  setScaleDomain: (id: string, domain: ChartScaleDomain) => void
  setScaleRange: (id: string, range: ChartScaleRange) => void
  getScaleSourceDomain: (id: string) => ChartScaleDomain | undefined
  setScaleDomainContribution: (contribution: NovaChartScaleDomainContribution) => void
  removeScaleDomainContribution: (id: string) => void
  getScaleDomainContributions: (scaleId?: string) => Array<NovaChartScaleDomainContribution>
  setChildren: (children: Array<NovaTemplateChildSchema>) => void
  refresh: (event?: string) => void
  registerInteractiveSeries: (registration: NovaChartInteractiveSeriesRegistration<TData>) => void
  unregisterInteractiveSeries: (id: string) => void
  getInteractiveSeries: () => Array<NovaChartInteractiveSeriesRegistration<TData>>
  getInteractionState: () => NovaChartInteractionState<TData>
  setInteractionState: (patch: Partial<Omit<NovaChartInteractionState<TData>, 'revision'>>) => void
  subscribeInteraction: (listener: NovaChartInteractionListener<TData>) => () => void
  setSeriesDiagnostics: (id: string, diagnostics: NovaChartSeriesDiagnostics | NovaChartBarSeriesDiagnostics) => void
  removeSeriesDiagnostics: (id: string) => void
  setSeriesMetadata: (id: string, metadata: Array<NovaChartSeriesMetadata>) => void
  removeSeriesMetadata: (id: string) => void
  getSeriesMetadata: () => Array<NovaChartSeriesMetadata>
  publishSemanticRegions: (sourceId: string, regions: Array<NovaSemanticRegisterOptions>) => void
  clearSemanticRegions: (sourceId: string) => void
  getDiagnostics: () => NovaChartRootDiagnostics<TData>
  subscribe: (listener: NovaChartDataListener<TData>) => () => void
  getApi: () => NovaChartRootApi<TData>
}

export interface NovaChartRuntimeHost<TData = Record<string, unknown>> {
  getNovaChartRuntime: () => NovaChartRuntime<TData>
}

export function isNovaChartRuntimeHost<TData = Record<string, unknown>>(
  value: unknown,
): value is NovaChartRuntimeHost<TData> {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Partial<NovaChartRuntimeHost<TData>>).getNovaChartRuntime === 'function'
}
