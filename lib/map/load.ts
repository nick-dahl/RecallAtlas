import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { isFrameId } from './frames';
import type { FrameData } from './types';

const DIR = path.join(process.cwd(), 'content', 'maps');
const cache = new Map<string, FrameData>();

/** Server-only hit data for a frame (content/maps/<id>.hit.json), cached per process. */
export function loadFrame(id: string): FrameData {
  if (!isFrameId(id)) throw new Error(`Unknown map frame ${id}`);
  let frame = cache.get(id);
  if (!frame) {
    frame = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.hit.json`), 'utf8')) as FrameData;
    cache.set(id, frame);
  }
  return frame;
}
