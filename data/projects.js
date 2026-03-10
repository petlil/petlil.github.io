/**
 * data/projects.js — Performances, installations, and other projects.
 *
 * Fields:
 *   id          — unique identifier
 *   title       — display title
 *   meta        — subtitle / context (HTML allowed)
 *   description — body text (HTML allowed)
 *   image       — path to hero image (shown above content, no video)
 *   videoSrc    — YouTube embed URL (with enablejsapi=1); omit for text-only cards
 *   links       — array of { label, href, icon? } for social/external links
 */

const projects = [
  {
    id: 'the-temple',
    title: 'The Temple',
    meta: 'Band · Wellington',
    image: 'assets/images/the-temple/temple_cover.png',
    description: `
      <p>Spiritual instrumental-electronic ceremonies in Pōneke NZ.</p>
    `,
    links: [
      { label: '@thetemplenz', href: 'https://www.instagram.com/thetemplenz/', icon: 'instagram' },
    ],
  },
  {
    id: 'atoms',
    title: 'ATOMS',
    description: `
      <p>ATOMS is a live audiovisual show that brings together music, visual art, and text,
      created by sound artists The Temple in collaboration with visual artist Zoë Bell and
      writer Una Cruickshank.</p>
      <p>Inspired by spiritual, philosophical, poetic and scientific texts, ATOMS searches for
      meaning in a world of microscopic particles, accompanied by live-rendered visuals, poetry,
      and immersive sonic tapestries.</p>
    `,
    videoSrc: 'https://www.youtube.com/embed/kFIzc-7WxVI?enablejsapi=1',
  },
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
];

export default projects;
