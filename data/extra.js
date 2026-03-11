/**
 * data/extra.js — Remapped copies of all section data for performance testing.
 *
 * Imports each section's data and rewrites local asset paths to point at
 * assets/extra/ copies, so the Extra section loads genuinely separate files.
 * YouTube embed URLs are unchanged (no local copy needed).
 *
 * TO REMOVE THIS TEST SECTION:
 *   1. Delete  data/extra.js
 *   2. Delete  js/sections/Extra.js
 *   3. Delete  assets/extra/
 *   4. Remove  the 'extra' entry from js/sections/index.js
 */

import albums, { videos } from './music.js';
import art                from './art.js';
import education          from './education.js';
import projects           from './projects.js';

function remap(path) {
  return path ? path.replace(/^assets\//, 'assets/extra/') : path;
}

// Music — YouTube URLs unchanged; local audio/cover paths remapped
export const extraVideos = videos;

export const extraAlbums = albums.map(album => ({
  ...album,
  id:     `extra-${album.id}`,
  cover:  remap(album.cover),
  tracks: album.tracks.map(t => ({ ...t, file: remap(t.file) })),
}));

// Art — all image paths remapped
export const extraArt = art.map(item =>
  item.type === 'collection'
    ? { ...item, id: `extra-${item.id}`, cover: remap(item.cover), images: item.images.map(remap) }
    : { ...item, id: `extra-${item.id}`, src: remap(item.src) }
);

// Education — hero image + bottom photo remapped
export const extraEducation = education.map(item => ({
  ...item,
  id:    `extra-${item.id}`,
  image: remap(item.image),
  photo: remap(item.photo),
}));

// Projects — hero image remapped; YouTube embeds unchanged
export const extraProjects = projects.map(item => ({
  ...item,
  id:    `extra-${item.id}`,
  image: remap(item.image),
}));
