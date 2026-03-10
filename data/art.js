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
    cover: 'assets/images/art/kingi/kingi_cover.png',
    images: [
      'assets/images/art/kingi/kingi_1.png',
      'assets/images/art/kingi/kingi_2.png',
      'assets/images/art/kingi/kingi_3.png',
      'assets/images/art/kingi/kingi_4.png',
      'assets/images/art/kingi/kingi_5.png',
      'assets/images/art/kingi/kingi_6.png',
      'assets/images/art/kingi/kingi_7.png',
      'assets/images/art/kingi/kingi_9.png',
      'assets/images/art/kingi/kingi_10.png',
      'assets/images/art/kingi/kingi_11.png',
    ],
  },
  {
    type: 'collection',
    id: 'sine-lines',
    title: 'Sine Lines',
    cover: 'assets/images/art/sine-lines/sine-lines_cover.png',
    images: [
      'assets/images/art/sine-lines/sineLines_1.jpg',
      'assets/images/art/sine-lines/sineLines_2.jpg',
      'assets/images/art/sine-lines/sineLines_3.png',
      'assets/images/art/sine-lines/sineLines_4.jpg',
      'assets/images/art/sine-lines/sineLines_5.png',
      'assets/images/art/sine-lines/sineLines_6.png',
    ],
  },
  {
    type: 'collection',
    id: 'tesselation',
    title: 'Tesselation',
    cover: 'assets/images/art/tesselation/tesselation_cover.png',
    images: [
      'assets/images/art/tesselation/tesselation_1.png',
      'assets/images/art/tesselation/tesselation_2.png',
      'assets/images/art/tesselation/tesselation_3.png',
      'assets/images/art/tesselation/tesselation_4.png',
    ],
  },
  {
    type: 'collection',
    id: 'poem',
    title: 'Poem',
    cover: 'assets/images/art/poem/poem_cover.png',
    images: [
      'assets/images/art/poem/poem_1.png',
      'assets/images/art/poem/poem_2.png',
      'assets/images/art/poem/poem_3.png',
      'assets/images/art/poem/poem_4.png',
      'assets/images/art/poem/poem_5.png',
    ],
  },
  {
    type: 'collection',
    id: 'nebula',
    title: 'Nebula',
    cover: 'assets/images/art/nebula/sdf_out_1.png',
    images: [
      'assets/images/art/nebula/sdf_out_1.png',
      'assets/images/art/nebula/sdf_out_2.png',
      'assets/images/art/nebula/nebula_1.jpg',
      'assets/images/art/nebula/nebula_2.jpg',
      'assets/images/art/nebula/nebula_4.jpg',
      'assets/images/art/nebula/nebula_5.jpg',
      'assets/images/art/nebula/nebula_6.jpg',
    ],
  },
  {
    type: 'collection',
    id: 'posters',
    title: 'Posters',
    cover: 'assets/images/art/posters/Pyramid_19_sept_poster_final.png',
    images: [
      'assets/images/art/posters/Pyramid_19_sept_poster_final.png',
      'assets/images/art/posters/Banner_15_March.png',
      'assets/images/art/posters/Friendship_poster.jpg',
    ],
  },
];

export default art;
