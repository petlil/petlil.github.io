/**
 * sections/index.js — Single source of truth for all portfolio sections.
 *
 * To rename, reorder, or add a section — edit this array only.
 * The slug, nav label, panel direction, and component class are all derived
 * from here at runtime; nothing else needs touching.
 *
 * Fields:
 *   slug      — URL hash key (#music, #education, …) and data-slug attribute
 *   label     — Display name in the navigation
 *   side      — Panel slide direction: 'left' | 'right'
 *   Component — Section class extending Component
 */

import { MusicSection }    from './Music.js';
import { ArtSection }      from './Art.js';
import { EducationSection } from './Education.js';
import { ProjectsSection } from './Projects.js';
import { ExtraSection }    from './Extra.js';

export const SECTIONS = [
  { slug: 'music',     label: 'Music',     side: 'right', Component: MusicSection     },
  { slug: 'art',       label: 'Art',       side: 'right', Component: ArtSection       },
  { slug: 'education', label: 'Education', side: 'right', Component: EducationSection },
  { slug: 'projects',  label: 'Projects',  side: 'right', Component: ProjectsSection  },
];
