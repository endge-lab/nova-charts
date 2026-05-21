import { BandScale } from '@/model/scale/BandScale'
import { LinearScale } from '@/model/scale/LinearScale'
import { TimeScale } from '@/model/scale/TimeScale'
import type { ChartScale, ChartScaleOptions } from '@/model/types/chart-scale.types'

/**
 * Создает шкалу по декларативной конфигурации.
 */
export function createChartScale(options: ChartScaleOptions): ChartScale {
  if (options.type === 'linear') {
    return new LinearScale(options.id, options)
  }

  if (options.type === 'time') {
    return new TimeScale(options.id, options)
  }

  return new BandScale(options.id, options)
}

/**
 * Создает набор шкал по декларативным конфигурациям.
 */
export function createChartScales(options: Array<ChartScaleOptions>): Array<ChartScale> {
  return options.map(createChartScale)
}
