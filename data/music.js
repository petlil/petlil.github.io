/**
 * data/music.js — Self-hosted albums and video performances for the Music section.
 */

export const videos = [
  {
    id: 'pattern-7',
    title: 'Pattern 7',
    meta: 'Live performance · Wellington Cathedral of St Paul, Feb 2022',
    videoSrc: 'https://www.youtube.com/embed/Un6ExdGocHA?enablejsapi=1',
  },
];

const albums = [
  {
    id: 'vastness-vastness',
    title: 'Vastness Vastness',
    description: 'A collection of works for voice and electronics.',
    cover: 'assets/audio/Vastness%20Vastness/Vastness%20Vastness%20cover.webp',
    tracks: [
      { title: 'Vastness Vastness', file: 'assets/audio/Vastness%20Vastness/1_Vastness%20Vastness.m4a' },
      { title: 'Lullaby',           file: 'assets/audio/Vastness%20Vastness/2_Lullaby.m4a' },
    ],
  },
  {
    id: 'unfathomed-waters',
    title: 'Unfathomed Waters',
    description: 'A collaborative album with Jack Woodbury.',
    cover: 'assets/audio/Unfathomed%20Waters/Unfathomed%20Waters%20Cover.webp',
    tracks: [
      { title: 'There Came A Third Impression',                        file: 'assets/audio/Unfathomed%20Waters/01%20There%20Came%20A%20Third%20Impression.m4a' },
      { title: 'To The Surface',                                       file: 'assets/audio/Unfathomed%20Waters/02%20To%20The%20Surface.m4a' },
      { title: 'Tinkering With The Machinery',                         file: 'assets/audio/Unfathomed%20Waters/03%20Tinkering%20With%20The%20Machinery.m4a' },
      { title: 'Almost Without Plans',                                 file: 'assets/audio/Unfathomed%20Waters/04%20Almost%20Without%20Plans.m4a' },
      { title: 'Drifting South, Meanwhile Sinking Deeper And Deeper',  file: 'assets/audio/Unfathomed%20Waters/05%20Drifting%20South%2C%20Meanwhile%20Sinking%20Deeper%20And%20Deeper.m4a' },
      { title: 'The Coming Deprivation Of Light',                      file: 'assets/audio/Unfathomed%20Waters/06%20The%20Coming%20Deprivation%20Of%20Light.m4a' },
      { title: 'Enter The Temple',                                     file: 'assets/audio/Unfathomed%20Waters/07%20Enter%20The%20Temple.m4a' },
      { title: 'Unfathomed Waters (I & II)',                           file: 'assets/audio/Unfathomed%20Waters/08%20Unfathomed%20Waters%20(I%20%26%20II).m4a' },
    ],
  },
  {
    id: 'bostrom-scenario',
    title: 'The Bostrom Scenario',
    description: 'Original motion picture soundtrack.',
    cover: 'assets/audio/The%20Bostrom%20Scenario/Bostrom%20Scenario%20Album%20Cover.webp',
    tracks: [
      { title: 'The Conspiracy',               file: 'assets/audio/The%20Bostrom%20Scenario/1_The_Conspiracy.m4a' },
      { title: 'The Warehouse',                file: 'assets/audio/The%20Bostrom%20Scenario/2_The_Warehouse.m4a' },
      { title: 'Astral Projection',            file: 'assets/audio/The%20Bostrom%20Scenario/3_Astral_Projection.m4a' },
      { title: 'Accomplice to a Traitor',      file: 'assets/audio/The%20Bostrom%20Scenario/4_Accomplice_to_a_Traitor.m4a' },
      { title: 'The House',                    file: 'assets/audio/The%20Bostrom%20Scenario/5_The_House.m4a' },
      { title: 'Malthouse Costumes',           file: 'assets/audio/The%20Bostrom%20Scenario/6_Malthouse_Costumes.m4a' },
      { title: 'Childhood Stories',            file: 'assets/audio/The%20Bostrom%20Scenario/7_Childhood_Stories.m4a' },
      { title: 'Shootout',                     file: 'assets/audio/The%20Bostrom%20Scenario/8_Shootout.m4a' },
      { title: 'The Camera',                   file: 'assets/audio/The%20Bostrom%20Scenario/9_The_Camera.m4a' },
      { title: 'Artificial Intelligence',      file: 'assets/audio/The%20Bostrom%20Scenario/10_Artificial_intelligence.m4a' },
      { title: 'I Will Always Remember You',   file: 'assets/audio/The%20Bostrom%20Scenario/11_I_Will_Always_Remember_You.m4a' },
      { title: 'I Want You to Imagine a Fish', file: 'assets/audio/The%20Bostrom%20Scenario/12_I_Want_You_to_Imagine_a_Fish.m4a' },
    ],
  },
];

export default albums;
