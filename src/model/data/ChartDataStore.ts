import type {
  NovaChartFieldAccessor,
  NovaChartRowKey,
} from '@/model/types/chart-components.types'

interface FieldCache {
  numericExtent?: readonly [number, number]
  categoryDomain?: ReadonlyArray<string>
  categoryIndices?: Map<string, Array<number>>
}

/**
 * Индексирует данные chart runtime и держит быстрые производные структуры.
 */
export class ChartDataStore<TData = Record<string, unknown>> {
  private rows: Array<TData>
  private keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  private readonly keyIndex = new Map<NovaChartRowKey, number>()
  private readonly fieldCache = new Map<string, FieldCache>()
  private _revision = 0

  /**
   * Создает экземпляр ChartDataStore и подготавливает базовое состояние.
   */
  constructor(options: {
    data?: Array<TData>
    keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  } = {}) {
    this.rows = options.data ? [...options.data] : []
    this.keyField = options.keyField
    this.rebuildKeyIndex()
  }

  /**
   * Возвращает revision для ChartDataStore.
   */
  get revision(): number {
    return this._revision
  }

  /**
   * Возвращает row Count для ChartDataStore.
   */
  get rowCount(): number {
    return this.rows.length
  }

  /**
   * Возвращает значение состояния ChartDataStore.
   */
  getData(): ReadonlyArray<TData> {
    return this.rows
  }

  /**
   * Обновляет значение состояния ChartDataStore.
   */
  setData(data: Array<TData>, keyField = this.keyField): void {
    this.rows = [...data]
    this.keyField = keyField
    this.invalidate()
    this.rebuildKeyIndex()
  }

  /**
   * Обновляет runtime-состояние ChartDataStore.
   */
  updateRows(rows: Array<Partial<TData> & Record<string, unknown>>): void {
    if (rows.length === 0) {
      return
    }

    const additions: Array<TData> = []
    for (const patch of rows) {
      const key = this.readPatchKey(patch)
      const index = key === undefined ? -1 : this.keyIndex.get(key) ?? -1
      if (index >= 0) {
        this.rows[index] = {
          ...(this.rows[index] as Record<string, unknown>),
          ...patch,
        } as TData
        continue
      }

      additions.push(patch as TData)
    }

    if (additions.length > 0) {
      this.rows.push(...additions)
    }
    this.invalidate()
    this.rebuildKeyIndex()
  }

  /**
   * Удаляет сущность из runtime-коллекции ChartDataStore.
   */
  removeRows(keys: Array<NovaChartRowKey>): void {
    if (keys.length === 0) {
      return
    }

    const removed = new Set<NovaChartRowKey>(keys)
    this.rows = this.rows.filter((row, index) => !removed.has(this.getRowKey(row, index)))
    this.invalidate()
    this.rebuildKeyIndex()
  }

  /**
   * Возвращает значение состояния ChartDataStore.
   */
  getRowKey(row: TData, index: number): NovaChartRowKey {
    const key = this.keyField ? this.readField(row, index, this.keyField) : undefined
    if (typeof key === 'string' || typeof key === 'number') {
      return key
    }
    return index
  }

  /**
   * Выполняет действие readField в рамках ответственности ChartDataStore.
   */
  readField<TValue = unknown>(
    row: TData,
    index: number,
    field: NovaChartFieldAccessor<TData, TValue>,
  ): TValue {
    if (typeof field === 'function') {
      return field(row, index)
    }
    if (row && typeof row === 'object' && field in (row as Record<string, unknown>)) {
      return (row as Record<string, unknown>)[String(field)] as TValue
    }
    return undefined as TValue
  }

  /**
   * Выполняет действие numericExtent в рамках ответственности ChartDataStore.
   */
  numericExtent(field: NovaChartFieldAccessor<TData>): readonly [number, number] {
    const cache = this.getFieldCache(field)
    if (cache.numericExtent) {
      return cache.numericExtent
    }

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    this.rows.forEach((row, index) => {
      const value = Number(this.readField(row, index, field))
      if (!Number.isFinite(value)) {
        return
      }
      if (value < min) {
        min = value
      }
      if (value > max) {
        max = value
      }
    })

    cache.numericExtent = min === Number.POSITIVE_INFINITY ? [0, 1] : [min, max]
    return cache.numericExtent
  }

