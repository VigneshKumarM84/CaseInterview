/* Loaded last, after every tool has registered its views. The hash links straight to a tool:
   #drill (maths drill), #peer (peer interview), #peer-screen (candidate screen), #peer-sheet/<case> (printable sheet),
   #behavioural (HR question practice), #behavioural-stories (story bank), #behavioural-sheet/<competency|all> (printable sheet), #aptitude (placement aptitude practice and timed tests). */
(() => {
  const h = location.hash;
  if (h === '#drill') CaseDrill.open();
  else if (h === '#peer') PeerMock.open();
  else if (h === '#peer-screen') PeerMock.candidate();
  else if (h.startsWith('#peer-sheet/')) PeerMock.sheet(decodeURIComponent(h.slice(12)));
  else if (h === '#behavioural') Behavioural.open();
  else if (h === '#behavioural-stories') Behavioural.stories();
  else if (h.startsWith('#behavioural-sheet/')) Behavioural.sheet(decodeURIComponent(h.slice(19)));
  else if (h === '#aptitude') Aptitude.open();
  else home();
})();
