/**
 * data/projects.js — Performances, installations, and other projects.
 *
 * Fields:
 *   id          — unique identifier
 *   title       — display title
 *   meta        — subtitle / context (HTML allowed)
 *   description — body text (HTML allowed)
 *   videoSrc    — YouTube embed URL (with enablejsapi=1)
 */

const projects = [
  {
    id: 'actuate-intimate',
    title: 'Actuate Intimate',
    meta: 'Interactive installation · 2020',
    description: `
      <p><em>Actuate Intimate</em> is an interactive work that allows the listener to explore
      the relationship between shape, material and sound in an exaggerated, detailed, and intimate way.</p>
      <p>Created in 2020, this artwork reflects an increased intimacy with household objects
      that many people experienced due to lockdowns.</p>
    `,
    videoSrc: 'https://www.youtube.com/embed/QTOwUwxtvXc?enablejsapi=1',
  },
  {
    id: 'pattern-7',
    title: 'Pattern 7',
    meta: 'Live performance · Wellington Cathedral of St Paul, Feb 2022',
    videoSrc: 'https://www.youtube.com/embed/Un6ExdGocHA?enablejsapi=1',
  },
  {
    id: 'patterns-i-ii-iii',
    title: 'Patterns i, ii and iii',
    meta: '1st place · NZ School of Music Composition Competition 2019',
    description: 'i. Tumble<br>ii. Ripple Arc<br>iii. In Agony',
    videoSrc: 'https://www.youtube.com/embed/_n0QaGwq3tA?enablejsapi=1',
  },
  {
    id: 'deux-images-performance',
    title: 'Deux Images',
    meta: 'Bella Anderson (flute) &amp; Liam Furey (piano)',
    description: 'i. Small Scurrying<br>ii. Glimpse',
    videoSrc: 'https://www.youtube.com/embed/7H52NkXAm9o?enablejsapi=1',
  },
];

export default projects;
