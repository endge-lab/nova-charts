import type { ChartScale, ChartScaleDomain, ChartScaleRange, ChartScaleValue } from '@/model/types/chart-scale.types'

/**
 * Хранит именованные шкалы chart runtime и дает компонентам доступ по scale id.
 */
export class ChartScaleRegistry {
  private readonly _scales = new Map<string, ChartScale>()

  /**
   * Регистрирует шкалу или заменяет существующую с тем же id.
   */
  register(scale: ChartScale): void {
    this._scales.set(scale.id, scale)
  }

  /**
   * Удаляет шкалу по id.
   */
  unregister(id: string): void {
    this._scales.delete(id)
  }

  /**
   * Проверяет наличие шкалы.
   */
  has(id: string): boolean {
    return this._scales.has(id)
  }

  /**
   * Возвращает шкалу или undefined.
   */
  get<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> | undefined {
    return this._scales.get(id) as ChartScale<TValue> | undefined
  }

  /**
   * Возвращает шкалу или бросает явную ошибку конфигурации.
   */
  require<TValue extends ChartScaleValue = ChartScaleValue>(id: string): ChartScale<TValue> {
    const scale = this.get<TValue>(id)
    if (!scale) {
      throw new Error(`[NovaCharts] Scale "${id}" is not registered`)
    }
    return scale
  }

  /**
   * Возвращает все шкалы в порядке регистрации.
   */
  list(): Array<ChartScale> {
    return Array.from(this._scales.values())
  }

  /**
   * Обновляет домен зарегистрированной шкалы.
   */
  setDomain(id: string, domain: ChartScaleDomain): void {
    this.require(id).setDomain(domain)
  }

  /**
   * Обновляет пиксельный диапазон зарегистрированной шкалы.
   */
  setRange(id: string, range: ChartScaleRange): void {
    this.require(id).setRange(range)
  }

  /**
   * Очищает registry.
   */
  clear(): void {
    this._scales.clear()
  }
}
