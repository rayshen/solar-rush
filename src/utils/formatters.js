function formatNumber(value, unit = '', locale = 'zh-CN') {
  return `${new Intl.NumberFormat(locale).format(Math.round(value))}${unit}`;
}
function formatFixed(value, digits = 2) {
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
function formatDistance(value) {
  if (value >= 1_000_000_000) return `${formatFixed(value / 1_000_000_000, 2)}B km`;
  if (value >= 1_000_000) return `${formatFixed(value / 1_000_000, 1)}M km`;
  return formatNumber(value, ' km');
}
function formatLunarDate(date) {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Shanghai'
    }).formatToParts(date);
    const yearName = parts.find(({
      type
    }) => type === 'yearName')?.value;
    const month = parts.find(({
      type
    }) => type === 'month')?.value;
    const day = Number(parts.find(({
      type
    }) => type === 'day')?.value);
    if (!yearName || !month || !Number.isInteger(day) || day < 1 || day > 30) {
      throw new Error('Unsupported Chinese calendar parts');
    }
    const dayNames = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
    return `${yearName}年${month}${dayNames[day - 1]}`;
  } catch {
    return '当前浏览器不支持农历格式';
  }
}
function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
function estimateEscapeVelocity(body) {
  const gravity = Number.parseFloat(body.gravity);
  if (!Number.isFinite(gravity)) return '—';
  const velocity = Math.sqrt(2 * gravity * body.radiusKm * 1000) / 1000;
  return `${formatFixed(velocity, 1)} km/s`;
}
export { formatNumber, formatFixed, formatDistance, formatLunarDate, formatElapsed, estimateEscapeVelocity };
