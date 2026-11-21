// Photographs in the home page hero. Both are freely licensed.
// To swap one, replace the image file and update the credit here and in the README.

export const heroPhotos = [
  {
    id: 'm',
    alt: 'The white M on the grassy face of Mount Sentinel above Missoula, in late-day light.',
    label: 'The M',
    place: 'Mount Sentinel',
    href: '/archive/',
    pin: { left: '14%', top: '24%' },
    credit: {
      photographer: 'Lance Fisher',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:View_of_Mt._Sentinal_from_Bear%27s_Brew_-_Flickr_-_lancefisher.jpg',
    },
  },
  {
    id: 'l',
    alt: 'The white L on Mount Jumbo above Missoula, with the hillside filling the frame.',
    label: 'The L',
    place: 'Mount Jumbo',
    href: '/now/',
    pin: { left: '48%', top: '36%' },
    credit: {
      photographer: 'Chris Phan',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mount_Jumbo_in_Missoula.jpg',
    },
  },
] as const;
