import type {
  ChartContinuousScaleType,
  ChartScaleExplicitTickInput,
  ChartNumericDomain,
  ChartScale,
  ChartScaleDomain,
  ChartScaleRange,
  ChartScaleTick,
  ChartScaleTickOptions,
} from '@/model/types/chart-scale.types'

const DEFAULT_RANGE: ChartScaleRange = [0, 1]

/**
 * Преобразует числовые значения в пиксели и обратно.
 */
export class LinearScale implements ChartScale<number> {
  readonly type: ChartContinuousScaleType = 'linear'

  private domain: ChartNumericDomain
  private range: ChartScaleRange
  private readonly clampValues: boolean

  /**
   * Создает числовую шкалу с доменом данных и пиксельным диапазоном.
   */
  constructor(
    readonly id: string,
    options: {
      domain: ChartNumericDomain
      range?: ChartScaleRange
      clamp?: boolean
    },
  ) {
    this.domain = options.domain
    this.range = options.range ?? DEFAULT_RANGE
    this.clampValues = options.clamp ?? false
  }

  /**
   * Возвращает текущий домен данных.
   */
  getDomain(): ChartNumericDomain {
    return this.domain
  }

  /**
   * Возвращает текущий пиксельный диапазон.
   */
  getRange(): ChartScaleRange {
    return this.range
  }

  /**
   * Заменяет домен данных.
   */
  setDomain(domain: ChartScaleDomain): void {
    if (!isNumericDomain(domain)) {
      throw new Error(`[NovaCharts] Linear scale "${this.id}" expects numeric domain`)
    }
    this.domain = domain
  }

  /**
   * Заменяет пиксельный диапазон.
   */
  setRange(range: ChartScaleRange): void {
    this.range = range
  }

  /**
   * Переводит значение данных в пиксель.
   */
  toPx(value: number): number {
    const [domainStart, domainEnd] = this.domain
    const [rangeStart, rangeEnd] = this.range
    const domainSpan = domainEnd - domainStart
    if (domainSpan === 0) return rangeStart

    const normalized = (value - domainStart) / domainSpan
    const ratio = this.clampValues ? clamp(normalized, 0, 1) : normalized
    return rangeStart + ratio * (rangeEnd - rangeStart)
  }

  /**
   * Переводит пиксель обратно в значение данных.
   */
  fromPx(px: number): number {
    const [domainStart, domainEnd] = this.domain
    const [rangeStart, rangeEnd] = this.range
    const rangeSpan = rangeEnd - rangeStart
    if (rangeSpan === 0) return domainStart

    const normalized = (px - rangeStart) / rangeSpan
    const ratio = this.clampValues ? clamp(normalized, 0, 1) : normalized
    return domainStart + ratio * (domainEnd - domainStart)
  }

  /**
   * Строит человекочитаемые числовые ticks с шагом 1/2/5 * 10^n.
   */
  ticks(options: ChartScaleTickOptions = {}): Array<ChartScaleTick<number>> {
    if (options.values?.length) {
      return createExplicitNumericTicks(this, options.values, options)
    }

    const [domainStart, domainEnd] = this.domain
    const [rangeStart, rangeEnd] = this.range
    const rangeSize = Math.abs(rangeEnd - rangeStart)
    const minStepPx = options.minStepPx ?? 48
    const maxByPixels = Math.max(1, Math.floor(rangeSize / minStepPx))
    const maxCount = Math.max(1, Math.min(options.maxCount ?? 12, maxByPixels))
    const step = createNiceStep(domainStart, domainEnd, maxCount)
    const start = Math.ceil(Math.min(domainStart, domainEnd) / step) * step
    const end = Math.max(domainStart, domainEnd)
    const ticks: Array<ChartScaleTick<number>> = []

    for (let value = start; value <= end + step / 2; value += step) {
      const normalizedValue = normalizeFloat(value)
      ticks.push({
        value: normalizedValue,
        position: this.toPx(normalizedValue),
        label: formatNumericTickLabel(normalizedValue, options),
        major: true,
      })
    }

    return ticks
  }
}

function createExplicitNumericTicks(
  scale: LinearScale,
  values: ReadonlyArray<ChartScaleExplicitTickInput>,
  options: ChartScaleTickOptions,
): Array<ChartScaleTick<number>> {
  return values.flatMap(item => {
    const value = readExplicitTickValue(item)
    if (typeof value !== 'number' || !Number.isFinite(value)) return []

    return [{
      value,
      position: scale.toPx(value),
      label: readExplicitTickLabel(item) ?? formatNumericTickLabel(value, options),
      major: readExplicitTickMajor(item),
    }]
  })
}

function readExplicitTickValue(item: ChartScaleExplicitTickInput): string | number {
  return typeof item === 'object' ? item.value : item
}

function readExplicitTickLabel(item: ChartScaleExplicitTickInput): string | undefined {
  return typeof item === 'object' ? item.label : undefined
}

function readExplicitTickMajor(item: ChartScaleExplicitTickInput): boolean {
  return typeof item === 'object' ? item.major ?? true : true
}

function formatNumericTickLabel(value: number, options: ChartScaleTickOptions): string {
  return options.labels?.[String(value)] ?? options.formatter?.(value) ?? String(value)
}

/**
 * Проверяет, что домен описывает числовой диапазон.
 */
function isNumericDomain(domain: ChartScaleDomain): domain is ChartNumericDomain {
  return domain.length === 2 && typeof domain[0] === 'number' && typeof domain[1] === 'number'
}

/**
 * Ограничивает значение заданным диапазоном.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Выбирает удобный шаг для заданного числа тиков.
 */
export function createNiceStep(start: number, end: number, maxCount: number): number {
  const span = Math.abs(end - start)
  if (span === 0) return 1

  const rough = span / Math.max(1, maxCount)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude

  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

/**
 * Убирает артефакты дробной арифметики в labels.
 */
function normalizeFloat(value: number): number {
  return Number.parseFloat(value.toPrecision(12))
}
