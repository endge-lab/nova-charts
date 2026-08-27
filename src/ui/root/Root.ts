import type { NovaApp, NovaExportImageOptions, NovaNode, NovaSemanticRegisterOptions, NovaSemanticSnapshotOptions, NovaSurface, NovaTemplateChildSchema } from '@endge/nova'
import type { NovaUiLayoutRect } from '@endge/nova-ui-kit'
import type { EventList } from '@endge/utils'
import type { NovaChartRuntime, NovaChartRuntimeHost, NovaChartScaleRegistration } from '@/model/context/nova-chart-runtime'
import type {
  NovaChartDataListener,
  NovaChartInteractionListener,
  NovaChartInteractionState,
  NovaChartInteractiveSeriesRegistration,
  NovaChartRootApi,
  NovaChartRootDiagnostics,
  NovaChartRootProps,
  NovaChartRootResolvedProps,
  NovaChartScaleDomainContribution,
  NovaChartSeriesDiagnostics,
  NovaChartSeriesMetadata,
} from '@/model/types/chart-components.types'
import type {
  ChartNumericDomain,
  ChartScale,
  ChartScaleDomain,
  ChartScaleRange,
  ChartScaleValue,
} from '@/model/types/chart-scale.types'
import type { ChartRootDescriptor } from '@/ui/root/root.config'
import {

  reconcileNovaTemplateChildren,
} from '@endge/nova'
import {
  buildBoxSchema,
  NovaUiComponentNode,

} from '@endge/nova-ui-kit'
import {

  NovaChartRuntimeToken,

} from '@/model/context/nova-chart-runtime'
import { NovaChartCustomizationController } from '@/model/customization/chart-customization'
import { ChartDataStore } from '@/model/data/ChartDataStore'
import { ChartScaleRegistry } from '@/model/scale/ChartScaleRegistry'
import { resolveScaleDomain } from '@/model/scale/resolve-chart-scale'
import { CHART_ROOT_NODE_DESCRIPTOR } from '@/ui/root/root.config'

/**
 * Корень chart runtime: данные, шкалы, refs и подписки.
 */
