/** Colours shared by the widget and the zone editor. */
export const Theme = Object.freeze({
  zone: Object.freeze({
    1: '#3B82F6',
    2: '#A855F7',
    3: '#14B8A6',
    exclusion: '#EF4444',
  }),
  targets: Object.freeze(['#3B82F6', '#F97316', '#10B981']),
  sensor: '#3B82F6',
});

/** Zone keys in drawing order: the exclusion zone at the bottom. */
export const ZONE_DRAW_ORDER = Object.freeze(['exclusion', '3', '2', '1']);
