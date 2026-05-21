import {
  reconcileNovaTemplateChildren,
  type NovaApp,
  type NovaExportImageOptions,
  type NovaNode,
  type NovaSemanticRegisterOptions,
  type NovaSemanticSnapshotOptions,
  type NovaSurface,
  type NovaTemplateChildSchema,
} from '@endge/nova'
import type { EventList } from '@endge/utils'
import {
  NovaUiComponentNode,
  buildBoxSchema,
  type NovaUiLayoutRect,
} from '@endge/nova-ui-kit'
import { ChartDataStore } from '@/model/data/ChartDataStore'
import { ChartScaleRegistry } from '@/model/scale/ChartScaleRegistry'
import { NovaChartCustomizationController } from '@/model/customization/chart-customization'
import { resolveScaleDomain } from '@/model/scale/resolve-chart-scale'
import {
  NovaChartRuntimeToken,
  type NovaChartRuntime,
  type NovaChartRuntimeHost,
  type NovaChartScaleRegistration,
} from '@/model/context/nova-chart-runtime'
import type {
  ChartScale,
  ChartNumericDomain,
  ChartScaleDomain,
  ChartScaleRange,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import type {
  NovaChartDataListener,
  NovaChartInteractiveSeriesRegistration,
  NovaChartInteractionListener,
  NovaChartInteractionState,
  NovaChartRootApi,
  NovaChartRootDiagnostics,
  NovaChartRootProps,
  NovaChartRootResolvedProps,
  NovaChartScaleDomainContribution,
  NovaChartSeriesDiagnostics,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import { CHART_ROOT_NODE_DESCRIPTOR, type ChartRootDescriptor } from '@/ui/root/root.config'

/**
 * Корень chart runtime: данные, шкалы, refs и подписки.
 */
export class ChartRoot<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartRootResolvedProps<TData>, NovaChartRootApi<TData>, NovaChartRootProps<TData>, E>
  implements NovaChartRuntimeHost<TData> {
  private readonly dataStore: ChartDataStore<TData>
  private readonly scales = new ChartScaleRegistry()
  private readonly managedChildren: Array<NovaNode<E>> = []
  private readonly scaleRegistrations = new Map<string, NovaChartScaleRegistration<TData>>()
  private readonly scaleSourceDomains = new Map<string, ChartScaleDomain>()
  private readonly scaleDomainContributions = new Map<string, NovaChartScaleDomainContribution>()
  private readonly seriesDiagnostics = new Map<string, NovaChartSeriesDiagnostics>()
  private readonly seriesMetadata = new Map<string, Array<NovaChartSeriesMetadata>>()
  private readonly interactiveSeries = new Map<string, NovaChartInteractiveSeriesRegistration<TData>>()
  private readonly listeners = new Set<NovaChartDataListener<TData>>()
  private readonly interactionListeners = new Set<NovaChartInteractionListener<TData>>()
  private readonly customization: NovaChartCustomizationController<TData>
  private readonly api: NovaChartRootApi<TData>
  private readonly runtime: NovaChartRuntime<TData>
  private interactionState: NovaChartInteractionState<TData> = {
    pointer: null,
    hovered: null,
    tooltipVisible: false,
    revision: 0,
  }
  private lastEvent = 'init'

  /**
   * Создает экземпляр ChartRoot и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartRootResolvedProps<TData>,
    options: { componentId?: string; children?: Array<NovaTemplateChildSchema> } = {},
    descriptor: ChartRootDescriptor<TData> = CHART_ROOT_NODE_DESCRIPTOR as ChartRootDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.dataStore = new ChartDataStore<TData>({
      data: props.data,
      keyField: props.keyField,
    })
    this.customization = new NovaChartCustomizationController<TData>(props, {
      id: this.componentId,
      getData: () => this.dataStore.getData(),
      getScale: id => this.getScale(id),
      getSeriesMetadata: () => this.getSeriesMetadata(),
      getInteractionState: () => this.getInteractionState(),
    })
    this.api = {
      setData: data => this.setData(data),
      getData: () => this.dataStore.getData(),
      updateRows: rows => this.updateRows(rows),
      removeRows: keys => this.removeRows(keys),
      getScale: id => this.getScale(id),
      requireScale: id => this.requireScale(id),
      setScaleDomain: (id, domain) => this.setScaleDomain(id, domain),
      setScaleRange: (id, range) => this.setScaleRange(id, range),
      getScaleSourceDomain: id => this.getScaleSourceDomain(id),
      setScaleDomainContribution: contribution => this.setScaleDomainContribution(contribution),
      removeScaleDomainContribution: id => this.removeScaleDomainContribution(id),
      getScaleDomainContributions: scaleId => this.getScaleDomainContributions(scaleId),
      refresh: () => this.refresh('api.refresh'),
      getDiagnostics: () => this.getDiagnostics(),
      getInteractionState: () => this.getInteractionState(),
      setInteractionState: patch => this.setInteractionState(patch),
      setChildren: children => this.setChildren(children),
      exportChart: exportOptions => this.exportChart(exportOptions),
      getSemanticSnapshot: snapshotOptions => this.getSemanticSnapshot(snapshotOptions),
      subscribe: listener => this.subscribe(listener),
      subscribeInteraction: listener => this.subscribeInteraction(listener),
    }
    this.runtime = {
      id: this.componentId,
      props: this.props,
      dataStore: this.dataStore,
      scales: this.scales,
      customization: this.customization,
      refScope: this.props.refScope,
      registerScale: registration => this.registerScale(registration),
      unregisterScale: id => this.unregisterScale(id),
      refreshScale: id => this.refreshScale(id),
      refreshScales: () => this.refreshScales(),
      getScale: id => this.getScale(id),
      requireScale: id => this.requireScale(id),
      setScaleDomain: (id, domain) => this.setScaleDomain(id, domain),
      setScaleRange: (id, range) => this.setScaleRange(id, range),
      getScaleSourceDomain: id => this.getScaleSourceDomain(id),
      setScaleDomainContribution: contribution => this.setScaleDomainContribution(contribution),
      removeScaleDomainContribution: id => this.removeScaleDomainContribution(id),
      getScaleDomainContributions: scaleId => this.getScaleDomainContributions(scaleId),
      setChildren: children => this.setChildren(children),
      refresh: event => this.refresh(event),
      registerInteractiveSeries: registration => this.registerInteractiveSeries(registration),
      unregisterInteractiveSeries: id => this.unregisterInteractiveSeries(id),
      getInteractiveSeries: () => this.getInteractiveSeries(),
      getInteractionState: () => this.getInteractionState(),
      setInteractionState: patch => this.setInteractionState(patch),
      subscribeInteraction: listener => this.subscribeInteraction(listener),
      setSeriesDiagnostics: (id, diagnostics) => this.setSeriesDiagnostics(id, diagnostics),
      removeSeriesDiagnostics: id => this.removeSeriesDiagnostics(id),
      setSeriesMetadata: (id, metadata) => this.setSeriesMetadata(id, metadata),
      removeSeriesMetadata: id => this.removeSeriesMetadata(id),
      getSeriesMetadata: () => this.getSeriesMetadata(),
      publishSemanticRegions: (sourceId, regions) => this.publishSemanticRegions(sourceId, regions),
      clearSemanticRegions: sourceId => this.clearSemanticRegions(sourceId),
      getDiagnostics: () => this.getDiagnostics(),
      subscribe: listener => this.subscribe(listener),
      getApi: () => this.api,
    }
    this.provide(NovaChartRuntimeToken, this.runtime as NovaChartRuntime<Record<string, unknown>>)
    this.setChildren(options.children ?? [])
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  override setProps(patch: Partial<NovaChartRootResolvedProps<TData>>): this {
    return super.setProps(patch as Partial<NovaChartRootResolvedProps<TData>>)
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  override getApi(): NovaChartRootApi<TData> {
    return this.api
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  getNovaChartRuntime(): NovaChartRuntime<TData> {
    return this.runtime
  }

  /**
   * Применяет подготовленное состояние ChartRoot.
   */
  override applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = super.applyLayoutRect(rect)
    if (changed) this.applyChildrenRect()
    return changed
  }

  /**
   * Обновляет runtime-состояние ChartRoot.
   */
  update(): void {
    this.applyChildrenRect()
  }

  /**
   * Выполняет отрисовку ChartRoot.
   */
  render(): void {
    const schema = buildBoxSchema(this.props, this.width, this.height)
    if (schema.length > 0) this.renderer.schema(schema)
    if (this.props.clip) this.renderer.clip(0, 0, this.width, this.height)
    this.syncRootSemantics()
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  setChildren(children: Array<NovaTemplateChildSchema>): void {
    const reconciled = reconcileNovaTemplateChildren(this, this.managedChildren, children, this.props.refScope)
    this.managedChildren.length = 0
    this.managedChildren.push(...reconciled.nodes)
    this.applyChildrenRect()
    this.refresh('children')
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  setData(data: Array<TData>): void {
    this.dataStore.setData(data, this.props.keyField)
    this.refreshScales()
    this.refresh('setData')
  }

  /**
   * Обновляет runtime-состояние ChartRoot.
   */
  updateRows(rows: Array<Partial<TData> & Record<string, unknown>>): void {
    this.dataStore.updateRows(rows)
    this.refreshScales()
    this.refresh('updateRows')
  }

  /**
   * Удаляет сущность из runtime-коллекции ChartRoot.
   */
  removeRows(keys: Array<string | number>): void {
    this.dataStore.removeRows(keys)
    this.refreshScales()
    this.refresh('removeRows')
  }

  /**
   * Регистрирует сущность в runtime-слое ChartRoot.
   */
  private registerScale(registration: NovaChartScaleRegistration<TData>): void {
    this.scaleRegistrations.set(registration.id, registration)
    const sourceDomain = this.resolveScaleSourceDomain(registration)
    registration.scale.setDomain(sourceDomain)
    this.scaleSourceDomains.set(registration.id, [...sourceDomain] as ChartScaleDomain)
    this.scales.register(registration.scale)
    this.refresh('scale.register')
  }

  /**
   * Удаляет регистрацию сущности из runtime-слоя ChartRoot.
   */
  private unregisterScale(id: string): void {
    this.scaleRegistrations.delete(id)
    this.scales.unregister(id)
    this.scaleSourceDomains.delete(id)
    for (const contribution of this.getScaleDomainContributions(id)) {
      this.scaleDomainContributions.delete(contribution.id)
    }
    this.refresh('scale.unregister')
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private refreshScale(id: string): void {
    const registration = this.scaleRegistrations.get(id)
    if (!registration) return
    const sourceDomain = this.resolveScaleSourceDomain(registration)
    registration.scale.setDomain(sourceDomain)
    this.scaleSourceDomains.set(id, [...sourceDomain] as ChartScaleDomain)
    this.scales.register(registration.scale)
    this.refresh('scale.refresh')
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private refreshScales(): void {
    for (const id of this.scaleRegistrations.keys()) this.refreshScale(id)
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private getScale<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> | undefined {
    return this.scales.get<TValue>(id)
  }

  /**
   * Выполняет внутренний шаг requireScale для ChartRoot.
   */
  private requireScale<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> {
    return this.scales.require<TValue>(id)
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private setScaleDomain(id: string, domain: ChartScaleDomain): void {
    this.scales.setDomain(id, domain)
    this.refresh('scale.domain')
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private setScaleRange(id: string, range: ChartScaleRange): void {
    this.scales.setRange(id, range)
    this.refresh('scale.range')
  }

  /**
   * Возвращает исходный домен шкалы до viewport-среза.
   */
  private getScaleSourceDomain(id: string): ChartScaleDomain | undefined {
    const domain = this.scaleSourceDomains.get(id)
    return domain ? [...domain] as ChartScaleDomain : undefined
  }

  /**
   * Публикует вклад series в source domain общей шкалы.
   */
  private setScaleDomainContribution(contribution: NovaChartScaleDomainContribution): void {
    const next = cloneContribution(contribution)
    const previous = this.scaleDomainContributions.get(next.id)
    if (
      previous
      && previous.scaleId === next.scaleId
      && domainKey(previous.domain) === domainKey(next.domain)
    ) {
      return
    }

    this.scaleDomainContributions.set(next.id, next)
    this.refreshScale(next.scaleId)
  }

  /**
   * Удаляет вклад series из source domain шкалы.
   */
  private removeScaleDomainContribution(id: string): void {
    const previous = this.scaleDomainContributions.get(id)
    if (!previous) return
    this.scaleDomainContributions.delete(id)
    this.refreshScale(previous.scaleId)
  }

  /**
   * Возвращает contributions для scale-first mixed charts.
   */
  private getScaleDomainContributions(scaleId?: string): Array<NovaChartScaleDomainContribution> {
    return Array.from(this.scaleDomainContributions.values())
      .filter(contribution => scaleId === undefined || contribution.scaleId === scaleId)
      .map(cloneContribution)
  }

  private exportChart(options: NovaExportImageOptions = {}) {
    return this.nova.exportImage({
      ...options,
      includeSemanticSnapshot: options.includeSemanticSnapshot ?? true,
    })
  }

  private getSemanticSnapshot(options: NovaSemanticSnapshotOptions = {}) {
    return this.nova.semantics.snapshot({
      scope: this.componentId,
      ...options,
    })
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private setSeriesDiagnostics(id: string, diagnostics: NovaChartSeriesDiagnostics): void {
    this.seriesDiagnostics.set(id, diagnostics)
  }

  /**
   * Удаляет diagnostics series из runtime.
   */
  private removeSeriesDiagnostics(id: string): void {
    this.seriesDiagnostics.delete(id)
  }

  /**
   * Обновляет metadata серий для legend и high-level chart shell.
   */
  private setSeriesMetadata(id: string, metadata: Array<NovaChartSeriesMetadata>): void {
    this.seriesMetadata.set(id, metadata.map(item => ({ ...item })))
    this.syncRootSemantics()
  }

  /**
   * Удаляет metadata series из runtime.
   */
  private removeSeriesMetadata(id: string): void {
    this.seriesMetadata.delete(id)
    this.syncRootSemantics()
  }

  /**
   * Возвращает metadata всех зарегистрированных серий.
   */
  private getSeriesMetadata(): Array<NovaChartSeriesMetadata> {
    return Array.from(this.seriesMetadata.values()).flat().map(item => ({ ...item }))
  }

  /**
   * Регистрирует сущность в runtime-слое ChartRoot.
   */
  private registerInteractiveSeries(registration: NovaChartInteractiveSeriesRegistration<TData>): void {
    this.interactiveSeries.set(registration.id, registration)
  }

  /**
   * Удаляет регистрацию сущности из runtime-слоя ChartRoot.
   */
  private unregisterInteractiveSeries(id: string): void {
    this.interactiveSeries.delete(id)
    if (this.interactionState.hovered?.seriesId === id) {
      this.setInteractionState({ hovered: null, tooltipVisible: false })
    }
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private getInteractiveSeries(): Array<NovaChartInteractiveSeriesRegistration<TData>> {
    return [...this.interactiveSeries.values()]
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private getInteractionState(): NovaChartInteractionState<TData> {
    return {
      ...this.interactionState,
      pointer: this.interactionState.pointer ? { ...this.interactionState.pointer } : null,
      hovered: this.interactionState.hovered ? {
        ...this.interactionState.hovered,
        bounds: this.interactionState.hovered.bounds ? { ...this.interactionState.hovered.bounds } : undefined,
        point: this.interactionState.hovered.point ? { ...this.interactionState.hovered.point } : undefined,
      } : null,
    }
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private setInteractionState(patch: Partial<Omit<NovaChartInteractionState<TData>, 'revision'>>): void {
    const previousKey = this.interactionState.hovered?.key
    const previousSeriesId = this.interactionState.hovered?.seriesId
    const next = {
      ...this.interactionState,
      ...patch,
      revision: this.interactionState.revision + 1,
    }

    const nextKey = next.hovered?.key
    const nextSeriesId = next.hovered?.seriesId
    const changed = previousKey !== nextKey
      || previousSeriesId !== nextSeriesId
      || this.interactionState.pointer?.plotX !== next.pointer?.plotX
      || this.interactionState.pointer?.plotY !== next.pointer?.plotY
      || this.interactionState.tooltipVisible !== next.tooltipVisible

    if (!changed) return

    this.interactionState = next
    const hoveredChanged = previousKey !== nextKey || previousSeriesId !== nextSeriesId
    if (hoveredChanged && previousSeriesId && previousSeriesId !== nextSeriesId) {
      this.interactiveSeries.get(previousSeriesId)?.dirty()
    }
    if (hoveredChanged && nextSeriesId) {
      this.interactiveSeries.get(nextSeriesId)?.dirty()
    } else if (hoveredChanged && previousSeriesId) {
      this.interactiveSeries.get(previousSeriesId)?.dirty()
    }

    for (const listener of this.interactionListeners) listener(this.getInteractionState())
    this.customization.notifyInteraction(this.getInteractionState())
    this.syncRootSemantics()
  }

  private publishSemanticRegions(sourceId: string, regions: Array<NovaSemanticRegisterOptions>): void {
    const sourceKey = this.semanticSourceKey(sourceId)
    if (this.props.accessibility === false) {
      this.nova.semantics.clearSource(sourceKey)
      return
    }

    this.nova.semantics.syncSource(sourceKey, regions.map(region => ({
      ...region,
      scope: region.scope ?? this.componentId,
    })))
  }

  private clearSemanticRegions(sourceId: string): void {
    this.nova.semantics.clearSource(this.semanticSourceKey(sourceId))
  }

  private syncRootSemantics(): void {
    const options = this.props.accessibility
    if (options === false) {
      this.nova.semantics.clearScope(this.componentId)
      return
    }

    const data = this.dataStore.getData()
    const summary = typeof options.dataSummary === 'function'
      ? options.dataSummary(data)
      : options.dataSummary
    const regions: Array<NovaSemanticRegisterOptions> = [
      {
        id: `${this.componentId}:chart`,
        role: 'chart',
        label: options.label ?? 'Nova chart',
        description: options.description,
        scope: this.componentId,
        bounds: this.getWorldBounds(),
        focusable: options.keyboardNavigation,
        order: 0,
        data: {
          rowCount: this.dataStore.rowCount,
          scaleCount: this.scales.list().length,
          seriesCount: this.getSeriesMetadata().length,
          summary,
        },
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'root',
        },
      },
    ]

    let order = 20
    for (const registration of this.scaleRegistrations.values()) {
      regions.push({
        id: `${this.componentId}:scale:${registration.id}`,
        role: 'axis',
        label: `${registration.id} scale`,
        scope: this.componentId,
        focusable: false,
        order: order++,
        data: {
          scaleId: registration.id,
          scaleType: registration.props.scaleType,
          sourceDomain: this.getScaleSourceDomain(registration.id),
          visibleDomain: this.getScale(registration.id)?.getDomain(),
        },
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'axis',
        },
      })
    }

    order = 100
    for (const series of this.getSeriesMetadata()) {
      regions.push({
        id: `${this.componentId}:series:${series.sourceSeriesId ?? series.id}`,
        role: 'series',
        label: series.label ?? series.id,
        scope: this.componentId,
        focusable: options.keyboardNavigation,
        order: order++,
        state: {
          hidden: series.visible === false,
        },
        data: {
          id: series.id,
          kind: series.kind,
          color: series.color,
          scaleIds: series.scaleIds,
        },
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'series',
        },
      })
    }

    const hovered = this.interactionState.hovered
    if (options.includeVisibleMarks && hovered) {
      regions.push({
        id: `${this.componentId}:hovered:${hovered.seriesId}:${hovered.key}`,
        role: 'mark',
        label: formatDatumLabel(hovered),
        scope: this.componentId,
        bounds: hovered.bounds ?? pointBounds(hovered.point),
        focusable: options.keyboardNavigation,
        order: 900,
        state: {
          hovered: true,
        },
        data: sanitizeDatumData(hovered),
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'mark',
        },
      })
    }

    this.nova.semantics.syncSource(this.semanticSourceKey('root'), regions)
  }

  private semanticSourceKey(sourceId: string): string {
    return `${this.componentId}:semantic:${sourceId}`
  }

  /**
   * Подписывает обработчик на изменения ChartRoot.
   */
  private subscribe(listener: NovaChartDataListener<TData>): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Подписывает обработчик на изменения ChartRoot.
   */
  private subscribeInteraction(listener: NovaChartInteractionListener<TData>): () => void {
    this.interactionListeners.add(listener)
    return () => {
      this.interactionListeners.delete(listener)
    }
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private getDiagnostics(): NovaChartRootDiagnostics<TData> {
    return {
      rowCount: this.dataStore.rowCount,
      scaleCount: this.scales.list().length,
      componentCount: this.managedChildren.length,
      dataRevision: this.dataStore.revision,
      scalesRevision: this.scaleRegistrations.size,
      lastEvent: this.lastEvent,
      series: Object.fromEntries(this.seriesDiagnostics),
    }
  }

  /**
   * Собирает полный source domain шкалы из base domain и contributions.
   */
  private resolveScaleSourceDomain(registration: NovaChartScaleRegistration<TData>): ChartScaleDomain {
    const baseDomain = resolveScaleDomain(registration.props, this.dataStore)
    if (registration.props.domain) return [...baseDomain] as ChartScaleDomain

    const contributions = this.getScaleDomainContributions(registration.id).map(item => item.domain)
    if (contributions.length === 0) return [...baseDomain] as ChartScaleDomain

    if (registration.props.scaleType === 'band') {
      return mergeBandDomains(baseDomain, contributions)
    }

    const domains = registration.props.field ? [baseDomain, ...contributions] : contributions
    return resolveNumericSourceDomain(domains, registration.props.zero, registration.props.nice)
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private refresh(event = 'refresh'): void {
    this.lastEvent = event
    this.dirtyChildren()
    this.dirty({ update: true, render: true })
    const diagnostics = this.getDiagnostics()
    for (const listener of this.listeners) listener(diagnostics)
  }

  /**
   * Применяет подготовленное состояние ChartRoot.
   */
  private applyChildrenRect(): void {
    const rect = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    }
    for (const child of this.managedChildren) {
      applyChildRect(child, rect)
    }
  }

  /**
   * Выполняет внутренний шаг dirtyChildren для ChartRoot.
   */
  private dirtyChildren(): void {
    for (const child of this.managedChildren) {
      dirtySubtree(child)
    }
  }

  /**
   * Обрабатывает входящее событие ChartRoot.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartRootResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('data') || changedKeys.includes('keyField')) {
      this.dataStore.setData(this.props.data, this.props.keyField)
      this.refreshScales()
      this.refresh('props.data')
    }
    if (changedKeys.includes('refScope')) {
      this.runtime.refScope = this.props.refScope
    }
    if (
      changedKeys.includes('styleSheet')
      || changedKeys.includes('visualPreset')
      || changedKeys.includes('plugins')
    ) {
      this.customization.configure(this.props, {
        id: this.componentId,
        getData: () => this.dataStore.getData(),
        getScale: id => this.getScale(id),
        getSeriesMetadata: () => this.getSeriesMetadata(),
        getInteractionState: () => this.getInteractionState(),
      })
      this.refresh('props.customization')
    }
    if (changedKeys.includes('accessibility')) {
      this.syncRootSemantics()
    }
  }

  protected override onUnmount(): void {
    this.nova.semantics.clearScope(this.componentId)
    this.customization.dispose()
    super.onUnmount()
  }
}

function formatDatumLabel(datum: NovaChartInteractionState<any>['hovered']): string {
  if (!datum) return 'Chart mark'
  const series = datum.seriesLabel ?? datum.seriesKey ?? datum.seriesId
  const label = datum.label ?? datum.category ?? datum.xValue
  const value = datum.yValue ?? datum.value
  return `${series}: ${label ?? datum.key} ${value ?? ''}`.trim()
}

function pointBounds(point: { x: number; y: number } | undefined) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined
  return {
    x: point.x - 6,
    y: point.y - 6,
    width: 12,
    height: 12,
  }
}

function sanitizeDatumData(datum: NonNullable<NovaChartInteractionState<any>['hovered']>): Record<string, unknown> {
  return {
    seriesId: datum.seriesId,
    seriesKind: datum.seriesKind,
    key: datum.key,
    value: datum.value,
    rawValue: datum.rawValue,
    category: datum.category,
    xValue: datum.xValue,
    yValue: datum.yValue,
    seriesKey: datum.seriesKey,
    seriesLabel: datum.seriesLabel,
    color: datum.color,
  }
}

function applyChildRect(child: NovaNode<any>, rect: NovaUiLayoutRect): void {
  if (typeof (child as { applyLayoutRect?: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect === 'function') {
    ;(child as unknown as { applyLayoutRect: (next: NovaUiLayoutRect) => boolean }).applyLayoutRect(rect)
  }
}

function dirtySubtree(node: { dirty?: (flags: { update?: boolean; render?: boolean }) => void; children?: ReadonlyArray<unknown> }): void {
  node.dirty?.({ update: true, render: true })
  for (const child of node.children ?? []) {
    if (!child || typeof child !== 'object') continue
    dirtySubtree(child)
  }
}

function cloneContribution(contribution: NovaChartScaleDomainContribution): NovaChartScaleDomainContribution {
  return {
    ...contribution,
    domain: [...contribution.domain] as ChartScaleDomain,
  }
}

function mergeBandDomains(
  baseDomain: ChartScaleDomain,
  contributionDomains: Array<ChartScaleDomain>,
): ChartScaleDomain {
  const seen = new Set<string>()
  const merged: Array<string> = []
  for (const domain of [baseDomain, ...contributionDomains]) {
    for (const value of domain) {
      const key = String(value)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(key)
    }
  }
  return merged
}

function resolveNumericSourceDomain(
  domains: Array<ChartScaleDomain>,
  zero: boolean,
  nice: boolean,
): ChartNumericDomain {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const domain of domains) {
    if (domain.length < 2) continue
    const start = Number(domain[0])
    const end = Number(domain[domain.length - 1])
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    min = Math.min(min, start, end)
    max = Math.max(max, start, end)
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    min = 0
    max = 1
  }

  if (zero) {
    min = Math.min(0, min)
    max = Math.max(0, max)
  }

  if (nice) {
    const niceDomain = niceNumericDomain(min, max)
    min = niceDomain[0]
    max = niceDomain[1]
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  return [min, max]
}

function niceNumericDomain(min: number, max: number): ChartNumericDomain {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  const span = Math.abs(max - min)
  if (span === 0) return [Math.floor(min), Math.ceil(max + 1)]

  const power = 10 ** Math.floor(Math.log10(span))
  const step = power / 2
  return [
    Math.floor(min / step) * step,
    Math.ceil(max / step) * step,
  ]
}

function domainKey(domain: ChartScaleDomain): string {
  return domain.map(value => String(value)).join('\u0001')
}
