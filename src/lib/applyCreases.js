// Multiply the shadow map, then screen the highlight map.
// Each map is neutral almost everywhere (white shadows, black highlights),
// so a texel that is not a crease is left alone. Both blends are opaque,
// which would fill the cutout, so the photo's alpha is stamped back after
// each one.

export function applyCreases(ctx, { shade, shadow, highlight, stamp, rect, cssW, cssH }) {
  if (shade <= 0.001 || rect.w < 1 || rect.h < 1) return
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = shade
  ctx.drawImage(shadow, rect.x, rect.y, rect.w, rect.h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.globalAlpha = 1
  ctx.drawImage(stamp, 0, 0, cssW, cssH)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = shade
  ctx.drawImage(highlight, rect.x, rect.y, rect.w, rect.h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.globalAlpha = 1
  ctx.drawImage(stamp, 0, 0, cssW, cssH)
  ctx.restore()
}
