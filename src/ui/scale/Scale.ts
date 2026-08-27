import type { NovaApp, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import type {
  NovaChartScaleApi,
  NovaChartScaleProps,
  NovaChartScaleResolvedProps,
} from '@/model/types/chart-components.types'
import type {
  ChartScale,
} from '@/model/types/chart-scale.types'
import type { ChartScaleDescriptor } from '@/ui/scale/scale.config'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { NovaChartRuntimeToken } from '@/model/context/nova-chart-runtime'
import { resolveChartScale } from '@/model/scale/resolve-chart-scale'
import { CHART_SCALE_NODE_DESCRIPTOR } from '@/ui/scale/scale.config'
import { requireNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

/**
 * Декларативная шкала chart runtime.
 */
export class ChartScaleNode<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartScaleResolvedProps<TData>, NovaChartScaleApi, NovaChartScaleProps<TData>, E> {
  private _scale: ChartScale | null = null
  private readonly _api: NovaChartScaleApi
  private _mountedInRuntime = false

  /**
   * Создает экземпляр ChartScaleNode и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartScaleResolvedProps<TData>,
    options: { componentId?: string } = {},
    descriptor: ChartScaleDescriptor<TData> = CHART_SCALE_NODE_DESCRIPTOR as ChartScaleDescriptor<TData>,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this._api = {
      getScaleId: () => this._scaleId,
      getScale: () => this._scale,
      refresh: () => this._refresh(),
    }
  }

  /**
   * Обновляет значение состояния ChartScaleNode.
   */
  override setProps(patch: Partial<NovaChartScaleResolvedProps<TData>>): this {
    return super.setProps(patch as Partial<NovaChartScaleResolvedProps<TData>>)
  }

  /**
   * Возвращает значение состояния ChartScaleNode.
   */
  override getApi(): NovaChartScaleApi {
    return this._api
  }

  /**
   * Выполняет отрисовку ChartScaleNode.
   */
  render(): void {}

  /**
   * Обрабатывает входящее событие ChartScaleNode.
   */
  protected override onMount(): void {
    super.onMount()
    this._register()
  }

  /**
   * Обрабатывает входящее событие ChartScaleNode.
   */
  protected override onUnmount(): void {
    if (this._mountedInRuntime) {
      const runtime = this.injectOptional(NovaChartRuntimeToken)
      runtime?.unregisterScale(this._scaleId)
    }
    this._mountedInRuntime = false
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartScaleNode.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartScaleResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.some(key => key !== 'x' && key !== 'y' && key !== 'width' && key !== 'height')) {
      this._refresh()
    }
  }

  /**
   * Возвращает scale Id для ChartScaleNode.
   */
  private get _scaleId(): string {
    return this.props.scaleId ?? this.componentId
  }

  /**
   * Регистрирует сущность в runtime-слое ChartScaleNode.
   */
  private _register(): void {
    const runtime = requireNovaChartRuntime<TData>(this)
    this._scale = resolveChartScale(this._scaleId, this.props, runtime.dataStore)
    runtime.registerScale({
      id: this._scaleId,
      props: this.props,
      scale: this._scale,
    })
    this._mountedInRuntime = true
  }

  /**
   * Синхронизирует актуальное состояние ChartScaleNode.
   */
  private _refresh(): void {
    const runtime = requireNovaChartRuntime<TData>(this)
    if (!this._scale) {
      this._register()
      return
    }
    this._scale = resolveChartScale(this._scaleId, this.props, runtime.dataStore)
    runtime.registerScale({
      id: this._scaleId,
      props: this.props,
      scale: this._scale,
    })
    runtime.refreshScale(this._scaleId)
  }
}
