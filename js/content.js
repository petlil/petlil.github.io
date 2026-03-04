// ─── content.js ───────────────────────────────────────────────────────────────
// All portfolio content lives here. Edit this file to add/remove/update entries.

// ── Audio tracks ──────────────────────────────────────────────────────────────
// Add your MP3/OGG/WAV files to the audio/ folder and list them here.
// The playlist is shuffled on each page load.
const AUDIO_TRACKS = [
  { title: 'Accomplice to a Traiter (from The Bostrom Scenario)',      file: 'audio/M20_Accomplice_to_a_Traitor.mp3'      },
  { title: "Malthouse Costumes (from The Bostrom Scenario)",           file: 'audio/M45_Malthouse_Costumes.mp3'           }
];

// ── Portfolio content ─────────────────────────────────────────────────────────
const PORTFOLIO = {

  // ── Music ──────────────────────────────────────────────────────────────────
  music: [
    {
      title: 'Enter the Temple',
      featured: true,
      embed: `<iframe style="border:0;width:100%;height:120px;"
        src="https://bandcamp.com/EmbeddedPlayer/album=3067107200/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/track=3283538834/transparent=true/"
        seamless></iframe>`,
      description: 'From <em>Unfathomed Waters</em>',
    },
    {
      title: "Rodery's Great Plight",
      embed: `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
        src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1650379446&color=ff5500"></iframe>`,
      description: 'Chiptune / Avant-Folk song',
    },
    {
      title: 'Deux Images',
      embed: `<iframe width="100%" src="https://www.rnz.co.nz/audio/remote-player?id=2018876699"
        style="width:100%;border:0;height:60px;"></iframe>`,
      description: 'i. Small Scurrying &nbsp;&nbsp; ii. Glimpse',
      credit: 'Performed by Trio Élan: Donald Armstrong (violin), Simon Brew (saxophone) &amp; Sarah Watkins (piano)',
    },
    {
      title: 'Unfathomed Waters',
      embed: `<iframe style="border:0;width:100%;height:406px;"
        src="https://bandcamp.com/EmbeddedPlayer/album=3067107200/size=large/bgcol=333333/linkcol=e32c14/artwork=small/transparent=true/"
        seamless></iframe>`,
      description: 'A collection of collaborative works by Peter Liley and Jack Woodbury.',
      review: '&#8220;This quasi-ambient collection of calming stasis and passages of unease is where crackling sonic glitches and discordant sounds disrupt the glacial beauty on some of these eight instrumentals…&#8221;',
      reviewSource: '&#8212; Graham Reid, <a href="https://www.elsewhere.co.nz/further/10408/motte-rotor-liley-and-woodbury-2022-exploring-the-dark-waters-beneath/" target="_blank" rel="noopener">Elsewhere.co.nz</a>',
    },
    {
      title: 'Fragments 1',
      embed: `<iframe style="border:0;width:100%;height:120px;"
        src="https://bandcamp.com/EmbeddedPlayer/album=4175934274/size=large/bgcol=333333/linkcol=e32c14/tracklist=false/artwork=small/transparent=true/"
        seamless></iframe>`,
      description: 'Peter Liley and Jack Woodbury performing a live experimental set.',
    },
  ],

  // ── Artwork ────────────────────────────────────────────────────────────────
  // Each series opens a horizontal scrollable lightbox of full-size images.
  artwork: [
    {
      id: 'sine-lines',
      title: 'Sine Lines',
      thumbnail: 'images/sineLines. (6).png',
      images: [
        'images/sineLines/sineLines_1.jpg',
        'images/sineLines/sineLines_2.jpg',
        'images/sineLines/sineLines_3.png',
        'images/sineLines/sineLines_4.jpg',
        'images/sineLines/sineLines_5.png',
        'images/sineLines/sineLines_6.png',
      ],
    },
    {
      id: 'kingi',
      title: 'Kingi',
      thumbnail: 'images/kingi_cover.png',
      images: [
        'images/kingi/kingi_1.png',
        'images/kingi/kingi_2.png',
        'images/kingi/kingi_10.png',
        'images/kingi/kingi_3.png',
        'images/kingi/kingi_4.png',
        'images/kingi/kingi_5.png',
        'images/kingi/kingi_6.png',
        'images/kingi/kingi_11.png',
        'images/kingi/kingi_7.png',
        'images/kingi/kingi_9.png',
      ],
    },
    {
      id: 'tesselation',
      title: 'Tesselation',
      thumbnail: 'images/tesselation.png',
      images: [
        'images/tesselation/tesselation_1.png',
        'images/tesselation/tesselation_2.png',
        'images/tesselation/tesselation_3.png',
        'images/tesselation/tesselation_4.png',
      ],
    },
    {
      id: 'poem',
      title: 'Poem',
      thumbnail: 'images/poem.png',
      images: [
        'images/poem/poem_1.png',
        'images/poem/poem_2.png',
        'images/poem/poem_3.png',
        'images/poem/poem_4.png',
        'images/poem/poem_5.png',
      ],
    },
    {
      id: 'nebula',
      title: 'Nebula',
      thumbnail: 'images/nebula/nebula_1.jpg',
      images: [
        'images/nebula/nebula_1.jpg',
        'images/nebula/nebula_2.jpg',
        'images/nebula/nebula_4.jpg',
        'images/nebula/nebula_5.jpg',
        'images/nebula/nebula_6.jpg',
      ],
    },
    {
      id: 'other',
      title: 'Other Works',
      thumbnail: 'images/sdf_out_1.png',
      images: [
        'images/sdf_out_1.png',
        'images/sdf_out_2.png',
        'images/network.png',
        'images/5_wandering_joiners.gif',
        'images/grid (2).gif',
        'images/art_deco.gif',
        'images/ObscureWood.png',
      ],
    },
  ],

  // ── Performances ───────────────────────────────────────────────────────────
  performances: [
    {
      title: 'Pattern 7',
      embed: `<iframe width="100%" style="aspect-ratio:16/9;border:none;border-radius:4px;"
        src="https://www.youtube.com/embed/Un6ExdGocHA"
        title="Pattern 7"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowfullscreen></iframe>`,
      description: 'Recorded live at the Wellington Cathedral of St Paul.',
      date: 'February 2022',
    },
    {
      title: 'Patterns i, ii and iii',
      embed: `<iframe width="100%" style="aspect-ratio:16/9;border:none;border-radius:4px;"
        src="https://www.youtube.com/embed/_n0QaGwq3tA"
        title="Patterns i ii iii"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowfullscreen></iframe>`,
      description: 'i. Tumble &nbsp;&nbsp; ii. Ripple Arc &nbsp;&nbsp; iii. In Agony',
      credit: 'Recorded at the New Zealand School of Music Composition Competition 2019 — First place.',
    },
    {
      title: 'Deux Images',
      embed: `<iframe width="100%" style="aspect-ratio:16/9;border:none;border-radius:4px;"
        src="https://www.youtube.com/embed/7H52NkXAm9o"
        title="Deux Images"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowfullscreen></iframe>`,
      description: 'i. Small Scurrying &nbsp;&nbsp; ii. Glimpse',
      credit: 'Performers: Bella Anderson (flute), Liam Furey (piano)',
    },
  ],

  // ── Installations ──────────────────────────────────────────────────────────
  installations: [
    {
      title: 'Actuate Intimate',
      embed: `<iframe width="100%" style="aspect-ratio:16/9;border:none;border-radius:4px;"
        src="https://www.youtube.com/embed/QTOwUwxtvXc"
        title="Actuate Intimate"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowfullscreen></iframe>`,
      description: '<em>Actuate Intimate</em> is an interactive work that allows the listener to explore the relationship between shape, material and sound in an exaggerated, detailed, and intimate way.',
      year: 'Created 2020 — reflecting the increased intimacy with household objects experienced during lockdowns.',
    },
  ],
};
