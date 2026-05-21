import type {
  ChartBandDomain,
  ChartScale,
  ChartScaleDomain,
  ChartScaleExplicitTickInput,
  ChartScaleRange,
  ChartScaleTick,
  ChartScaleTickOptions,
  ChartBandVisibleRange,
} from '@/model/types/chart-scale.types'

const DEFAULT_RANGE: ChartScaleRange = [0, 1]

/**
 * Преобразует дискретные категории в равномерные полосы пиксельного диапазона.
 */
export class BandScale implements ChartScale<string> {
  readonly type = 'band'

  private domain: ChartBandDomain
  private range: ChartScaleRange
  private indexByValue = new Map<string, number>()
  private readonly paddingInner: number
  private readonly paddingOuter: number

  /**
   * Создает категориальную шкалу с band geometry.
   */
  constructor(
    readonly id: string,
    options: {
      domain: ChartBandDomain
      range?: ChartScaleRange
      paddingInner?: number
      paddingOuter?: number
    },
  ) {
    this.domain = options.domain
    this.range = options.range ?? DEFAULT_RANGE
    this.paddingInner = options.paddingInner ?? 0
    this.paddingOuter = options.paddingOuter ?? 0
    this.rebuildIndex()
  }

  /**
   * Возвращает текущий список категорий.
   */
  getDomain(): ChartBandDomain {
    return this.domain
  }

  /**
   * Возвращает текущий пиксельный диапазон.
   */
  getRange(): ChartScaleRange {
    return this.range
  }

  /**
   * Заменяет список категорий.
   */
  setDomain(domain: ChartScaleDomain): void {
    if (!domain.every(value => typeof value === 'string')) {
      throw new Error(`[NovaCharts] Band scale "${this.id}" expects string domain`)
    }
    this.domain = domain
    this.rebuildIndex()
  }

  /**
   * Заменяет пиксельный диапазон.
   */
  setRange(range: ChartScaleRange): void {
    this.range = range
  }

  /**
   * Возвращает левую или верхнюю координату полосы категории.
   */
  toPx(value: string): number {
    const index = this.indexByValue.get(value) ?? -1
    if (index === -1) return Number.NaN
    return this.bandStart(index)
  }

  /**
   * Возвращает категорию, которая находится под пикселем.
   */
  fromPx(px: number): string {
    if (this.domain.length === 0) return ''
    const step = this.step()
    if (step === 0) return this.domain[0] ?? ''

    const [rangeStart] = this.range
    const index = Math.floor((px - rangeStart - step * this.paddingOuter) / step)
    return this.domain[Math.max(0, Math.min(this.domain.length - 1, index))] ?? ''
  }

  /**
   * Возвращает ширину или высоту одной полосы.
   */
  bandwidth(): number {
    return Math.abs(this.step() * (1 - this.paddingInner))
  }

  /**
   * Возвращает центр полосы категории.
   */
  center(value: string): number {
    return this.toPx(value) + this.bandwidth() / 2
  }

  /**
   * Строит ticks по центрам категорий.
   */
  ticks(options: ChartScaleTickOptions = {}): Array<ChartScaleTick<string>> {
    if (options.values?.length) {
      return createExplicitBandTicks(this, options.values, options)
    }

    const maxCount = options.maxCount ?? Number.POSITIVE_INFINITY
    const minStepPx = options.minStepPx ?? 0
    const stepPx = Math.abs(this.step())
    const pixelSample = minStepPx > 0 && stepPx > 0 ? Math.ceil(minStepPx / stepPx) : 1
    const countSample = Number.isFinite(maxCount) && maxCount > 0
      ? Math.ceil(this.domain.length / maxCount)
      : 1
    const categorySample = Math.max(1, Math.trunc(options.categoryStep ?? 1))
    const sampleStep = Math.max(1, pixelSample, countSample, categorySample)

    const ticks: Array<ChartScaleTick<string>> = []
    for (let index = 0; index < this.domain.length; index += sampleStep) {
      const value = this.domain[index]
      if (value === undefined) continue
      ticks.push({
        value,
        position: this.center(value),
        label: formatBandTickLabel(value, options),
        major: true,
      })
    }
    return ticks
  }

  /**
   * Возвращает полный шаг между соседними категориями.
   */
  stepSize(): number {
    return Math.abs(this.step())
  }

  /**
   * Возвращает индекс категории за O(1).
   */
  indexOf(value: string): number {
    return this.indexByValue.get(value) ?? -1
  }

  /**
   * Возвращает категорию по индексу.
   */
  valueAt(index: number): string | undefined {
    return this.domain[index]
  }

  /**
   * Возвращает индексный диапазон категорий, пересекающих pixel window.
   */
  visibleIndexRange(startPx: number, endPx: number): ChartBandVisibleRange {
    if (this.domain.length === 0) return { startIndex: 0, endIndex: -1 }

    const [rangeStart] = this.range
    const step = this.step()
    if (step === 0) return { startIndex: 0, endIndex: this.domain.length - 1 }

    const minPx = Math.min(startPx, endPx)
    const maxPx = Math.max(startPx, endPx)
    const rawStart = Math.floor((minPx - rangeStart - step * this.paddingOuter) / step) - 1
    const rawEnd = Math.ceil((maxPx - rangeStart - step * this.paddingOuter) / step) + 1

    return {
      startIndex: Math.max(0, Math.min(this.domain.length - 1, rawStart)),
      endIndex: Math.max(0, Math.min(this.domain.length - 1, rawEnd)),
    }
  }

  /**
   * Возвращает полный шаг между соседними категориями.
   */
  private step(): number {
    if (this.domain.length === 0) return 0
    const [rangeStart, rangeEnd] = this.range
    const size = rangeEnd - rangeStart
    const denominator = Math.max(1, this.domain.length - this.paddingInner + this.paddingOuter * 2)
    return size / denominator
  }

  /**
   * Возвращает старт полосы по индексу категории.
   */
  private bandStart(index: number): number {
    const [rangeStart] = this.range
    const step = this.step()
    return rangeStart + step * this.paddingOuter + step * index
  }

  /**
   * Пересобирает индекс категорий для больших domain.
   */
  private rebuildIndex(): void {
    this.indexByValue = new Map()
    this.domain.forEach((value, index) => {
      this.indexByValue.set(value, index)
    })
  }
}

function createExplicitBandTicks(
  scale: BandScale,
  values: ReadonlyArray<ChartScaleExplicitTickInput>,
  options: ChartScaleTickOptions,
): Array<ChartScaleTick<string>> {
  return values.flatMap(item => {
    const value = readExplicitTickValue(item)
    if (typeof value !== 'string') return []

    const position = scale.center(value)
    if (!Number.isFinite(position)) return []

    return [{
      value,
      position,
      label: readExplicitTickLabel(item) ?? formatBandTickLabel(value, options),
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

function formatBandTickLabel(value: string, options: ChartScaleTickOptions): string {
  return options.labels?.[value] ?? options.formatter?.(value) ?? value
}
