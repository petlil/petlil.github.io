/**
 * data/music.js — Music portfolio data.
 *
 * Fields:
 *   id          — unique identifier
 *   title       — display title
 *   meta        — subtitle / context line (HTML allowed)
 *   description — optional body text (HTML allowed)
 *   embedSrc    — Bandcamp / RNZ iframe src
 *   embedHeight — iframe height in px
 */

const music = [
  {
    id: 'enter-the-temple',
    title: 'Enter the Temple',
    meta: 'Featured track · from <em>Unfathomed Waters</em>',
    embedSrc: 'https://bandcamp.com/EmbeddedPlayer/album=3067107200/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/track=3283538834/transparent=true/',
    embedHeight: 120,
  },
  {
    id: 'deux-images',
    title: 'Deux Images',
    meta: 'Trio Élan — Donald Armstrong (violin), Simon Brew (saxophone) &amp; Sarah Watkins (piano)',
    description: 'i. Small Scurrying<br>ii. Glimpse',
    embedSrc: 'https://www.rnz.co.nz/audio/remote-player?id=2018876699',
    embedHeight: 60,
  },
  {
    id: 'unfathomed-waters',
    title: 'Unfathomed Waters',
    meta: 'Full album · Jack Woodbury &amp; Peter Liley',
    description: `
      <p>A collection of collaborative works.</p>
      <p><em>"This quasi-ambient collection of calming stasis and passages of unease is where crackling
      sonic glitches and discordant sounds disrupt the glacial beauty on some of these eight
      instrumentals inspired by H.P. Lovecraft's 1920s aquatic, submarine mystery story The Temple."</em></p>
      <p>— Graham Reid, <a href="https://www.elsewhere.co.nz/further/10408/motte-rotor-liley-and-woodbury-2022-exploring-the-dark-waters-beneath/" target="_blank" rel="noopener">Elsewhere.co.nz</a></p>
    `,
    embedSrc: 'https://bandcamp.com/EmbeddedPlayer/album=3067107200/size=large/bgcol=333333/linkcol=e32c14/artwork=small/transparent=true/',
    embedHeight: 406,
  },
  {
    id: 'fragments-1',
    title: 'Fragments 1',
    meta: 'Live experimental set · Jack Woodbury &amp; Peter Liley',
    embedSrc: 'https://bandcamp.com/EmbeddedPlayer/album=4175934274/size=large/bgcol=333333/linkcol=e32c14/tracklist=false/artwork=small/transparent=true/',
    embedHeight: 120,
  },
];

export default music;
