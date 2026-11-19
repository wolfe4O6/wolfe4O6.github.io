// Gallery for /photos.
// 1. Drop an image in public/photos/ (jpg, png, webp, or svg).
// 2. Add an entry here. `src` is the public path, starting with /photos/.
// 3. Delete any placeholder entries you do not want.
// `placeholder: true` shows a small "Placeholder" mark on the print.

export interface Photo {
  src: string;
  alt: string;
  caption: string;
  placeholder?: boolean;
}

export const photos: Photo[] = [
  {
    src: '/photos/valley.svg',
    alt: 'Placeholder drawing of a mountain valley with an M on a hillside',
    caption: 'Placeholder. A drawn valley, not a photograph.',
    placeholder: true,
  },
  {
    src: '/photos/river.svg',
    alt: 'Placeholder drawing of a river winding through a valley',
    caption: 'Placeholder. A drawn river, standing in for a real picture.',
    placeholder: true,
  },
  {
    src: '/photos/pines.svg',
    alt: 'Placeholder drawing of pine trees',
    caption: 'Placeholder. Pines, sketched until you add your own.',
    placeholder: true,
  },
  {
    src: '/photos/big-sky.svg',
    alt: 'Placeholder drawing of a wide sunset sky over low hills',
    caption: 'Placeholder. Big sky, drawn in.',
    placeholder: true,
  },
  {
    src: '/photos/cabin.svg',
    alt: 'Placeholder drawing of a cabin window glowing at night',
    caption: 'Placeholder. A cabin window at night, not a photo.',
    placeholder: true,
  },
  {
    src: '/photos/riverfront.svg',
    alt: 'Placeholder drawing of a riverfront path and a bicycle',
    caption: 'Placeholder. A riverfront, sketched.',
    placeholder: true,
  },
];
