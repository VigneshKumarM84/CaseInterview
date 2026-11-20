/* Loaded last, after every tool has registered its views. The hash links straight to a tool:
   #drill (maths drill), #peer (peer interview), #peer-screen (candidate screen), #peer-sheet/<case> (printable sheet),
   #behavioural (HR question practice), #behavioural-stories (story bank), #behavioural-sheet/<competency|all> (printable sheet), #aptitude (placement aptitude practice and timed tests), #aptitude/paper/<code> (open a shared aptitude paper), #aptitude/collect (rank result lines from a shared paper), #english (spoken English practice),
   #resume (résumé and job-description checker), #defence (résumé and project defence), #warmup (the guided 10-minute first case),
   #next-round (prepare for my next round: a short plan built from the tools above),
   #cases (the Case interview page: warm-up, maths drill, peer interview and the case library). */
(() => {
  const h = location.hash;
  if (h === '#drill') CaseDrill.open();
  else if (h === '#peer') PeerMock.open();
  else if (h === '#peer-screen') PeerMock.candidate();
  else if (h.startsWith('#peer-sheet/')) PeerMock.sheet(decodeURIComponent(h.slice(12)));
  else if (h === '#behavioural') Behavioural.open();
  else if (h === '#behavioural-stories') Behavioural.stories();
  else if (h.startsWith('#behavioural-sheet/')) Behavioural.sheet(decodeURIComponent(h.slice(19)));
  else if (h.startsWith('#aptitude/paper/')) Aptitude.openPaper((() => { try { return decodeURIComponent(h.slice(16)); } catch { return ''; } })());
  else if (h === '#aptitude/collect') Aptitude.collect();
  else if (h === '#aptitude') Aptitude.open();
  else if (h === '#english') EnglishTool.open();
  else if (h === '#resume') ResumeTool.open();
  else if (h === '#defence') DefenceTool.open();
  else if (h === '#warmup') WarmupTool.open();
  else if (h === '#next-round') NextRoundTool.open();
  else if (h === '#cases') casesPage();
  else home();
})();
