/* Case Room spoken English practice: original sentences, questions and topics written for Case Room, in the
   style of the spoken-English sections some employers use in campus hiring. Not taken from any test or prep site.
   Sentences avoid digits, so what the browser hears can be compared word for word. Edit the practice here. */
(function (root) {
  /* Read aloud: the sentence is on screen. Grouped short → long by level. */
  const READ = [
    { id: 'read-01', level: 1, text: 'The library stays open until nine on weekdays.' },
    { id: 'read-02', level: 1, text: 'Please submit your form at the front desk before lunch.' },
    { id: 'read-03', level: 1, text: 'Our team meets every Monday to plan the week ahead.' },
    { id: 'read-04', level: 1, text: 'She took the early train to reach the interview on time.' },
    { id: 'read-05', level: 1, text: 'The canteen now serves breakfast from half past seven.' },
    { id: 'read-06', level: 1, text: 'He kept a notebook of every new word he learned.' },
    { id: 'read-07', level: 2, text: 'Before the presentation, the students checked that every slide matched the script they had practised.' },
    { id: 'read-08', level: 2, text: 'The company opened a small office in Coimbatore to work more closely with its customers in the south.' },
    { id: 'read-09', level: 2, text: 'Although the road was crowded, the delivery van reached the warehouse well before the deadline.' },
    { id: 'read-10', level: 2, text: 'Many first-year students find that a fixed study routine makes the semester far less stressful.' },
    { id: 'read-11', level: 2, text: 'The manager thanked the volunteers for staying late to finish packing the relief supplies.' },
    { id: 'read-12', level: 2, text: 'Customers who return their old phones receive a discount on a new model from the same store.' },
    { id: 'read-13', level: 3, text: 'Engineers at the plant noticed that most breakdowns happened on the night shift, when fewer experienced technicians were available.' },
    { id: 'read-14', level: 3, text: 'The survey suggested that people valued reliable service more than low prices, which surprised the marketing team considerably.' },
    { id: 'read-15', level: 3, text: 'By moving the weekly review to Thursday afternoon, the department gave itself a full day to fix problems before the weekend.' },
    { id: 'read-16', level: 3, text: 'The committee agreed that the proposal was promising but asked for a clearer estimate of the costs in the first year.' },
    { id: 'read-17', level: 3, text: 'Responding to complaints within an hour, rather than a day, turned several unhappy customers into loyal ones.' },
    { id: 'read-18', level: 3, text: 'Rural internet access has improved quickly, yet many families still share a single phone among several children.' }
  ];

  /* Repeat: the sentence is played aloud and hidden; the student says it back. */
  const REPEAT = [
    { id: 'rep-01', level: 1, text: 'Please close the door behind you.' },
    { id: 'rep-02', level: 1, text: 'The meeting has moved to the second floor.' },
    { id: 'rep-03', level: 1, text: 'I will call you back after lunch.' },
    { id: 'rep-04', level: 1, text: 'Our bus leaves from the main gate.' },
    { id: 'rep-05', level: 1, text: 'Could you send me the file again?' },
    { id: 'rep-06', level: 1, text: 'The results will be posted online tomorrow.' },
    { id: 'rep-07', level: 2, text: 'Remember to carry your identity card to the test centre.' },
    { id: 'rep-08', level: 2, text: 'The printer on this floor is out of paper again.' },
    { id: 'rep-09', level: 2, text: 'Most of the orders were delivered before the festival began.' },
    { id: 'rep-10', level: 2, text: 'She asked whether the training would be held in person.' },
    { id: 'rep-11', level: 2, text: 'We need one more volunteer for the morning shift.' },
    { id: 'rep-12', level: 2, text: 'The new policy applies to everyone who joined this year.' },
    { id: 'rep-13', level: 3, text: 'If the client agrees, we can start the project early next month.' },
    { id: 'rep-14', level: 3, text: 'The interview panel will include someone from the finance team.' },
    { id: 'rep-15', level: 3, text: 'Applicants who miss the deadline will have to wait for the next round.' },
    { id: 'rep-16', level: 3, text: 'He suggested that we compare the two suppliers before signing anything.' },
    { id: 'rep-17', level: 3, text: 'The hostel warden reminded everyone that the gates close at ten.' },
    { id: 'rep-18', level: 3, text: 'Because of the rain, the outdoor event was shifted to the auditorium.' }
  ];

  /* Quick answers: a short question, answered in a word or two. `answers` lists accepted words or phrases. */
  const QUICK = [
    { id: 'q-01', prompt: 'What do you call the first meal of the day?', answers: ['breakfast'] },
    { id: 'q-02', prompt: 'If today is Monday, what day was yesterday?', answers: ['sunday'] },
    { id: 'q-03', prompt: 'Which is bigger, a lake or an ocean?', answers: ['ocean', 'an ocean'] },
    { id: 'q-04', prompt: 'What do people use to dry themselves after a bath?', answers: ['towel', 'a towel', 'towels'] },
    { id: 'q-05', prompt: 'Where would you go to borrow a book?', answers: ['library', 'a library', 'the library'] },
    { id: 'q-06', prompt: 'What do you call a person who flies an aeroplane?', answers: ['pilot', 'a pilot'] },
    { id: 'q-07', prompt: 'How many hours are there in a day?', answers: ['twenty four', 'twenty-four', '24'] },
    { id: 'q-08', prompt: 'What is the opposite of early?', answers: ['late'] },
    { id: 'q-09', prompt: 'What do we call water when it freezes?', answers: ['ice'] },
    { id: 'q-10', prompt: 'Which do you wear on your feet, gloves or socks?', answers: ['socks', 'sock'] },
    { id: 'q-11', prompt: 'What would you use to cut a sheet of paper?', answers: ['scissors', 'scissor', 'a pair of scissors', 'a knife', 'knife', 'blade', 'a blade', 'cutter', 'a cutter'] },
    { id: 'q-12', prompt: 'A meeting starts at ten and lasts one hour. When does it end?', answers: ['eleven', '11'] },
    { id: 'q-13', prompt: 'Is a kilometre longer or shorter than a metre?', answers: ['longer'] },
    { id: 'q-14', prompt: 'What is the plural of child?', answers: ['children'] },
    { id: 'q-15', prompt: 'What do you call the money you pay to ride a bus?', answers: ['fare', 'bus fare', 'ticket', 'ticket price'] },
    { id: 'q-16', prompt: 'Which month comes after June?', answers: ['july'] },
    { id: 'q-17', prompt: 'What do you call a doctor who treats teeth?', answers: ['dentist', 'a dentist'] },
    { id: 'q-18', prompt: 'If you are not hungry, you are probably what?', answers: ['full', 'not hungry', 'satisfied'] }
  ];

  /* Just a minute: think for 15 seconds, then speak for 60. */
  const JAM = [
    { id: 'jam-01', topic: 'A skill you taught yourself' },
    { id: 'jam-02', topic: 'The best advice you have been given' },
    { id: 'jam-03', topic: 'Should attendance in college be compulsory?' },
    { id: 'jam-04', topic: 'Your favourite place in your home town' },
    { id: 'jam-05', topic: 'Online classes or classroom classes: which works better?' },
    { id: 'jam-06', topic: 'One problem in your city you would fix first' },
    { id: 'jam-07', topic: 'Why teamwork matters in a first job' },
    { id: 'jam-08', topic: 'A book, film or show that changed your mind about something' },
    { id: 'jam-09', topic: 'Is social media good for students?' },
    { id: 'jam-10', topic: 'What makes a good team leader' },
    { id: 'jam-11', topic: 'A festival you enjoy, and why' },
    { id: 'jam-12', topic: 'Should every graduate learn some programming?' },
    { id: 'jam-13', topic: 'The most useful app on your phone' },
    { id: 'jam-14', topic: 'What you would do with a free year' },
    { id: 'jam-15', topic: 'Cash or digital payments?' },
    { id: 'jam-16', topic: 'A person you admire, and why' },
    { id: 'jam-17', topic: 'How students can spend less time on their phones' },
    { id: 'jam-18', topic: 'A big company or a startup for your first job?' },
    { id: 'jam-19', topic: 'Your plan for the next two years' },
    { id: 'jam-20', topic: 'One thing your college could do better' }
  ];

  const api = { READ, REPEAT, QUICK, JAM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ENGLISH_PRACTICE = api;
})(this);