  /**
   * Выполняет действие categoryDomain в рамках ответственности ChartDataStore.
   */
  categoryDomain(field: NovaChartFieldAccessor<TData>): ReadonlyArray<string> {
    const cache = this.getFieldCache(field)
    if (cache.categoryDomain) {
      return cache.categoryDomain
    }

    const seen = new Set<string>()
    const domain: Array<string> = []
    this.rows.forEach((row, index) => {
      const value = String(this.readField(row, index, field) ?? '')
      if (seen.has(value)) {
        return
      }
      seen.add(value)
      domain.push(value)
    })

    cache.categoryDomain = domain
    return domain
  }

  /**
   * Выполняет действие categoryIndices в рамках ответственности ChartDataStore.
   */
  categoryIndices(field: NovaChartFieldAccessor<TData>): Map<string, Array<number>> {
    const cache = this.getFieldCache(field)
    if (cache.categoryIndices) {
      return cache.categoryIndices
    }

    const indices = new Map<string, Array<number>>()
    this.rows.forEach((row, index) => {
      const value = String(this.readField(row, index, field) ?? '')
      let bucket = indices.get(value)
      if (!bucket) {
        bucket = []
        indices.set(value, bucket)
      }
      bucket.push(index)
    })

    cache.categoryIndices = indices
    return indices
  }

  /**
   * Выполняет действие visibleRowsByCategoryRange в рамках ответственности ChartDataStore.
   */
  visibleRowsByCategoryRange(
    field: NovaChartFieldAccessor<TData>,
    domain: ReadonlyArray<string>,
    startIndex: number,
    endIndex: number,
  ): Array<number> {
    if (endIndex < startIndex) {
      return []
    }

    const indices = this.categoryIndices(field)
    const result: Array<number> = []
    const safeStart = Math.max(0, startIndex)
    const safeEnd = Math.min(domain.length - 1, endIndex)

    for (let index = safeStart; index <= safeEnd; index += 1) {
      const category = domain[index]
      const rows = category === undefined ? undefined : indices.get(category)
      if (rows) {
        result.push(...rows)
      }
    }
    return result
  }

  /**
   * Выполняет внутренний шаг readPatchKey для ChartDataStore.
   */
  private readPatchKey(patch: Partial<TData> & Record<string, unknown>): NovaChartRowKey | undefined {
    if (!this.keyField) {
      return undefined
    }
    if (typeof this.keyField === 'function') {
      const key = this.keyField(patch as TData, -1)
      return typeof key === 'string' || typeof key === 'number' ? key : undefined
    }

    const key = patch[String(this.keyField)]
    return typeof key === 'string' || typeof key === 'number' ? key : undefined
  }

  /**
   * Выполняет внутренний шаг rebuildKeyIndex для ChartDataStore.
   */
  private rebuildKeyIndex(): void {
    this.keyIndex.clear()
    this.rows.forEach((row, index) => {
      this.keyIndex.set(this.getRowKey(row, index), index)
    })
  }

  /**
   * Помечает runtime-состояние как требующее обновления ChartDataStore.
   */
  private invalidate(): void {
    this._revision += 1
    this.fieldCache.clear()
  }

  /**
   * Возвращает значение состояния ChartDataStore.
   */
  private getFieldCache(field: NovaChartFieldAccessor<TData>): FieldCache {
    const key = fieldCacheKey(field)
    let cache = this.fieldCache.get(key)
    if (!cache) {
      cache = {}
      this.fieldCache.set(key, cache)
    }
    return cache
  }
}

function fieldCacheKey(field: NovaChartFieldAccessor<any>): string {
  if (typeof field === 'function') {
    return `fn:${field.toString()}`
  }
  return `field:${String(field)}`
}
