export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US')}`
}
