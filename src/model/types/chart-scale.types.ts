export type ChartScaleType = 'linear' | 'time' | 'band'

export type ChartContinuousScaleType = 'linear' | 'time'

export type ChartScaleRange = readonly [number, number]

export type ChartNumericDomain = readonly [number, number]

export type ChartBandDomain = ReadonlyArray<string>

export type ChartScaleDomain = ChartNumericDomain | ChartBandDomain

export type ChartScaleValue = number | string

export interface ChartScaleTick<TValue extends ChartScaleValue = ChartScaleValue> {
  value: TValue
  position: number
  label: string
  major: boolean
}

export interface ChartScaleExplicitTick<TValue extends ChartScaleValue = ChartScaleValue> {
  value: TValue
  label?: string
  major?: boolean
}

export type ChartScaleExplicitTickInput<TValue extends ChartScaleValue = ChartScaleValue>
  = | TValue
    | ChartScaleExplicitTick<TValue>

export interface ChartScaleTickOptions {
  minStepPx?: number
  maxCount?: number
  categoryStep?: number
  values?: ReadonlyArray<ChartScaleExplicitTickInput>
  labels?: Record<string, string>
  formatter?: (value: ChartScaleValue) => string
}

/* eslint-disable ts/method-signature-style -- Method variance позволяет хранить числовые и категориальные шкалы в одном runtime registry. */
export interface ChartScale<TValue extends ChartScaleValue = ChartScaleValue> {
  readonly id: string
  readonly type: ChartScaleType

  getDomain(): ChartScaleDomain
  getRange(): ChartScaleRange
  setDomain(domain: ChartScaleDomain): void
  setRange(range: ChartScaleRange): void
  toPx(value: TValue): number
  fromPx(px: number): TValue
  ticks(options?: ChartScaleTickOptions): Array<ChartScaleTick<TValue>>
}
/* eslint-enable ts/method-signature-style */

export interface ChartLinearScaleOptions {
  id: string
  type: 'linear'
  domain: ChartNumericDomain
  range?: ChartScaleRange
  clamp?: boolean
}

export interface ChartTimeScaleOptions {
  id: string
  type: 'time'
  domain: ChartNumericDomain
  range?: ChartScaleRange
  clamp?: boolean
  timezone?: string
  locale?: string
}

export interface ChartBandScaleOptions {
  id: string
  type: 'band'
  domain: ChartBandDomain
  range?: ChartScaleRange
  paddingInner?: number
  paddingOuter?: number
}

export type ChartScaleOptions = ChartLinearScaleOptions | ChartTimeScaleOptions | ChartBandScaleOptions

export type ChartTimeUnit
  = | 'millisecond'
    | 'second'
    | 'minute'
    | 'hour'
    | 'day'
    | 'week'
    | 'month'
    | 'quarter'
    | 'year'

export interface ChartTimeTickOptions extends ChartScaleTickOptions {
  strategy?: 'auto' | 'fixed' | 'calendar'
  unit?: ChartTimeUnit | 'auto'
  step?: number
  majorUnit?: ChartTimeUnit
  locale?: string
  timezone?: string
  format?: Intl.DateTimeFormatOptions | ((value: number) => string)
  majorFormat?: Intl.DateTimeFormatOptions | ((value: number) => string)
}

export interface ChartBandVisibleRange {
  startIndex: number
  endIndex: number
}
