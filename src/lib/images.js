// Product photos are stored as one path (the 800px card size). The larger file for the product
// page has the same name with -large before .webp. See api/models.py (Product.image_urls).
export const CARD_WIDTH = 800
export const CARD_HEIGHT = 993
export const LARGE_WIDTH = 928
export const LARGE_HEIGHT = 1152

export function largeImage(cardUrl) {
  return cardUrl.replace(/\.webp$/, '-large.webp')
}
