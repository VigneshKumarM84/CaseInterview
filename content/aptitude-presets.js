/* Generic timed-test presets for placement aptitude practice. Each one fills the timed-test settings with values
   from the options the test already offers (equal section sizes, fixed paces), so every preset is an approximation.
   Company names are examples of tests that public prep sites describe in roughly this shape. Companies do not publish
   these patterns in full and change them, so they are not claims about any company's current test. Checked against
   free prep-site write-ups in November 2026; students should follow their own drive notice. */
(function (root) {
  'use strict';
  const PRESETS = [
    {
      id: 'standard', title: 'Standard placement test',
      shape: 'Quant, logical and verbal · 20 each · 1 minute per question · separate timer per section · no negative marking',
      examples: 'TCS NQT (Foundation part), Cognizant GenC aptitude, Wipro Elite NLTH aptitude',
      settings: { sections: ['quant', 'logical', 'verbal'], perSection: 20, testLevel: 'mixed', pace: 60, timing: 'sectional', negative: 0 }
    },
    {
      id: 'quick', title: 'Short screening round',
      shape: 'Quant, logical and verbal · 10 each · 36 seconds per question · one timer · no negative marking',
      examples: 'Short first-round cognitive tests, such as those reported for Accenture and other mass recruiters',
      settings: { sections: ['quant', 'logical', 'verbal'], perSection: 10, testLevel: 'mixed', pace: 36, timing: 'total', negative: 0 }
    },
    {
      id: 'advanced', title: 'Higher-package track',
      shape: 'Quant and logical · 10 each · 2 minutes per question · Hard to Expert questions · one timer',
      examples: 'TCS NQT Advanced aptitude, Infosys DSE and Specialist Programmer tracks',
      settings: { sections: ['quant', 'logical'], perSection: 10, testLevel: 'mixed-high', pace: 120, timing: 'total', negative: 0 }
    },
    {
      id: 'negative', title: 'Competitive-exam style',
      shape: 'Quant, logical and verbal · 20 each · 1 minute per question · one timer · −0.25 per wrong answer',
      examples: 'Bank and government recruitment prelims, MBA entrance mock sections',
      settings: { sections: ['quant', 'logical', 'verbal'], perSection: 20, testLevel: 'mixed', pace: 60, timing: 'total', negative: 0.25 }
    }
  ];
  const NOTE = 'Approximate. Real tests change by year and campus, and many include parts this practice does not cover, such as coding, pseudocode, essays or game-based tests. Spoken English has its own practice page. Follow your drive notice.';
  const api = { PRESETS, NOTE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.APTITUDE_PRESETS = api;
})(this);