export class ChartRoot<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartRootResolvedProps<TData>, NovaChartRootApi<TData>, NovaChartRootProps<TData>, E>
  implements NovaChartRuntimeHost<TData> {
  private readonly _dataStore: ChartDataStore<TData>
  private readonly _scales = new ChartScaleRegistry()
  private readonly _managedChildren: Array<NovaNode<E>> = []
  private readonly _scaleRegistrations = new Map<string, NovaChartScaleRegistration<TData>>()
  private readonly _scaleSourceDomains = new Map<string, ChartScaleDomain>()
  private readonly _scaleDomainContributions = new Map<string, NovaChartScaleDomainContribution>()
  private readonly _seriesDiagnostics = new Map<string, NovaChartSeriesDiagnostics>()
  private readonly _seriesMetadata = new Map<string, Array<NovaChartSeriesMetadata>>()
  private readonly _interactiveSeries = new Map<string, NovaChartInteractiveSeriesRegistration<TData>>()
  private readonly _listeners = new Set<NovaChartDataListener<TData>>()
  private readonly _interactionListeners = new Set<NovaChartInteractionListener<TData>>()
  private readonly _customization: NovaChartCustomizationController<TData>
  private readonly _api: NovaChartRootApi<TData>
  private readonly _runtime: NovaChartRuntime<TData>
  private _interactionState: NovaChartInteractionState<TData> = {
    pointer: null,
    hovered: null,
    tooltipVisible: false,
    revision: 0,
  }

  private _lastEvent = 'init'

  /**
   * Создает экземпляр ChartRoot и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartRootResolvedProps<TData>,
    options: { componentId?: string, children?: Array<NovaTemplateChildSchema> } = {},
    descriptor: ChartRootDescriptor<TData> = CHART_ROOT_NODE_DESCRIPTOR as ChartRootDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this._dataStore = new ChartDataStore<TData>({
      data: props.data,
      keyField: props.keyField,
    })
    this._customization = new NovaChartCustomizationController<TData>(props, {
      id: this.componentId,
      getData: () => this._dataStore.getData(),
      getScale: id => this._getScale(id),
      getSeriesMetadata: () => this._getSeriesMetadata(),
      getInteractionState: () => this._getInteractionState(),
    })
    this._api = {
      setData: data => this.setData(data),
      getData: () => this._dataStore.getData(),
      updateRows: rows => this.updateRows(rows),
      removeRows: keys => this.removeRows(keys),
      getScale: id => this._getScale(id),
      requireScale: id => this._requireScale(id),
      setScaleDomain: (id, domain) => this._setScaleDomain(id, domain),
      setScaleRange: (id, range) => this._setScaleRange(id, range),
      getScaleSourceDomain: id => this._getScaleSourceDomain(id),
      setScaleDomainContribution: contribution => this._setScaleDomainContribution(contribution),
      removeScaleDomainContribution: id => this._removeScaleDomainContribution(id),
      getScaleDomainContributions: scaleId => this._getScaleDomainContributions(scaleId),
      refresh: () => this._refresh('api.refresh'),
      getDiagnostics: () => this._getDiagnostics(),
      getInteractionState: () => this._getInteractionState(),
      setInteractionState: patch => this._setInteractionState(patch),
      setChildren: children => this.setChildren(children),
      exportChart: exportOptions => this._exportChart(exportOptions),
      getSemanticSnapshot: snapshotOptions => this._getSemanticSnapshot(snapshotOptions),
      subscribe: listener => this._subscribe(listener),
      subscribeInteraction: listener => this._subscribeInteraction(listener),
    }
    this._runtime = {
      id: this.componentId,
      props: this.props,
      dataStore: this._dataStore,
      scales: this._scales,
      customization: this._customization,
      refScope: this.props.refScope,
      registerScale: registration => this._registerScale(registration),
      unregisterScale: id => this._unregisterScale(id),
      refreshScale: id => this._refreshScale(id),
      refreshScales: () => this._refreshScales(),
      getScale: id => this._getScale(id),
      requireScale: id => this._requireScale(id),
      setScaleDomain: (id, domain) => this._setScaleDomain(id, domain),
      setScaleRange: (id, range) => this._setScaleRange(id, range),
      getScaleSourceDomain: id => this._getScaleSourceDomain(id),
      setScaleDomainContribution: contribution => this._setScaleDomainContribution(contribution),
      removeScaleDomainContribution: id => this._removeScaleDomainContribution(id),
      getScaleDomainContributions: scaleId => this._getScaleDomainContributions(scaleId),
      setChildren: children => this.setChildren(children),
      refresh: event => this._refresh(event),
      registerInteractiveSeries: registration => this._registerInteractiveSeries(registration),
      unregisterInteractiveSeries: id => this._unregisterInteractiveSeries(id),
      getInteractiveSeries: () => this._getInteractiveSeries(),
      getInteractionState: () => this._getInteractionState(),
      setInteractionState: patch => this._setInteractionState(patch),
      subscribeInteraction: listener => this._subscribeInteraction(listener),
      setSeriesDiagnostics: (id, diagnostics) => this._setSeriesDiagnostics(id, diagnostics),
      removeSeriesDiagnostics: id => this._removeSeriesDiagnostics(id),
      setSeriesMetadata: (id, metadata) => this._setSeriesMetadata(id, metadata),
      removeSeriesMetadata: id => this._removeSeriesMetadata(id),
      getSeriesMetadata: () => this._getSeriesMetadata(),
      publishSemanticRegions: (sourceId, regions) => this._publishSemanticRegions(sourceId, regions),
      clearSemanticRegions: sourceId => this._clearSemanticRegions(sourceId),
      getDiagnostics: () => this._getDiagnostics(),
      subscribe: listener => this._subscribe(listener),
      getApi: () => this._api,
    }
    this.provide(NovaChartRuntimeToken, this._runtime as NovaChartRuntime<Record<string, unknown>>)
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
    return this._api
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  getNovaChartRuntime(): NovaChartRuntime<TData> {
    return this._runtime
  }

  /**
   * Применяет подготовленное состояние ChartRoot.
   */
  override applyLayoutRect(rect: NovaUiLayoutRect): boolean {
    const changed = super.applyLayoutRect(rect)
    if (changed) {
      this._applyChildrenRect()
    }
    return changed
  }

  /**
   * Обновляет runtime-состояние ChartRoot.
   */
  update(): void {
    this._applyChildrenRect()
  }

  /**
   * Выполняет отрисовку ChartRoot.
   */
  render(): void {
    const schema = buildBoxSchema(this.props, this.width, this.height)
    if (schema.length > 0) {
      this.renderer.schema(schema)
    }
    if (this.props.clip) {
      this.renderer.clip(0, 0, this.width, this.height)
    }
    this._syncRootSemantics()
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  setChildren(children: Array<NovaTemplateChildSchema>): void {
    const reconciled = reconcileNovaTemplateChildren(this, this._managedChildren, children, this.props.refScope)
    this._managedChildren.length = 0
    this._managedChildren.push(...reconciled.nodes)
    this._applyChildrenRect()
    this._refresh('children')
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  setData(data: Array<TData>): void {
    this._dataStore.setData(data, this.props.keyField)
    this._refreshScales()
    this._refresh('setData')
  }

  /**
   * Обновляет runtime-состояние ChartRoot.
   */
  updateRows(rows: Array<Partial<TData> & Record<string, unknown>>): void {
    this._dataStore.updateRows(rows)
    this._refreshScales()
    this._refresh('updateRows')
  }

  /**
   * Удаляет сущность из runtime-коллекции ChartRoot.
   */
  removeRows(keys: Array<string | number>): void {
    this._dataStore.removeRows(keys)
    this._refreshScales()
    this._refresh('removeRows')
  }

  /**
   * Регистрирует сущность в runtime-слое ChartRoot.
   */
  private _registerScale(registration: NovaChartScaleRegistration<TData>): void {
    this._scaleRegistrations.set(registration.id, registration)
    const sourceDomain = this._resolveScaleSourceDomain(registration)
    registration.scale.setDomain(sourceDomain)
    this._scaleSourceDomains.set(registration.id, [...sourceDomain] as ChartScaleDomain)
    this._scales.register(registration.scale)
    this._refresh('scale.register')
  }

  /**
   * Удаляет регистрацию сущности из runtime-слоя ChartRoot.
   */
  private _unregisterScale(id: string): void {
    this._scaleRegistrations.delete(id)
    this._scales.unregister(id)
    this._scaleSourceDomains.delete(id)
    for (const contribution of this._getScaleDomainContributions(id)) {
      this._scaleDomainContributions.delete(contribution.id)
    }
    this._refresh('scale.unregister')
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private _refreshScale(id: string): void {
    const registration = this._scaleRegistrations.get(id)
    if (!registration) {
      return
    }
    const sourceDomain = this._resolveScaleSourceDomain(registration)
    registration.scale.setDomain(sourceDomain)
    this._scaleSourceDomains.set(id, [...sourceDomain] as ChartScaleDomain)
    this._scales.register(registration.scale)
    this._refresh('scale.refresh')
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private _refreshScales(): void {
    for (const id of this._scaleRegistrations.keys()) {
      this._refreshScale(id)
    }
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private _getScale<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> | undefined {
    return this._scales.get<TValue>(id)
  }

  /**
   * Выполняет внутренний шаг requireScale для ChartRoot.
   */
  private _requireScale<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> {
    return this._scales.require<TValue>(id)
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private _setScaleDomain(id: string, domain: ChartScaleDomain): void {
    this._scales.setDomain(id, domain)
    this._refresh('scale.domain')
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private _setScaleRange(id: string, range: ChartScaleRange): void {
    this._scales.setRange(id, range)
    this._refresh('scale.range')
  }

  /**
   * Возвращает исходный домен шкалы до viewport-среза.
   */
  private _getScaleSourceDomain(id: string): ChartScaleDomain | undefined {
    const domain = this._scaleSourceDomains.get(id)
    return domain ? [...domain] as ChartScaleDomain : undefined
  }

  /**
   * Публикует вклад series в source domain общей шкалы.
   */
  private _setScaleDomainContribution(contribution: NovaChartScaleDomainContribution): void {
    const next = cloneContribution(contribution)
    const previous = this._scaleDomainContributions.get(next.id)
    if (
      previous
      && previous.scaleId === next.scaleId
      && domainKey(previous.domain) === domainKey(next.domain)
    ) {
      return
    }

    this._scaleDomainContributions.set(next.id, next)
    this._refreshScale(next.scaleId)
  }

  /**
   * Удаляет вклад series из source domain шкалы.
   */
  private _removeScaleDomainContribution(id: string): void {
    const previous = this._scaleDomainContributions.get(id)
    if (!previous) {
      return
    }
    this._scaleDomainContributions.delete(id)
    this._refreshScale(previous.scaleId)
  }

  /**
   * Возвращает contributions для scale-first mixed charts.
   */
  private _getScaleDomainContributions(scaleId?: string): Array<NovaChartScaleDomainContribution> {
    return Array.from(this._scaleDomainContributions.values())
      .filter(contribution => scaleId === undefined || contribution.scaleId === scaleId)
      .map(cloneContribution)
  }

  private _exportChart(options: NovaExportImageOptions = {}) {
    return this.nova.exportImage({
      ...options,
      includeSemanticSnapshot: options.includeSemanticSnapshot ?? true,
    })
  }

  private _getSemanticSnapshot(options: NovaSemanticSnapshotOptions = {}) {
    return this.nova.semantics.snapshot({
      scope: this.componentId,
      ...options,
    })
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private _setSeriesDiagnostics(id: string, diagnostics: NovaChartSeriesDiagnostics): void {
    this._seriesDiagnostics.set(id, diagnostics)
  }

  /**
   * Удаляет diagnostics series из runtime.
   */
  private _removeSeriesDiagnostics(id: string): void {
    this._seriesDiagnostics.delete(id)
  }

  /**
   * Обновляет metadata серий для legend и high-level chart shell.
   */
  private _setSeriesMetadata(id: string, metadata: Array<NovaChartSeriesMetadata>): void {
    this._seriesMetadata.set(id, metadata.map(item => ({ ...item })))
    this._syncRootSemantics()
  }

  /**
   * Удаляет metadata series из runtime.
   */
  private _removeSeriesMetadata(id: string): void {
    this._seriesMetadata.delete(id)
    this._syncRootSemantics()
  }

  /**
   * Возвращает metadata всех зарегистрированных серий.
   */
  private _getSeriesMetadata(): Array<NovaChartSeriesMetadata> {
    return Array.from(this._seriesMetadata.values()).flat().map(item => ({ ...item }))
  }

  /**
   * Регистрирует сущность в runtime-слое ChartRoot.
   */
  private _registerInteractiveSeries(registration: NovaChartInteractiveSeriesRegistration<TData>): void {
    this._interactiveSeries.set(registration.id, registration)
  }

  /**
   * Удаляет регистрацию сущности из runtime-слоя ChartRoot.
   */
  private _unregisterInteractiveSeries(id: string): void {
    this._interactiveSeries.delete(id)
    if (this._interactionState.hovered?.seriesId === id) {
      this._setInteractionState({ hovered: null, tooltipVisible: false })
    }
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private _getInteractiveSeries(): Array<NovaChartInteractiveSeriesRegistration<TData>> {
    return [...this._interactiveSeries.values()]
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private _getInteractionState(): NovaChartInteractionState<TData> {
    return {
      ...this._interactionState,
      pointer: this._interactionState.pointer ? { ...this._interactionState.pointer } : null,
      hovered: this._interactionState.hovered
        ? {
            ...this._interactionState.hovered,
            bounds: this._interactionState.hovered.bounds ? { ...this._interactionState.hovered.bounds } : undefined,
            point: this._interactionState.hovered.point ? { ...this._interactionState.hovered.point } : undefined,
          }
        : null,
    }
  }

  /**
   * Обновляет значение состояния ChartRoot.
   */
  private _setInteractionState(patch: Partial<Omit<NovaChartInteractionState<TData>, 'revision'>>): void {
    const previousKey = this._interactionState.hovered?.key
    const previousSeriesId = this._interactionState.hovered?.seriesId
    const next = {
      ...this._interactionState,
      ...patch,
      revision: this._interactionState.revision + 1,
    }

    const nextKey = next.hovered?.key
    const nextSeriesId = next.hovered?.seriesId
    const changed = previousKey !== nextKey
      || previousSeriesId !== nextSeriesId
      || this._interactionState.pointer?.plotX !== next.pointer?.plotX
      || this._interactionState.pointer?.plotY !== next.pointer?.plotY
      || this._interactionState.tooltipVisible !== next.tooltipVisible

    if (!changed) {
      return
    }

    this._interactionState = next
    const hoveredChanged = previousKey !== nextKey || previousSeriesId !== nextSeriesId
    if (hoveredChanged && previousSeriesId && previousSeriesId !== nextSeriesId) {
      this._interactiveSeries.get(previousSeriesId)?.dirty()
    }
    if (hoveredChanged && nextSeriesId) {
      this._interactiveSeries.get(nextSeriesId)?.dirty()
    }
    else if (hoveredChanged && previousSeriesId) {
      this._interactiveSeries.get(previousSeriesId)?.dirty()
    }

    for (const listener of this._interactionListeners) {
      listener(this._getInteractionState())
    }
    this._customization.notifyInteraction(this._getInteractionState())
    this._syncRootSemantics()
  }

  private _publishSemanticRegions(sourceId: string, regions: Array<NovaSemanticRegisterOptions>): void {
    const sourceKey = this._semanticSourceKey(sourceId)
    if (this.props.accessibility === false) {
      this.nova.semantics.clearSource(sourceKey)
      return
    }

    this.nova.semantics.syncSource(sourceKey, regions.map(region => ({
      ...region,
      scope: region.scope ?? this.componentId,
    })))
  }

  private _clearSemanticRegions(sourceId: string): void {
    this.nova.semantics.clearSource(this._semanticSourceKey(sourceId))
  }

  private _syncRootSemantics(): void {
    const options = this.props.accessibility
    if (options === false) {
      this.nova.semantics.clearScope(this.componentId)
      return
    }

    const data = this._dataStore.getData()
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
          rowCount: this._dataStore.rowCount,
          scaleCount: this._scales.list().length,
          seriesCount: this._getSeriesMetadata().length,
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
    for (const registration of this._scaleRegistrations.values()) {
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
          sourceDomain: this._getScaleSourceDomain(registration.id),
          visibleDomain: this._getScale(registration.id)?.getDomain(),
        },
        source: {
          type: 'synthetic',
          componentId: this.componentId,
          part: 'axis',
        },
      })
    }

    order = 100
    for (const series of this._getSeriesMetadata()) {
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

    const hovered = this._interactionState.hovered
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

    this.nova.semantics.syncSource(this._semanticSourceKey('root'), regions)
  }

  private _semanticSourceKey(sourceId: string): string {
    return `${this.componentId}:semantic:${sourceId}`
  }

  /**
   * Подписывает обработчик на изменения ChartRoot.
   */
  private _subscribe(listener: NovaChartDataListener<TData>): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  /**
   * Подписывает обработчик на изменения ChartRoot.
   */
  private _subscribeInteraction(listener: NovaChartInteractionListener<TData>): () => void {
    this._interactionListeners.add(listener)
    return () => {
      this._interactionListeners.delete(listener)
    }
  }

  /**
   * Возвращает значение состояния ChartRoot.
   */
  private _getDiagnostics(): NovaChartRootDiagnostics<TData> {
    return {
      rowCount: this._dataStore.rowCount,
      scaleCount: this._scales.list().length,
      componentCount: this._managedChildren.length,
      dataRevision: this._dataStore.revision,
      scalesRevision: this._scaleRegistrations.size,
      lastEvent: this._lastEvent,
      series: Object.fromEntries(this._seriesDiagnostics),
    }
  }

  /**
   * Собирает полный source domain шкалы из base domain и contributions.
   */
  private _resolveScaleSourceDomain(registration: NovaChartScaleRegistration<TData>): ChartScaleDomain {
    const baseDomain = resolveScaleDomain(registration.props, this._dataStore)
    if (registration.props.domain) {
      return [...baseDomain] as ChartScaleDomain
    }

    const contributions = this._getScaleDomainContributions(registration.id).map(item => item.domain)
    if (contributions.length === 0) {
      return [...baseDomain] as ChartScaleDomain
    }

    if (registration.props.scaleType === 'band') {
      return mergeBandDomains(baseDomain, contributions)
    }

    const domains = registration.props.field ? [baseDomain, ...contributions] : contributions
    return resolveNumericSourceDomain(domains, registration.props.zero, registration.props.nice)
  }

  /**
   * Синхронизирует актуальное состояние ChartRoot.
   */
  private _refresh(event = 'refresh'): void {
    this._lastEvent = event
    this._dirtyChildren()
    this.dirty({ update: true, render: true })
    const diagnostics = this._getDiagnostics()
    for (const listener of this._listeners) {
      listener(diagnostics)
    }
  }

  /**
   * Применяет подготовленное состояние ChartRoot.
   */
  private _applyChildrenRect(): void {
    const rect = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    }
    for (const child of this._managedChildren) {
      applyChildRect(child, rect)
    }
  }

  /**
   * Выполняет внутренний шаг dirtyChildren для ChartRoot.
   */
  private _dirtyChildren(): void {
    for (const child of this._managedChildren) {
      dirtySubtree(child)
    }
  }

  /**
   * Обрабатывает входящее событие ChartRoot.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartRootResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.includes('data') || changedKeys.includes('keyField')) {
      this._dataStore.setData(this.props.data, this.props.keyField)
      this._refreshScales()
      this._refresh('props.data')
    }
    if (changedKeys.includes('refScope')) {
      this._runtime.refScope = this.props.refScope
    }
    if (
      changedKeys.includes('styleSheet')
      || changedKeys.includes('visualPreset')
      || changedKeys.includes('plugins')
    ) {
      this._customization.configure(this.props, {
        id: this.componentId,
        getData: () => this._dataStore.getData(),
        getScale: id => this._getScale(id),
        getSeriesMetadata: () => this._getSeriesMetadata(),
        getInteractionState: () => this._getInteractionState(),
      })
      this._refresh('props.customization')
    }
    if (changedKeys.includes('accessibility')) {
      this._syncRootSemantics()
    }
  }

  protected override onUnmount(): void {
    this.nova.semantics.clearScope(this.componentId)
    this._customization.dispose()
    super.onUnmount()
  }
}

function formatDatumLabel(datum: NovaChartInteractionState<any>['hovered']): string {
  if (!datum) {
    return 'Chart mark'
  }
  const series = datum.seriesLabel ?? datum.seriesKey ?? datum.seriesId
  const label = datum.label ?? datum.category ?? datum.xValue
  const value = datum.yValue ?? datum.value
  return `${series}: ${label ?? datum.key} ${value ?? ''}`.trim()
}

function pointBounds(point: { x: number, y: number } | undefined) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return undefined
  }
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

function dirtySubtree(node: { dirty?: (flags: { update?: boolean, render?: boolean }) => void, children?: ReadonlyArray<unknown> }): void {
  node.dirty?.({ update: true, render: true })
  for (const child of node.children ?? []) {
    if (!child || typeof child !== 'object') {
      continue
    }
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
      if (seen.has(key)) {
        continue
      }
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
    if (domain.length < 2) {
      continue
    }
    const start = Number(domain[0])
    const end = Number(domain[domain.length - 1])
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue
    }
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
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1]
  }
  const span = Math.abs(max - min)
  if (span === 0) {
    return [Math.floor(min), Math.ceil(max + 1)]
  }

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
