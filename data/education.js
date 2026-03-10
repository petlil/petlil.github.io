/**
 * data/education.js — Teaching & education content.
 *
 * Fields:
 *   id          — unique identifier
 *   title       — display title
 *   meta        — subtitle / context (HTML allowed)
 *   description — body text (HTML allowed)
 *   image       — optional hero image path
 *   photo       — optional full-width bottom photo (rendered outside description, correct opacity)
 *   links       — optional array of { label, href } for external links
 */

const education = [
  {
    id: 'wellington-music-centre',
    title: 'Wellington Music Centre',
    meta: 'Music Director',
    image: 'assets/images/education/wmc_graphic.png',
    description: `
      <p>As Music Director of Wellington Music Centre, Peter leads one of Wellington's
      most active community music organisations, overseeing programmes that provide
      ensemble and tuition opportunities for students across the region.</p>
      <p>His work is shaped by a deep interest in music pedagogy and the creation of
      clear, accessible pathways for students at every stage of their musical development —
      from early learners through to pre-professional study. Peter is committed to pursuing
      systemic improvements in music education, advocating for structures that better serve
      the full diversity of students and communities in Aotearoa.</p>
    `,
    photo: 'assets/images/education/wmc_teaching.jpg',
    links: [
      { label: 'wellingtonmusiccentre.org.nz', href: 'https://www.wellingtonmusiccentre.org.nz/' },
    ],
  },
];

export default education;
