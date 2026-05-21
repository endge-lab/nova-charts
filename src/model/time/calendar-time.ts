import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'
import type { ChartTimeUnit } from '@/model/types/chart-scale.types'

const TIME_UNIT_ORDER: Array<ChartTimeUnit> = [
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
]

export const chartTimeUnitApproxMs: Record<ChartTimeUnit, number> = {
  millisecond: 1,
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  quarter: 7_776_000_000,
  year: 31_536_000_000,
}

export interface ChartZonedDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

/**
 * Возвращает порядок календарной единицы от мелкой к крупной.
 */
export function getChartTimeUnitRank(unit: ChartTimeUnit): number {
  return TIME_UNIT_ORDER.indexOf(unit)
}

/**
 * Округляет timestamp вниз по календарной единице в заданной таймзоне.
 */
export function floorZonedTime(timestamp: number, unit: ChartTimeUnit, timezone = 'UTC', step = 1): number {
  const parts = getZonedDateParts(timestamp, timezone)

  if (unit === 'year') {
    const year = Math.floor(parts.year / step) * step
    return zonedPartsToUtcTimestamp({ ...parts, year, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'quarter') {
    const month = Math.floor((parts.month - 1) / (step * 3)) * step * 3 + 1
    return zonedPartsToUtcTimestamp({ ...parts, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'month') {
    const month = Math.floor((parts.month - 1) / step) * step + 1
    return zonedPartsToUtcTimestamp({ ...parts, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'week') {
    const dayStart = zonedPartsToUtcTimestamp({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone)
    const day = utcToZonedTime(dayStart, timezone).getDay()
    const mondayOffset = day === 0 ? 6 : day - 1
    return addZonedTime(dayStart, 'day', -mondayOffset, timezone)
  }

  if (unit === 'day') {
    return zonedPartsToUtcTimestamp({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'hour') {
    const hour = Math.floor(parts.hour / step) * step
    return zonedPartsToUtcTimestamp({ ...parts, hour, minute: 0, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'minute') {
    const minute = Math.floor(parts.minute / step) * step
    return zonedPartsToUtcTimestamp({ ...parts, minute, second: 0, millisecond: 0 }, timezone)
  }

  if (unit === 'second') {
    const second = Math.floor(parts.second / step) * step
    return zonedPartsToUtcTimestamp({ ...parts, second, millisecond: 0 }, timezone)
  }

  const millisecond = Math.floor(parts.millisecond / step) * step
  return zonedPartsToUtcTimestamp({ ...parts, millisecond }, timezone)
}

/**
 * Добавляет календарный шаг в заданной таймзоне.
 */
export function addZonedTime(timestamp: number, unit: ChartTimeUnit, step: number, timezone = 'UTC'): number {
  const parts = getZonedDateParts(timestamp, timezone)
  const localDate = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  ))

  if (unit === 'year') localDate.setUTCFullYear(localDate.getUTCFullYear() + step)
  if (unit === 'quarter') localDate.setUTCMonth(localDate.getUTCMonth() + step * 3)
  if (unit === 'month') localDate.setUTCMonth(localDate.getUTCMonth() + step)
  if (unit === 'week') localDate.setUTCDate(localDate.getUTCDate() + step * 7)
  if (unit === 'day') localDate.setUTCDate(localDate.getUTCDate() + step)
  if (unit === 'hour') localDate.setUTCHours(localDate.getUTCHours() + step)
  if (unit === 'minute') localDate.setUTCMinutes(localDate.getUTCMinutes() + step)
  if (unit === 'second') localDate.setUTCSeconds(localDate.getUTCSeconds() + step)
  if (unit === 'millisecond') localDate.setUTCMilliseconds(localDate.getUTCMilliseconds() + step)

  return zonedPartsToUtcTimestamp({
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth() + 1,
    day: localDate.getUTCDate(),
    hour: localDate.getUTCHours(),
    minute: localDate.getUTCMinutes(),
    second: localDate.getUTCSeconds(),
    millisecond: localDate.getUTCMilliseconds(),
  }, timezone)
}

/**
 * Возвращает локальные календарные части timestamp в заданной таймзоне.
 */
export function getZonedDateParts(timestamp: number, timezone = 'UTC'): ChartZonedDateParts {
  const zoned = utcToZonedTime(new Date(timestamp), timezone)
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    second: zoned.getSeconds(),
    millisecond: zoned.getMilliseconds(),
  }
}

/**
 * Преобразует локальные календарные части таймзоны в UTC timestamp.
 */
export function zonedPartsToUtcTimestamp(parts: ChartZonedDateParts, timezone = 'UTC'): number {
  const localIso = [
    `${parts.year}`.padStart(4, '0'),
    '-',
    `${parts.month}`.padStart(2, '0'),
    '-',
    `${parts.day}`.padStart(2, '0'),
    'T',
    `${parts.hour}`.padStart(2, '0'),
    ':',
    `${parts.minute}`.padStart(2, '0'),
    ':',
    `${parts.second}`.padStart(2, '0'),
    '.',
    `${parts.millisecond}`.padStart(3, '0'),
  ].join('')

  return zonedTimeToUtc(localIso, timezone).getTime()
}
