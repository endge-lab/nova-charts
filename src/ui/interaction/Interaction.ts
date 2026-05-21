import type { NovaApp, NovaSurface } from '@endge/nova'
import type { EventList } from '@endge/utils'
import { NovaUiComponentNode } from '@endge/nova-ui-kit'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'
import type {
  NovaChartHitTestResult,
  NovaChartInteractionApi,
  NovaChartInteractionProps,
  NovaChartInteractionResolvedProps,
} from '@/model/types/chart-components.types'
import {
  CHART_INTERACTION_NODE_DESCRIPTOR,
  type ChartInteractionDescriptor,
} from '@/ui/interaction/interaction.config'

/**
 * Универсальный pointer-layer chart interaction: hover, hit-test и tooltip state.
 */
export class ChartInteraction<E extends EventList = Record<string, any>>
  extends NovaUiComponentNode<NovaChartInteractionResolvedProps, NovaChartInteractionApi, NovaChartInteractionProps, E> {
  private readonly api: NovaChartInteractionApi

  /**
   * Создает экземпляр ChartInteraction и подготавливает базовое состояние.
   */
  constructor(
    app: NovaApp<E>,
    surface: NovaSurface<E>,
    props: NovaChartInteractionResolvedProps,
    options: { componentId?: string } = {},
    descriptor: ChartInteractionDescriptor = CHART_INTERACTION_NODE_DESCRIPTOR,
  ) {
    super(app, surface, descriptor, props, { componentId: options.componentId })
    this.options({
      interactive: props.enabled && props.hover,
      zIndex: 40,
      cursor: props.cursor ?? { hover: 'pointer' },
    })
    this.api = {
      refresh: () => this.dirty({ update: true, render: true }),
    }
    this.setupEvents()
  }

  /**
   * Обновляет значение состояния ChartInteraction.
   */
  override setProps(patch: Partial<NovaChartInteractionResolvedProps>): this {
    return super.setProps(patch as Partial<NovaChartInteractionResolvedProps>)
  }

  /**
   * Возвращает значение состояния ChartInteraction.
   */
  override getApi(): NovaChartInteractionApi {
    return this.api
  }

  /**
   * Выполняет отрисовку ChartInteraction.
   */
  render(): void {}

  /**
   * Обрабатывает входящее событие ChartInteraction.
   */
  protected override onPropsChanged(changedKeys: Array<keyof NovaChartInteractionResolvedProps>): void {
    this.applyCommonPropsChanged(changedKeys)
    this.options({
      interactive: this.props.enabled && this.props.hover,
      cursor: this.props.cursor ?? { hover: 'pointer' },
    })
  }

  /**
   * Обновляет значение состояния ChartInteraction.
   */
  private setupEvents(): void {
    this.on('mousemove', event => this.handlePointerMove(event))
    this.on('mouseleave', () => this.clearHover())
    this.on('canvasleave', () => this.clearHover())
  }

  /**
   * Обрабатывает runtime-событие ChartInteraction.
   */
  private handlePointerMove(event: MouseEvent): void {
    if (!this.props.enabled || !this.props.hover) return

    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!runtime) return

    const canvasPoint = this.nova.events.getCanvasMousePosition(event)
    const [plotX, plotY] = this.toLocal(canvasPoint.x, canvasPoint.y)
    const hovered = this.findHoveredDatum(plotX, plotY)

    runtime.setInteractionState({
      pointer: {
        x: canvasPoint.x,
        y: canvasPoint.y,
        plotX,
        plotY,
      },
      hovered,
      tooltipVisible: this.props.tooltip && hovered !== null,
    })
  }

  /**
   * Очищает накопленное состояние ChartInteraction.
   */
  private clearHover(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    runtime?.setInteractionState({
      pointer: null,
      hovered: null,
      tooltipVisible: false,
    })
  }

  /**
   * Находит сущность по runtime-критериям ChartInteraction.
   */
  private findHoveredDatum(x: number, y: number): NovaChartHitTestResult<Record<string, unknown>> | null {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this, this.props.chartRef)
    if (!runtime) return null

    const allowed = this.props.seriesIds.length > 0 ? new Set(this.props.seriesIds) : null
    let best: NovaChartHitTestResult | null = null
    for (const series of runtime.getInteractiveSeries()) {
      if (allowed && !allowed.has(series.id)) continue
      const hit = series.api.hitTest({
        x,
        y,
        mode: this.props.mode,
        maxDistancePx: this.props.maxDistancePx,
      })
      if (!hit) continue
      if (!best || hit.distancePx < best.distancePx) best = hit
    }
    return best
  }
}
