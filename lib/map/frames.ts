import type { Item, QuestionRung } from '@/lib/engine/types';

/** Every frame's viewBox is this many units wide; height follows the extent. */
export const FRAME_WIDTH = 1000;

/** [west, south, east, north] in degrees; east may exceed 180 to cross the antimeridian. */
export type Extent = [number, number, number, number];

export interface FrameDef {
  id: string;
  kind: 'region' | 'continent';
  extent: Extent;
}

/** Fixed, pre-framed views (map spec §3, §11). The content build validates every item fits. */
export const FRAMES: FrameDef[] = [
  { id: 'western-northern-europe', kind: 'region', extent: [-25, 41, 32, 71.5] },
  { id: 'southern-europe-balkans', kind: 'region', extent: [-10, 34.5, 30, 48.5] },
  { id: 'central-eastern-europe', kind: 'region', extent: [5, 42, 60, 62] },
  { id: 'north-central-america', kind: 'region', extent: [-170, 6, -10, 84] },
  { id: 'caribbean', kind: 'region', extent: [-86, 9.5, -58.5, 27.5] },
  { id: 'south-america', kind: 'region', extent: [-82, -56, -34, 13] },
  { id: 'middle-east-central-asia', kind: 'region', extent: [25, 12, 88, 56] },
  { id: 'south-east-asia', kind: 'region', extent: [44, -2, 146, 54] },
  { id: 'southeast-asia', kind: 'region', extent: [92, -11.5, 142, 29] },
  { id: 'north-west-africa', kind: 'region', extent: [-26, 3, 39, 38] },
  { id: 'central-southern-africa', kind: 'region', extent: [4, -35.5, 33, 24] },
  { id: 'east-africa', kind: 'region', extent: [21, -27, 60, 18.5] },
  { id: 'oceania', kind: 'region', extent: [110, -48, 227, 22] },
  { id: 'continent-europe', kind: 'continent', extent: [-25, 34, 45, 71.5] },
  { id: 'continent-asia', kind: 'continent', extent: [25, -11.5, 150, 56] },
  { id: 'continent-africa', kind: 'continent', extent: [-26, -35.5, 60, 38] },
  { id: 'continent-north-america', kind: 'continent', extent: [-170, 6, -10, 84] },
  { id: 'continent-south-america', kind: 'continent', extent: [-82, -56, -34, 13] },
  { id: 'continent-oceania', kind: 'continent', extent: [110, -48, 227, 22] },
];

export const GROUP_FRAMES: Record<string, { region: string; continent: string }> = {
  'Western & Northern Europe': { region: 'western-northern-europe', continent: 'continent-europe' },
  'Southern Europe & Balkans': { region: 'southern-europe-balkans', continent: 'continent-europe' },
  'Central & Eastern Europe': { region: 'central-eastern-europe', continent: 'continent-europe' },
  'North & Central America': { region: 'north-central-america', continent: 'continent-north-america' },
  Caribbean: { region: 'caribbean', continent: 'continent-north-america' },
  'South America': { region: 'south-america', continent: 'continent-south-america' },
  'Middle East & Central Asia': { region: 'middle-east-central-asia', continent: 'continent-asia' },
  'South & East Asia': { region: 'south-east-asia', continent: 'continent-asia' },
  'Southeast Asia': { region: 'southeast-asia', continent: 'continent-asia' },
  'North & West Africa': { region: 'north-west-africa', continent: 'continent-africa' },
  'Central & Southern Africa': { region: 'central-southern-africa', continent: 'continent-africa' },
  'East Africa': { region: 'east-africa', continent: 'continent-africa' },
  Oceania: { region: 'oceania', continent: 'continent-oceania' },
};

const FRAME_IDS = new Set(FRAMES.map((f) => f.id));

export function isFrameId(id: string): boolean {
  return FRAME_IDS.has(id);
}

export function groupFrames(item: Item): { region: string; continent: string } {
  const frames = Object.hasOwn(GROUP_FRAMES, item.group) ? GROUP_FRAMES[item.group] : undefined;
  if (!frames) throw new Error(`No map frames for group "${item.group}" (${item.key})`);
  return frames;
}

/** Find at recall is asked on the continent; everything else on the item's region (map spec §6). */
export function frameFor(item: Item, promptType: string | null, rung: QuestionRung): string {
  const { region, continent } = groupFrames(item);
  return promptType === 'find' && rung === 3 ? continent : region;
}
