/* The Stillmaker's gate (A, 2026-10-07: a feedback button "super cool and edgy ... maybe has the eyes of the stillmaker"): the
   screen drops to night, the Stillmaker's eyes open, watching; then light in the five element colours cracks through his dark
   and swallows them, and the feedback form rises out of the night. Giving feedback is helping beat him. About 1.6 s; a tap
   skips it; with reduced motion it goes straight there. Shared by the game's thank-you screen and the pitch bible. */
function stillGate(url, eyesSrc, onStart) {
  const go = () => { location.href = url; };
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) { go(); return; } } catch (e) {}
  if (document.getElementById('stillGate')) return;
  if (!document.getElementById('stillGateCss')) {
    const st = document.createElement('style'); st.id = 'stillGateCss';
    st.textContent = `#stillGate{position:fixed;inset:0;z-index:99999;background:#04061A;opacity:0;animation:sgIn .28s ease-out forwards;display:grid;place-items:center;overflow:hidden;cursor:pointer}
#stillGate .sg-eyes{width:min(92vw,620px);height:auto;clip-path:inset(50% 0 50% 0);position:relative;z-index:2;animation:sgOpen .38s cubic-bezier(.2,.8,.2,1) .32s forwards,sgBurn .45s ease-in 1.12s forwards;filter:drop-shadow(0 0 22px rgba(170,200,255,.35))}
#stillGate .sg-light{position:absolute;inset:-20%;background:conic-gradient(from -90deg,#4E9BE0 0 14%,#04061A 14% 20%,#6FBF4A 20% 34%,#04061A 34% 40%,#FF9A4A 40% 54%,#04061A 54% 60%,#E6B23A 60% 74%,#04061A 74% 80%,#E8EEF6 80% 94%,#04061A 94% 100%);clip-path:circle(0% at 50% 50%);opacity:.9;filter:blur(10px) saturate(1.25);-webkit-mask:radial-gradient(circle,#000 18%,transparent 72%);mask:radial-gradient(circle,#000 18%,transparent 72%);animation:sgCrack .65s cubic-bezier(.6,0,.3,1) 1s forwards}
#stillGate .sg-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(255,250,235,.9),rgba(255,250,235,0) 45%);opacity:0;animation:sgGlow .5s ease-in 1.15s forwards}
@keyframes sgIn{to{opacity:1}}
@keyframes sgOpen{to{clip-path:inset(0 0 0 0)}}
@keyframes sgCrack{from{transform:rotate(-20deg) scale(.6)}to{clip-path:circle(85% at 50% 50%);transform:rotate(18deg) scale(1.35)}}
@keyframes sgBurn{to{opacity:0;transform:scale(1.15);filter:brightness(3) drop-shadow(0 0 30px #fff)}}
@keyframes sgGlow{to{opacity:.85}}`;
    document.head.appendChild(st);
  }
  const el = document.createElement('div'); el.id = 'stillGate'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Opening the feedback form');
  el.innerHTML = `<img class="sg-eyes" src="${eyesSrc}" alt=""><div class="sg-light"></div><div class="sg-glow"></div>`;
  document.body.appendChild(el); if (onStart) try { onStart(); } catch (e) {}
  let done = false; const finish = () => { if (done) return; done = true; go(); };
  el.addEventListener('pointerdown', finish); setTimeout(finish, 1650);
}
