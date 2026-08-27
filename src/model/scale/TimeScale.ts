import type {
  ChartNumericDomain,
  ChartScaleDomain,
  ChartScaleExplicitTickInput,
  ChartScaleRange,
  ChartScaleTick,
  ChartTimeTickOptions,
  ChartTimeUnit,
} from '@/model/types/chart-scale.types'
import { LinearScale } from '@/model/scale/LinearScale'
import {
  addZonedTime,
  chartTimeUnitApproxMs,
  floorZonedTime,
  getChartTimeUnitRank,
} from '@/model/time/calendar-time'

const DEFAULT_RANGE: ChartScaleRange = [0, 1]

const AUTO_TIME_STEPS: Array<{ unit: ChartTimeUnit, step: number }> = [
  { unit: 'second', step: 1 },
  { unit: 'second', step: 5 },
  { unit: 'second', step: 15 },
  { unit: 'second', step: 30 },
  { unit: 'minute', step: 1 },
  { unit: 'minute', step: 5 },
  { unit: 'minute', step: 15 },
  { unit: 'minute', step: 30 },
  { unit: 'hour', step: 1 },
  { unit: 'hour', step: 3 },
  { unit: 'hour', step: 6 },
  { unit: 'hour', step: 12 },
  { unit: 'day', step: 1 },
  { unit: 'week', step: 1 },
  { unit: 'month', step: 1 },
  { unit: 'quarter', step: 1 },
  { unit: 'year', step: 1 },
]

/**
 * Преобразует timestamp в пиксели и строит календарные ticks.
 */
export class TimeScale extends LinearScale {
  override readonly type = 'time'

  private readonly timezone: string
  private readonly locale: string

  /**
   * Создает временную шкалу с IANA timezone для форматирования и календарных шагов.
   */
  constructor(
    id: string,
    options: {
      domain: ChartNumericDomain
      range?: ChartScaleRange
      clamp?: boolean
      timezone?: string
      locale?: string
    },
  ) {
    super(id, {
      domain: options.domain,
      range: options.range ?? DEFAULT_RANGE,
      clamp: options.clamp,
    })
    this.timezone = options.timezone ?? 'UTC'
    this.locale = options.locale ?? 'ru-RU'
  }

  /**
   * Заменяет домен данных.
   */
  override setDomain(domain: ChartScaleDomain): void {
    super.setDomain(domain)
  }

  /**
   * Строит ticks по календарным единицам без приближения месяца к 30 дням.
   */
  override ticks(options: ChartTimeTickOptions = {}): Array<ChartScaleTick<number>> {
    if (options.values?.length) {
      return this.createExplicitTicks(options.values, options)
    }

    const [domainStart, domainEnd] = this.getDomain()
    const unitConfig = this.resolveTickUnit(options)
    const timezone = options.timezone ?? this.timezone
    const formatter = this.createFormatter(options, unitConfig.unit)
    const majorFormatter = this.createMajorFormatter(options, unitConfig.unit)
    const ticks: Array<ChartScaleTick<number>> = []
    const start = floorZonedTime(Math.min(domainStart, domainEnd), unitConfig.unit, timezone, unitConfig.step)
    const end = Math.max(domainStart, domainEnd)
    let value = start
    let guard = 0

    while (value <= end && guard < 10_000) {
      if (value >= Math.min(domainStart, domainEnd)) {
        const major = this.isMajorTick(value, unitConfig.unit, options.majorUnit, timezone)
        ticks.push({
          value,
          position: this.toPx(value),
          label: major ? majorFormatter(value) : formatter(value),
          major,
        })
      }
      value = addZonedTime(value, unitConfig.unit, unitConfig.step, timezone)
      guard += 1
    }

    return ticks
  }

