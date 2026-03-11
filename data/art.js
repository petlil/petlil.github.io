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
 *
 * All images live under assets/images/art/.
 */

const art = [
  {
    type: 'collection',
    id: 'kingi',
    title: 'Kingi',
    cover: 'assets/images/art/kingi/kingi_cover.webp',
    images: [
      'assets/images/art/kingi/kingi_1.webp',
      'assets/images/art/kingi/kingi_2.webp',
      'assets/images/art/kingi/kingi_3.webp',
      'assets/images/art/kingi/kingi_4.webp',
      'assets/images/art/kingi/kingi_5.webp',
      'assets/images/art/kingi/kingi_6.webp',
      'assets/images/art/kingi/kingi_7.webp',
      'assets/images/art/kingi/kingi_9.webp',
      'assets/images/art/kingi/kingi_10.webp',
      'assets/images/art/kingi/kingi_11.webp',
    ],
  },
  {
    type: 'collection',
    id: 'sine-lines',
    title: 'Sine Lines',
    cover: 'assets/images/art/sine-lines/sine-lines_cover.webp',
    images: [
      'assets/images/art/sine-lines/sineLines_1.webp',
      'assets/images/art/sine-lines/sineLines_2.webp',
      'assets/images/art/sine-lines/sineLines_3.webp',
      'assets/images/art/sine-lines/sineLines_4.webp',
      'assets/images/art/sine-lines/sineLines_5.webp',
      'assets/images/art/sine-lines/sineLines_6.webp',
    ],
  },
  {
    type: 'collection',
    id: 'tesselation',
    title: 'Tesselation',
    cover: 'assets/images/art/tesselation/tesselation_cover.webp',
    images: [
      'assets/images/art/tesselation/tesselation_1.webp',
      'assets/images/art/tesselation/tesselation_2.webp',
      'assets/images/art/tesselation/tesselation_3.webp',
      'assets/images/art/tesselation/tesselation_4.webp',
    ],
  },
  {
    type: 'collection',
    id: 'poem',
    title: 'Poem',
    cover: 'assets/images/art/poem/poem_cover.webp',
    images: [
      'assets/images/art/poem/poem_1.webp',
      'assets/images/art/poem/poem_2.webp',
      'assets/images/art/poem/poem_3.webp',
      'assets/images/art/poem/poem_4.webp',
      'assets/images/art/poem/poem_5.webp',
    ],
  },
  {
    type: 'collection',
    id: 'nebula',
    title: 'Nebula',
    cover: 'assets/images/art/nebula/sdf_out_1.webp',
    images: [
      'assets/images/art/nebula/sdf_out_1.webp',
      'assets/images/art/nebula/sdf_out_2.webp',
      'assets/images/art/nebula/nebula_1.webp',
      'assets/images/art/nebula/nebula_2.webp',
      'assets/images/art/nebula/nebula_4.webp',
      'assets/images/art/nebula/nebula_5.webp',
      'assets/images/art/nebula/nebula_6.webp',
    ],
  },
  {
    type: 'collection',
    id: 'posters',
    title: 'Posters',
    cover: 'assets/images/art/posters/Pyramid_19_sept_poster_final.webp',
    images: [
      'assets/images/art/posters/Pyramid_19_sept_poster_final.webp',
      'assets/images/art/posters/Banner_15_March.webp',
      'assets/images/art/posters/Friendship_poster.webp',
    ],
  },
];

export default art;
