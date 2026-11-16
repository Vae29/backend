function parseDecimalValue(value, maxDecimals) {
  if (value == null) return NaN
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return NaN
    return Number(value.toFixed(maxDecimals)) === value ? value : NaN
  }

  let text = String(value).trim().replace(/\s/g, '')
  if (!text) return NaN
  const negative = text.includes('-')
  text = text.replace(/[^0-9.,]/g, '')
  if (!text) return NaN

  const separators = new Set(text.match(/[.,]/g) || [])
  const lastSeparator = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','))
  const trailingDigits = lastSeparator < 0 ? 0 : text.length - lastSeparator - 1
  let integerPart
  let decimalPart = ''

  if (separators.size === 2) {
    if (trailingDigits < 1 || trailingDigits > maxDecimals) return NaN
    const rawInteger = text.slice(0, lastSeparator)
    const groupingSeparator = text[lastSeparator] === '.' ? ',' : '.'
    const groups = rawInteger.split(groupingSeparator)
    if (
      groups.some((group, index) =>
        !/^\d+$/.test(group) || (index > 0 && group.length !== 3) ||
        (index === 0 && (group.length < 1 || group.length > 3))
      )
    ) return NaN
    integerPart = groups.join('')
    decimalPart = text.slice(lastSeparator + 1)
  } else if (separators.size === 1) {
    const separator = [...separators][0]
    const parts = text.split(separator)
    if (parts.length > 2) {
      if (parts.some((part, index) =>
        !/^\d+$/.test(part) || (index > 0 && part.length !== 3) ||
        (index === 0 && (part.length < 1 || part.length > 3))
      )) return NaN
      integerPart = parts.join('')
    } else if (trailingDigits > 0 && trailingDigits <= maxDecimals) {
      integerPart = parts[0]
      decimalPart = parts[1]
    } else if (
      maxDecimals < 3 &&
      trailingDigits === 3 &&
      parts[0].length >= 1 &&
      parts[0].length <= 3
    ) {
      integerPart = parts.join('')
    } else {
      return NaN
    }
  } else {
    integerPart = text
  }

  const parsed = Number(`${integerPart || '0'}${decimalPart ? `.${decimalPart}` : ''}`)
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : NaN
}

export function parseCurrencyValue(value) {
  return parseDecimalValue(value, 2)
}

export function parseQuantityValue(value) {
  return parseDecimalValue(value, 3)
}
