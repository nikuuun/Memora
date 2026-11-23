import type { Album, SharedPhoto } from './store';

// Sample albums, shown while you're signed out (and in Expo Go, where Google
// sign-in can't work). Same pictures as linhant's Figma prototype.

export const SAMPLE_ME = 'you@example.com';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// fm=jpg so a saved copy is a normal JPEG the Photos app accepts.
const pic = (id: string) => `https://images.unsplash.com/${id}?fm=jpg&w=1600&q=80`;
const P = {
  beach: pic('photo-1553670440-f4fa1dfeabf4'),
  walk: pic('photo-1725975735073-61ae4e150312'),
  field: pic('photo-1615574147300-62cc3e37868f'),
  coast: pic('photo-1700908608272-14425ac565e9'),
  path: pic('photo-1734660264096-c1cc4768454f'),
};

let n = 1;
function batch(by: string, ago: number, uris: string[]): SharedPhoto[] {
  const at = Date.now() - ago;
  return uris.map((uri) => ({ id: `sample-${n++}`, uri, addedBy: by, addedAt: at, batch: String(at) }));
}

const names = {
  [SAMPLE_ME]: 'You',
  'jamie@example.com': 'Jamie Lee',
  'priya@example.com': 'Priya Shah',
  'alex@example.com': 'Alex Kim',
  'maya@example.com': 'Maya Ortiz',
  'sam@example.com': 'Sam Rivera',
};

export function sampleAlbums(): Album[] {
  return [
    {
      id: 'saltwater',
      source: 'sample',
      name: 'Saltwater days',
      createdAt: Date.now() - 9 * DAY,
      names,
      members: [
        { email: SAMPLE_ME, role: 'owner' },
        { email: 'jamie@example.com', role: 'editor' },
        { email: 'priya@example.com', role: 'editor' },
      ],
      photos: [
        ...batch('jamie@example.com', 12 * MIN, [P.beach, P.coast, P.walk, P.path, P.field, P.beach, P.coast, P.walk]),
        ...batch('priya@example.com', 2 * DAY, [P.field, P.path, P.coast]),
        ...batch(SAMPLE_ME, 8 * DAY, [P.walk, P.beach, P.path, P.field]),
      ],
    },
    {
      id: 'sunday',
      source: 'sample',
      name: 'Sunday, slowly',
      createdAt: Date.now() - 20 * DAY,
      names,
      members: [
        { email: SAMPLE_ME, role: 'owner' },
        { email: 'alex@example.com', role: 'editor' },
      ],
      photos: [
        ...batch('alex@example.com', 5 * HOUR, [P.walk, P.field]),
        ...batch(SAMPLE_ME, 19 * DAY, [P.path, P.walk, P.beach]),
      ],
    },
    {
      id: 'south',
      source: 'sample',
      name: 'Somewhere south',
      createdAt: Date.now() - 40 * DAY,
      names,
      members: [
        { email: 'maya@example.com', role: 'owner' },
        { email: SAMPLE_ME, role: 'editor' },
        { email: 'jamie@example.com', role: 'editor' },
        { email: 'sam@example.com', role: 'editor' },
      ],
      photos: [
        ...batch('sam@example.com', 3 * DAY, [P.coast, P.field]),
        ...batch('maya@example.com', 38 * DAY, [P.coast, P.beach, P.path, P.walk, P.field]),
      ],
    },
  ];
}
