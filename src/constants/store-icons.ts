export const STORE_ICONS: Record<string, number> = {
  '7-eleven': require('@/assets/stores/7-eleven.png'),
  familymart: require('@/assets/stores/familymart.png'),
  pxmart: require('@/assets/stores/pxmart.png'),
  hilife: require('@/assets/stores/hilife.png'),
  okmart: require('@/assets/stores/okmart.png'),
  carrefour: require('@/assets/stores/carrefour.png'),
  simplemart: require('@/assets/stores/simplemart.png'),
  costco: require('@/assets/stores/costco.png'),
  'rt-mart': require('@/assets/stores/rt-mart.png'),
  watsons: require('@/assets/stores/watsons.png'),
  cosmed: require('@/assets/stores/cosmed.png'),
  poya: require('@/assets/stores/poya.png'),
  other: require('@/assets/stores/other.png'),
};

export function getStoreIcon(id: string): number {
  return STORE_ICONS[id] ?? STORE_ICONS.other;
}
