import type { ChartScaleRegistry } from '@/model/scale/ChartScaleRegistry'
import type {
  ChartAxisOptions,
  ChartAxisRenderPlan,
  ChartAxisRenderTick,
} from '@/model/types/chart-axis.types'
import type { ChartScaleTick } from '@/model/types/chart-scale.types'

const DEFAULT_TICK_SIZE = 6
const DEFAULT_LABEL_PADDING = 4

/**
 * Создает render plan оси из зарегистрированной шкалы без привязки к конкретному renderer.
 */
export class ChartAxisModel {
  /**
   * Создает модель оси поверх registry шкал.
   */
  constructor(private readonly scales: ChartScaleRegistry) {}

  /**
   * Строит геометрию baseline, ticks и labels внутри rect компонента оси.
   */
  createRenderPlan(options: ChartAxisOptions): ChartAxisRenderPlan {
    const scale = this.scales.require(options.scaleId)
    scale.setRange(this.resolveScaleRange(options))

    const sourceTicks = scale.ticks(options.ticks) as Array<ChartScaleTick>
    const ticks = sourceTicks.map(tick => this.createRenderTick(tick, options))

    return {
      scaleId: options.scaleId,
      orientation: options.orientation,
      rect: options.rect,
      baseline: this.createBaseline(options),
      ticks,
      sourceTicks,
    }
  }

  /**
   * Возвращает range шкалы по ориентации и rect оси.
   */
  private resolveScaleRange(options: ChartAxisOptions): readonly [number, number] {
    if (options.orientation === 'horizontal') {
      return [options.rect.x, options.rect.x + options.rect.width]
    }
    return [options.rect.y, options.rect.y + options.rect.height]
  }

  /**
   * Строит baseline оси.
   */
  private createBaseline(options: ChartAxisOptions): ChartAxisRenderPlan['baseline'] {
    if (options.orientation === 'horizontal') {
      const y = options.tickSide === 'start' ? options.rect.y : options.rect.y + options.rect.height
      return {
        x1: options.rect.x,
        y1: y,
        x2: options.rect.x + options.rect.width,
        y2: y,
      }
    }

    const x = options.tickSide === 'end' ? options.rect.x + options.rect.width : options.rect.x
    return {
      x1: x,
      y1: options.rect.y,
      x2: x,
      y2: options.rect.y + options.rect.height,
    }
  }

  /**
   * Строит tick и позицию label.
   */
  private createRenderTick(tick: ChartScaleTick, options: ChartAxisOptions): ChartAxisRenderTick {
    const tickSize = options.tickSize ?? DEFAULT_TICK_SIZE
    const labelPadding = options.labelPadding ?? DEFAULT_LABEL_PADDING
    const side = options.tickSide ?? 'end'
    const labelSide = options.labelSide ?? side
    const tickDirection = side === 'start' ? -1 : 1
    const labelDirection = labelSide === 'start' ? -1 : 1

    if (options.orientation === 'horizontal') {
      const baselineY = side === 'start' ? options.rect.y : options.rect.y + options.rect.height
      const labelBaseY = labelSide === 'start' ? options.rect.y : options.rect.y + options.rect.height
      return {
        value: tick.value,
        label: tick.label,
        major: tick.major,
        x1: tick.position,
        y1: baselineY,
        x2: tick.position,
        y2: baselineY + tickSize * tickDirection,
        labelX: tick.position,
        labelY: labelBaseY + (tickSize + labelPadding) * labelDirection,
      }
    }

    const baselineX = side === 'end' ? options.rect.x + options.rect.width : options.rect.x
    const labelBaseX = labelSide === 'end' ? options.rect.x + options.rect.width : options.rect.x
    return {
      value: tick.value,
      label: tick.label,
      major: tick.major,
      x1: baselineX,
      y1: tick.position,
      x2: baselineX + tickSize * tickDirection,
      y2: tick.position,
      labelX: labelBaseX + (tickSize + labelPadding) * labelDirection,
      labelY: tick.position,
    }
  }
}
