import type { ItemView } from '@/lib/study/types';
import { imageKind } from '@/lib/ui/item-image';
import { Flag } from './flag';
import { Painting } from './painting';
import { Portrait } from './portrait';

/**
 * An item's picture: a flag stamp, a portrait frame or a painting on its mat. `labelled` sets the alt text to the name
 * (reference views only; never in a question). Renders nothing when the item has no picture.
 */
export function ItemImage({
  item,
  labelled = false,
  eager = false,
  className = '',
}: {
  item: Pick<ItemView, 'flag' | 'portrait' | 'painting' | 'detail' | 'name'>;
  labelled?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const alt = labelled ? item.name : '';
  switch (imageKind(item)) {
    case 'flag':
      return <Flag src={item.flag!} alt={alt} eager={eager} className={className} />;
    case 'portrait':
      return <Portrait src={item.portrait!} alt={alt} eager={eager} className={className} />;
    case 'painting':
      return <Painting src={item.painting!} alt={alt} eager={eager} detail={item.detail} fit="square" className={className} />;
    default:
      return null;
  }
}
