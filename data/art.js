/**
 * data/art.js — Art portfolio data.
 *
 * Two item types:
 *
 *   type: 'image'      — single standalone image
 *     src              — path to image
 *     title            — optional label
 *
 *   type: 'collection' — group of related images
 *     title            — collection name
 *     cover            — path to representative cover image
 *     images           — array of image paths
 */

const art = [
  {
    type: 'collection',
    id: 'kingi',
    title: 'Kingi',
    cover: 'archive/images/kingi_cover.png',
    images: [
      'archive/images/kingi/kingi_1.png',
      'archive/images/kingi/kingi_2.png',
      'archive/images/kingi/kingi_3.png',
      'archive/images/kingi/kingi_4.png',
      'archive/images/kingi/kingi_5.png',
      'archive/images/kingi/kingi_6.png',
      'archive/images/kingi/kingi_7.png',
      'archive/images/kingi/kingi_9.png',
      'archive/images/kingi/kingi_10.png',
      'archive/images/kingi/kingi_11.png',
    ],
  },
  {
    type: 'collection',
    id: 'sine-lines',
    title: 'Sine Lines',
    cover: 'archive/images/sineLines. (6).png',
    images: [
      'archive/images/sineLines/sineLines_1.jpg',
      'archive/images/sineLines/sineLines_2.jpg',
      'archive/images/sineLines/sineLines_3.png',
      'archive/images/sineLines/sineLines_4.jpg',
      'archive/images/sineLines/sineLines_5.png',
      'archive/images/sineLines/sineLines_6.png',
    ],
  },
  {
    type: 'collection',
    id: 'tesselation',
    title: 'Tesselation',
    cover: 'archive/images/tesselation.png',
    images: [
      'archive/images/tesselation/tesselation_1.png',
      'archive/images/tesselation/tesselation_2.png',
      'archive/images/tesselation/tesselation_3.png',
      'archive/images/tesselation/tesselation_4.png',
    ],
  },
  {
    type: 'collection',
    id: 'poem',
    title: 'Poem',
    cover: 'archive/images/poem.png',
    images: [
      'archive/images/poem/poem_1.png',
      'archive/images/poem/poem_2.png',
      'archive/images/poem/poem_3.png',
      'archive/images/poem/poem_4.png',
      'archive/images/poem/poem_5.png',
    ],
  },
  {
    type: 'collection',
    id: 'nebula',
    title: 'Nebula',
    cover: 'archive/images/network.png',
    images: [
      'archive/images/nebula/nebula_1.jpg',
      'archive/images/nebula/nebula_2.jpg',
      'archive/images/nebula/nebula_4.jpg',
      'archive/images/nebula/nebula_5.jpg',
      'archive/images/nebula/nebula_6.jpg',
    ],
  },
  { type: 'image', id: 'sdf-1',            src: 'archive/images/sdf_out_1.png' },
  { type: 'image', id: 'sdf-2',            src: 'archive/images/sdf_out_2.png' },
  { type: 'image', id: 'wandering-joiners', src: 'archive/images/5_wandering_joiners.gif' },
  { type: 'image', id: 'grid',             src: 'archive/images/grid (2).gif' },
  { type: 'image', id: 'art-deco',         src: 'archive/images/art_deco.gif' },
];

export default art;
