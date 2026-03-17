/**
 * data/music.js — Self-hosted albums and video performances for the Music section.
 * Items are rendered in array order.
 */

const music = [
  {
    type: 'album',
    id: 'vastness-vastness',
    title: 'Vastness Vastness',
    description: 'The debut release by The Temple — spiritual ambient music featuring Nathan Carter on drums and handpan, with Jack Woodbury producing.',
    cover: 'assets/audio/Vastness%20Vastness/Vastness%20Vastness%20cover.jpg',
    tracks: [
      { title: 'Vastness Vastness', file: 'assets/audio/Vastness%20Vastness/1_Vastness%20Vastness.mp3' },
      { title: 'Lullaby',           file: 'assets/audio/Vastness%20Vastness/2_Lullaby.mp3' },
    ],
  },
  {
    type: 'video',
    id: 'pattern-7',
    title: 'Pattern 7',
    meta: 'Live performance · Wellington Cathedral of St Paul, Feb 2022',
    videoSrc: 'https://www.youtube.com/embed/Un6ExdGocHA?enablejsapi=1',
  },
  {
    type: 'album',
    id: 'unfathomed-waters',
    title: 'Unfathomed Waters',
    description: 'A hallucinogenic dark ambient album written with Jack Woodbury, inspired by an H.P. Lovecraft short story about a sinking submarine.',
    cover: 'assets/audio/Unfathomed%20Waters/Unfathomed%20Waters%20Cover.jpg',
    tracks: [
      { title: 'There Came A Third Impression',                        file: 'assets/audio/Unfathomed%20Waters/01%20There%20Came%20A%20Third%20Impression.mp3' },
      { title: 'To The Surface',                                       file: 'assets/audio/Unfathomed%20Waters/02%20To%20The%20Surface.mp3' },
      { title: 'Tinkering With The Machinery',                         file: 'assets/audio/Unfathomed%20Waters/03%20Tinkering%20With%20The%20Machinery.mp3' },
      { title: 'Almost Without Plans',                                 file: 'assets/audio/Unfathomed%20Waters/04%20Almost%20Without%20Plans.mp3' },
      { title: 'Drifting South, Meanwhile Sinking Deeper And Deeper',  file: 'assets/audio/Unfathomed%20Waters/05%20Drifting%20South%2C%20Meanwhile%20Sinking%20Deeper%20And%20Deeper.mp3' },
      { title: 'The Coming Deprivation Of Light',                      file: 'assets/audio/Unfathomed%20Waters/06%20The%20Coming%20Deprivation%20Of%20Light.mp3' },
      { title: 'Enter The Temple',                                     file: 'assets/audio/Unfathomed%20Waters/07%20Enter%20The%20Temple.mp3' },
      { title: 'Unfathomed Waters (I & II)',                           file: 'assets/audio/Unfathomed%20Waters/08%20Unfathomed%20Waters%20(I%20%26%20II).mp3' },
    ],
  },
  {
    type: 'album',
    id: 'bostrom-scenario',
    title: 'The Bostrom Scenario',
    description: 'Soundtrack to a mind-bending sci-fi thriller noir by director Ricky Townsend, set and filmed in Christchurch, NZ.',
    cover: 'assets/audio/The%20Bostrom%20Scenario/Bostrom%20Scenario%20Album%20Cover.png',
    tracks: [
      { title: 'The Conspiracy',               file: 'assets/audio/The%20Bostrom%20Scenario/1_The_Conspiracy.mp3' },
      { title: 'The Warehouse',                file: 'assets/audio/The%20Bostrom%20Scenario/2_The_Warehouse.mp3' },
      { title: 'Astral Projection',            file: 'assets/audio/The%20Bostrom%20Scenario/3_Astral_Projection.mp3' },
      { title: 'Accomplice to a Traitor',      file: 'assets/audio/The%20Bostrom%20Scenario/4_Accomplice_to_a_Traitor.mp3' },
      { title: 'The House',                    file: 'assets/audio/The%20Bostrom%20Scenario/5_The_House.mp3' },
      { title: 'Malthouse Costumes',           file: 'assets/audio/The%20Bostrom%20Scenario/6_Malthouse_Costumes.mp3' },
      { title: 'Childhood Stories',            file: 'assets/audio/The%20Bostrom%20Scenario/7_Childhood_Stories.mp3' },
      { title: 'Shootout',                     file: 'assets/audio/The%20Bostrom%20Scenario/8_Shootout.mp3' },
      { title: 'The Camera',                   file: 'assets/audio/The%20Bostrom%20Scenario/9_The_Camera.mp3' },
      { title: 'Artificial Intelligence',      file: 'assets/audio/The%20Bostrom%20Scenario/10_Artificial_intelligence.mp3' },
      { title: 'I Will Always Remember You',   file: 'assets/audio/The%20Bostrom%20Scenario/11_I_Will_Always_Remember_You.mp3' },
      { title: 'I Want You to Imagine a Fish', file: 'assets/audio/The%20Bostrom%20Scenario/12_I_Want_You_to_Imagine_a_Fish.mp3' },
    ],
  },
];

export default music;
