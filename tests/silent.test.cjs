// Silent mode: one switch in the header stops every read-aloud, automatic or requested, and is remembered.
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./dom.cjs');
const spoken = f => f.w.__spoken || [];

test('silent mode stops the interviewer speaking on interview-conditions and defence screens', () => {
  const f = fixture(); try {
    assert.equal(f.$('silentToggle').getAttribute('aria-pressed'), 'false');
    f.$('silentToggle').click();
    assert.equal(f.$('silentToggle').getAttribute('aria-pressed'), 'true'); assert.match(f.$('silentToggle').textContent, /Silent/);
    assert.equal(JSON.parse(f.w.localStorage.getItem('cr-voice')).silent, true, 'remembered');
    f.run("Behavioural.open()"); f.$('app').querySelector('[name=bhStyle][value=interview]').click(); f.$('bhStart').click();
    assert(f.$('bhPrompt').textContent.length > 10, 'the question is still on screen');
    assert.equal(spoken(f).length, 0, 'the interviewer does not speak the question');
    assert.equal(f.$('speak').disabled, true, 'Listen is off while silent');
    f.$('speak').click(); assert.equal(spoken(f).length, 0);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('turning sound back on restores read-aloud, and the choice survives a reload', () => {
  const f = fixture({ storage: { 'cr-voice': '{"silent":true}' } }); try {
    assert.equal(f.$('silentToggle').getAttribute('aria-pressed'), 'true', 'loaded as silent');
    f.run("speak('hello')"); assert.equal(spoken(f).length, 0);
    f.$('silentToggle').click(); assert.equal(f.$('silentToggle').getAttribute('aria-pressed'), 'false');
    f.run("speak('hello')"); assert.deepEqual(spoken(f), ['hello']);
  } finally { f.dom.window.close(); }
});

test('the voice settings window has the same switch', () => {
  const f = fixture(); try {
    f.run("openVoiceSettings()"); const c = f.$('silentCheck'); c.checked = true; c.dispatchEvent(new f.w.Event('change'));
    assert.equal(f.$('silentToggle').getAttribute('aria-pressed'), 'true');
    f.run("speak('x')"); assert.equal(spoken(f).length, 0);
  } finally { f.dom.window.close(); }
});
