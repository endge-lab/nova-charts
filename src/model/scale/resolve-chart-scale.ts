import type { ChartDataStore } from '@/model/data/ChartDataStore'
import type { NovaChartScaleResolvedProps } from '@/model/types/chart-components.types'
import type {
  ChartBandDomain,
  ChartNumericDomain,
  ChartScale,
  ChartScaleDomain,
} from '@/model/types/chart-scale.types'
import { createChartScale } from '@/model/scale/create-chart-scale'

/**
 * Создает chart scale из декларативного компонента и текущего data store.
 */
export function resolveChartScale<TData>(
  id: string,
  props: NovaChartScaleResolvedProps<TData>,
  dataStore: ChartDataStore<TData>,
): ChartScale {
  const domain = resolveScaleDomain(props, dataStore)

  if (props.scaleType === 'band') {
    return createChartScale({
      id,
      type: 'band',
      domain: domain as ChartBandDomain,
      paddingInner: props.paddingInner,
      paddingOuter: props.paddingOuter,
    })
  }

  if (props.scaleType === 'time') {
    return createChartScale({
      id,
      type: 'time',
      domain: domain as ChartNumericDomain,
      clamp: props.clamp,
      locale: props.locale,
      timezone: props.timezone,
    })
  }

  return createChartScale({
    id,
    type: 'linear',
    domain: domain as ChartNumericDomain,
    clamp: props.clamp,
  })
}

/**
 * Выводит домен шкалы из props.domain или из индексированных данных.
 */
export function resolveScaleDomain<TData>(
  props: NovaChartScaleResolvedProps<TData>,
  dataStore: ChartDataStore<TData>,
): ChartScaleDomain {
  if (props.domain) {
    return props.domain
  }

  if (props.scaleType === 'band') {
    return props.field ? dataStore.categoryDomain(props.field) : []
  }

  const extent = props.field ? dataStore.numericExtent(props.field) : [0, 1] as const
  let [min, max] = extent

  if (props.zero) {
    min = Math.min(0, min)
    max = Math.max(0, max)
  }

  if (props.nice) {
    const nice = niceNumericDomain(min, max)
    min = nice[0]
    max = nice[1]
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  return [min, max]
}

function niceNumericDomain(min: number, max: number): ChartNumericDomain {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1]
  }
  const span = Math.abs(max - min)
  if (span === 0) {
    return [Math.floor(min), Math.ceil(max + 1)]
  }

  const power = 10 ** Math.floor(Math.log10(span))
  const step = power / 2
  return [
    Math.floor(min / step) * step,
    Math.ceil(max / step) * step,
  ]
}
