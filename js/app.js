/**
 * app.js — Entry point. Imports and initialises all sections and core systems.
 *
 * `flowField` is exported so other components can reference the shared
 * particle array (flowField.particles) or live params (flowField.params).
 */

import { Router }        from './core/Router.js';
import { EventBus }      from './core/EventBus.js';
import { FlowField }     from './sketches/FlowField.js';
import { AudioPlayer }   from './components/AudioPlayer.js';
import { FFTVisualiser } from './sketches/FFTVisualiser.js';

import { MusicSection }     from './sections/Music.js';
import { ArtSection }       from './sections/Art.js';
import { EducationSection } from './sections/Education.js';
import { ProjectsSection }  from './sections/Projects.js';

/** Shared instances — importable anywhere they're needed. */
export let flowField;
export let audioPlayer;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Background flow field
  flowField = new FlowField(document.querySelector('#bg'));

  // 2. Audio player (exposes .analyser for the visualiser)
  audioPlayer = new AudioPlayer(
    document.querySelector('#player'),
    'assets/audio/Mac thing demo.mp3'
  );
  audioPlayer.mount();

  // 3. FFT visualiser reads audioPlayer.analyser each frame
  new FFTVisualiser(document.querySelector('#visualiser'), audioPlayer);

  // 4. Section components
  new MusicSection(document.querySelector('#section-music')).mount();
  new ArtSection(document.querySelector('#section-art')).mount();
  new EducationSection(document.querySelector('#section-education')).mount();
  new ProjectsSection(document.querySelector('#section-projects')).mount();

  // 5. Router
  Router.init();
});
