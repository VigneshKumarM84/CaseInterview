/* The guided warm-up: a 7–10 minute campus case for someone who has never done a case interview.
   Four steps (one clarifying question, one useful number, one calculation, a 30-second recommendation).
   After each answer the student sees an example and why it helps. Data only, so Node tests load it directly.
   All figures are fictional and internally consistent: tests/warmup.test.cjs checks the arithmetic. */
(function (root) {
  const FEST = {
    lastYear: { tickets: 1800, price: 500, costs: 600000 },
    thisYear: { earlyTickets: 1800, earlyPrice: 300, fullTickets: 600, fullPrice: 500, costs: 600000 }
  };

  const WARMUP = {
    id: 'warmup',
    title: 'More tickets, less money',
    minutes: '7–10',
    setting: 'Your college cultural fest',
    brief: 'Your college’s two-day cultural fest sold 2,400 tickets this year, up from 1,800 last year. The organising committee expected a bigger surplus. Instead, it made less money. The committee head asks you: what happened, and what should we do next year?',
    fest: FEST,
    steps: [
      {
        id: 'clarify', label: 'Clarify', maps: 'Frame', kind: 'text',
        prompt: 'Before you analyse anything, ask the committee head one question that makes sure you understand the problem.',
        hint: 'Good clarifying questions pin down what is being measured, what it is compared with, or what the committee wants.',
        placeholder: 'Type the one question you would ask…',
        example: 'When you say the fest made less money, do you mean ticket revenue or the surplus left after costs? And is that compared with last year’s fest?',
        why: 'Revenue and surplus point to different causes. Pinning down the measure and the comparison stops you solving the wrong problem, and it takes ten seconds.',
        alsoGood: [
          'Did anything change in how the fest was run this year: venue, dates or ticket prices?',
          'Are sponsorship and stall income included, or only tickets?'
        ],
        reply: 'Good question. We mean the surplus after costs: ₹3.0 lakh last year and ₹2.4 lakh this year. Costs were the same both years, about ₹6 lakh. Sponsorship was also about the same, so leave it out.',
        fact: 'The problem is the surplus after costs: ₹3.0 lakh last year, ₹2.4 lakh this year. Costs were about ₹6 lakh both years, and sponsorship was about the same.'
      },
      {
        id: 'number', label: 'One useful number', maps: 'Investigate', kind: 'text',
        prompt: 'Costs did not change, so ticket revenue fell even though 600 more people came. Which one number would you ask for next, and why?',
        hint: 'Revenue = tickets × price. Tickets went up, so look at the other half of that formula.',
        placeholder: 'I would ask for… because…',
        example: 'The average price paid per ticket this year, compared with last year. Revenue is tickets times price; tickets rose, so if revenue fell, the price people actually paid must have dropped.',
        why: 'It tests a specific explanation with a single number, instead of asking for “all the data”. Naming why you want it shows the interviewer your reasoning.',
        alsoGood: ['How many tickets were sold at each price this year.'],
        reply: 'Last year every ticket cost ₹500. This year an early-bird price of ₹300 ran until a week before the fest: 1,800 tickets sold at ₹300 and 600 at the full ₹500.'
      },
      {
        id: 'calc', label: 'One calculation', maps: 'Quantify', kind: 'number',
        prompt: 'What was the average price paid per ticket this year? Use the numbers the committee head just gave you.',
        hint: 'Work out the total ticket revenue first, then divide by the number of tickets.',
        placeholder: 'e.g. 275',
        unit: '₹ per ticket',
        answer: 350, tolerance: 1,
        working: [
          'Early-bird: 1,800 × ₹300 = ₹5,40,000',
          'Full price: 600 × ₹500 = ₹3,00,000',
          'Revenue: ₹5,40,000 + ₹3,00,000 = ₹8,40,000, down from ₹9,00,000 last year',
          'Average price: ₹8,40,000 ÷ 2,400 tickets = ₹350, down from ₹500'
        ],
        example: '₹350 per ticket. The average price fell 30% while tickets rose 33%, and three in four tickets sold at the discount, so revenue fell by ₹60,000. With costs flat, that is exactly why the surplus fell from ₹3.0 lakh to ₹2.4 lakh.',
        why: 'One calculation turns a hunch (“the discount was too generous”) into a fact you can say in one sentence, and it accounts for the whole drop in the surplus.',
        mistakes: [
          { value: 400, message: '₹400 is the simple average of ₹300 and ₹500. Three in four tickets sold at ₹300, so the average has to be weighted towards it.' },
          { value: 840000, message: 'That is total revenue. Divide it by the 2,400 tickets to get the price per ticket.' },
          { value: 8.4, message: 'That looks like total revenue in lakh. Divide ₹8,40,000 by the 2,400 tickets to get the price per ticket.' }
        ]
      },
      {
        id: 'recommend', label: '30-second recommendation', maps: 'Recommend', kind: 'text', seconds: 30,
        prompt: 'The committee head has 30 seconds. What should the fest do next year? Say it out loud if you can, then type the gist.',
        hint: 'Start with your answer, give the one number that supports it, say what to do, and name what could make you wrong.',
        placeholder: 'Next year, the fest should…',
        example: 'Keep an early-bird price, but limit it to the first 600 tickets. This year three in four tickets sold at ₹300, so the average price fell from ₹500 to ₹350 and the surplus fell by ₹60,000 even though 600 more people came. Before fixing the numbers, I would ask this year’s early-bird buyers whether they would have paid ₹500, because if most would not have come, the discount brought in people we wanted.',
        why: 'It starts with the answer, backs it with the one number that matters, gives the committee something it can do, and names the risk. Every recommendation in the full cases has this shape.',
        selfCheck: ['Started with the answer, not the analysis', 'Used at least one number', 'Said what to do next year', 'Named a risk or what to check first']
      }
    ],
    // How the warm-up maps onto a full case.
    fullCase: { id: 'cement', adds: 'A full case adds a choice between two paths, new evidence partway through and an implementation plan, over about 40 minutes.' }
  };

  /** Reads a typed answer such as "₹350", "Rs. 350/-" or "8,40,000 / 2,400 = 350": the last number in the text. */
  function parseAmount(text) {
    const nums = String(text ?? '').replace(/(\d),(?=\d)/g, '$1').match(/\d+(?:\.\d+)?/g);
    return nums ? Number(nums[nums.length - 1]) : null;
  }
  /** Judges the calculation: correct, a known mistake with its own explanation, or simply wrong. */
  function judge(step, text) {
    const value = parseAmount(text);
    if (value == null) return { status: 'empty', value };
    if (Math.abs(value - step.answer) <= step.tolerance) return { status: 'correct', value };
    const known = (step.mistakes || []).find(m => Math.abs(value - m.value) <= Math.max(step.tolerance, Math.abs(m.value) * 0.001));
    return { status: 'wrong', value, message: known ? known.message : 'Not quite. Compare your working with the steps below.' };
  }

  const api = { WARMUP, parseAmount, judge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Warmup = api;
})(this);
