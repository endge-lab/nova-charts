import type { NovaApp, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { NovaChartRuntimeToken } from '@/model/context/nova-chart-runtime'
import { resolveChartScale } from '@/model/scale/resolve-chart-scale'
import { requireNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import type {
  ChartScale,
} from '@/model/types/chart-scale.types'
import type {
  NovaChartScaleApi,
  NovaChartScaleProps,
  NovaChartScaleResolvedProps,
} from '@/model/types/chart-components.types'
import { CHART_SCALE_NODE_DESCRIPTOR, type ChartScaleDescriptor } from '@/ui/scale/scale.config'

/**
 * Декларативная шкала chart runtime.
 */
export class ChartScaleNode<TData = Record<string, unknown>, E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartScaleResolvedProps<TData>, NovaChartScaleApi, NovaChartScaleProps<TData>, E> {
  private scale: ChartScale | null = null
  private readonly api: NovaChartScaleApi
  private mountedInRuntime = false

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
    this.api = {
      getScaleId: () => this.scaleId,
      getScale: () => this.scale,
      refresh: () => this.refresh(),
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
    return this.api
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
    this.register()
  }

  /**
   * Обрабатывает входящее событие ChartScaleNode.
   */
  protected override onUnmount(): void {
    if (this.mountedInRuntime) {
      const runtime = this.injectOptional(NovaChartRuntimeToken)
      runtime?.unregisterScale(this.scaleId)
    }
    this.mountedInRuntime = false
    super.onUnmount()
  }

  /**
   * Обрабатывает входящее событие ChartScaleNode.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartScaleResolvedProps<TData>>): void {
    this.applyCommonPropsChanged(changedKeys)
    if (changedKeys.some(key => key !== 'x' && key !== 'y' && key !== 'width' && key !== 'height')) {
      this.refresh()
    }
  }

  /**
   * Возвращает scale Id для ChartScaleNode.
   */
  private get scaleId(): string {
    return this.props.scaleId ?? this.componentId
  }

  /**
   * Регистрирует сущность в runtime-слое ChartScaleNode.
   */
  private register(): void {
    const runtime = requireNovaChartRuntime<TData>(this)
    this.scale = resolveChartScale(this.scaleId, this.props, runtime.dataStore)
    runtime.registerScale({
      id: this.scaleId,
      props: this.props,
      scale: this.scale,
    })
    this.mountedInRuntime = true
  }

  /**
   * Синхронизирует актуальное состояние ChartScaleNode.
   */
  private refresh(): void {
    const runtime = requireNovaChartRuntime<TData>(this)
    if (!this.scale) {
      this.register()
      return
    }
    this.scale = resolveChartScale(this.scaleId, this.props, runtime.dataStore)
    runtime.registerScale({
      id: this.scaleId,
      props: this.props,
      scale: this.scale,
    })
    runtime.refreshScale(this.scaleId)
  }
}