  /**
   * Строит ticks из явно переданного списка values/labels.
   */
  private createExplicitTicks(
    values: ReadonlyArray<ChartScaleExplicitTickInput>,
    options: ChartTimeTickOptions,
  ): Array<ChartScaleTick<number>> {
    const formatter = this.createFormatter(options, options.unit && options.unit !== 'auto' ? options.unit : 'day')

    return values.flatMap((item) => {
      const value = typeof item === 'object' ? item.value : item
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return []
      }

      return [{
        value,
        position: this.toPx(value),
        label: typeof item === 'object' && item.label
          ? item.label
          : options.labels?.[String(value)] ?? options.formatter?.(value) ?? formatter(value),
        major: typeof item === 'object' ? item.major ?? true : true,
      }]
    })
  }

  /**
   * Выбирает единицу и шаг tick для текущего масштаба.
   */
  private resolveTickUnit(options: ChartTimeTickOptions): { unit: ChartTimeUnit, step: number } {
    if (options.unit && options.unit !== 'auto') {
      return {
        unit: options.unit,
        step: options.step ?? 1,
      }
    }

    const [domainStart, domainEnd] = this.getDomain()
    const [rangeStart, rangeEnd] = this.getRange()
    const span = Math.abs(domainEnd - domainStart)
    const range = Math.max(1, Math.abs(rangeEnd - rangeStart))
    const minStepPx = options.minStepPx ?? 64
    const maxCount = options.maxCount ?? Math.max(1, Math.floor(range / minStepPx))

    for (const candidate of AUTO_TIME_STEPS) {
      const approxCount = span / (chartTimeUnitApproxMs[candidate.unit] * candidate.step)
      const stepPx = range / Math.max(1, approxCount)
      if (approxCount <= maxCount && stepPx >= minStepPx) {
        return candidate
      }
    }

    const yearStep = Math.max(1, Math.ceil(span / chartTimeUnitApproxMs.year / maxCount))
    return { unit: 'year', step: yearStep }
  }

  /**
   * Создает formatter обычного tick label.
   */
  private createFormatter(options: ChartTimeTickOptions, unit: ChartTimeUnit): (value: number) => string {
    if (typeof options.format === 'function') {
      return options.format
    }

    const format = options.format ?? defaultTimeFormat(unit)
    const formatter = new Intl.DateTimeFormat(options.locale ?? this.locale, {
      ...format,
      timeZone: options.timezone ?? this.timezone,
    })

    return value => formatter.format(new Date(value))
  }

  /**
   * Создает formatter major tick label.
   */
  private createMajorFormatter(options: ChartTimeTickOptions, unit: ChartTimeUnit): (value: number) => string {
    if (typeof options.majorFormat === 'function') {
      return options.majorFormat
    }

    const format = options.majorFormat ?? defaultMajorTimeFormat(unit)
    const formatter = new Intl.DateTimeFormat(options.locale ?? this.locale, {
      ...format,
      timeZone: options.timezone ?? this.timezone,
    })

    return value => formatter.format(new Date(value))
  }

  /**
   * Определяет, является ли tick крупной границей периода.
   */
  private isMajorTick(
    value: number,
    unit: ChartTimeUnit,
    explicitMajorUnit: ChartTimeUnit | undefined,
    timezone: string,
  ): boolean {
    const majorUnit = explicitMajorUnit ?? defaultMajorUnit(unit)
    if (getChartTimeUnitRank(majorUnit) <= getChartTimeUnitRank(unit)) {
      return true
    }
    return floorZonedTime(value, majorUnit, timezone, 1) === value
  }
}

/**
 * Возвращает формат обычного label для календарной единицы.
 */
function defaultTimeFormat(unit: ChartTimeUnit): Intl.DateTimeFormatOptions {
  if (unit === 'year') {
    return { year: 'numeric' }
  }
  if (unit === 'month' || unit === 'quarter') {
    return { month: 'short', year: 'numeric' }
  }
  if (unit === 'week' || unit === 'day') {
    return { day: '2-digit', month: 'short' }
  }
  if (unit === 'hour') {
    return { hour: '2-digit', minute: '2-digit' }
  }
  if (unit === 'minute') {
    return { hour: '2-digit', minute: '2-digit' }
  }
  return { minute: '2-digit', second: '2-digit' }
}

/**
 * Возвращает формат крупного label для календарной единицы.
 */
function defaultMajorTimeFormat(unit: ChartTimeUnit): Intl.DateTimeFormatOptions {
  if (unit === 'year') {
    return { year: 'numeric' }
  }
  if (unit === 'month' || unit === 'quarter') {
    return { year: 'numeric' }
  }
  if (unit === 'week' || unit === 'day') {
    return { month: 'long', year: 'numeric' }
  }
  return { day: '2-digit', month: 'short', year: 'numeric' }
}

/**
 * Возвращает следующую крупную единицу для major ticks.
 */
function defaultMajorUnit(unit: ChartTimeUnit): ChartTimeUnit {
  if (unit === 'millisecond' || unit === 'second' || unit === 'minute') {
    return 'hour'
  }
  if (unit === 'hour') {
    return 'day'
  }
  if (unit === 'day' || unit === 'week') {
    return 'month'
  }
  if (unit === 'month' || unit === 'quarter') {
    return 'year'
  }
  return 'year'
}
