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
      <p>Peter is the Music Director of the Wellington Music Centre, a low-cost community music education programme for kids ages 5-12 based in Miramar.
      The WMC programme, which has been running for over 40 years, offers tuition in 12 different musical instruments, plus choirs, ensembles, music theory classes, and pre-instrumental classes for younger kids.</p>
      <p><i>"The diverse and thriving community at Wellington Music Centre is a testament to the gathering power of music, especially when kids and their creativity are kept at the centre, and when decisions are made in trusted partnership with the team and community."</i></p>
      <p>Peter's leadership is shaped by a deep interest in music pedagogy, grassroots community building, data analysis, well-structured digital systems, and the creation of
      accessible pathways for students through their musical development. He is committed to pursuing
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
