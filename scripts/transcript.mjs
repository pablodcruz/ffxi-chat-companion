const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function renderTranscript(messages) {
  const lines = messages.map(({ speaker, text }, i) => `
    <li class="${speaker === "Kupobot" ? "bot" : "viewer"}">
      <p class="speaker"><span aria-hidden="true">${String(i + 1).padStart(2, "0")} / </span><strong>${escapeHtml(speaker)}</strong></p>
      <p class="message">${escapeHtml(text)}</p>
    </li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Campfire Transcript | Kupobot</title>
<style>
  :root{color-scheme:dark;--paper:#151d19;--line:#4f5950;--ink:#f2e9d7;--muted:#bebaaa;--mint:#b9e1c0;--ember:#ffd496}
  *{box-sizing:border-box}
  body{margin:0;background:#101612;color:var(--ink);font:16px/1.55 system-ui,sans-serif}
  main{width:min(45rem,calc(100% - 28px));margin:clamp(25px,6vw,78px) auto;border-top:2px solid var(--ember)}
  header{padding:20px 0 18px} h1{font:normal clamp(36px,9vw,66px)/1 Georgia,serif;margin:10px 0}
  p{margin:0} .deck{max-width:58ch;color:var(--muted)}
  .note,.speaker,.meta{font:12px/1.5 ui-monospace,Consolas,monospace;letter-spacing:.06em}
  .note{color:var(--ember);text-transform:uppercase}
  .controls{display:flex;flex-wrap:wrap;gap:8px;padding:12px 0;border-top:1px solid var(--line)}
  .controls[hidden]{display:none}
  button{min-height:44px;padding:7px 12px;color:var(--ink);background:#242e27;border:1px solid #889489;border-radius:4px;font:inherit;font-weight:700}
  button:not(:disabled){cursor:pointer} button:first-child:not(:disabled){color:#1f231c;background:var(--ember);border-color:var(--ember)}
  button[aria-pressed="true"]{color:var(--mint);border-color:var(--mint);background:#1b3326}
  button:disabled{color:#b6b8af;border-color:#59645c} button:focus-visible,.tape:focus-visible{outline:3px solid var(--ember);outline-offset:2px}
  .meta{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between;padding:4px 0 12px;color:var(--muted)}
  #state{color:var(--mint);font-weight:700}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .tape{max-height:48vh;overflow:auto;overscroll-behavior:contain;border-block:1px solid var(--line);background:var(--paper)}
  ol{margin:0;padding:0 14px;list-style:none} li{padding:13px 12px;margin:0 0 0 0}
  li + li{border-top:1px solid #3a463e} li[hidden]{display:none}
  .speaker{margin-bottom:4px;color:var(--ember)} .bot .speaker{color:var(--mint)}
  .bot{margin-left:24px;border-left:2px solid #6b997a;background:#1b2921}
  .message{overflow-wrap:anywhere}
  footer{padding:12px 0;color:var(--muted);font-size:13px}
  @media(max-width:420px){.bot{margin-left:13px}.tape{max-height:46vh}li{padding:11px 8px}}
</style>
</head>
<body>
<main>
  <header>
    <p class="note">Mog Research / offline tape</p>
    <h1>Campfire Transcript</h1>
    <p class="deck">A scripted exchange with Kupobot. Follow one message at a time or play the tape. Nothing is sent to a stream.</p>
  </header>
  <div class="controls" id="controls" role="group" aria-label="Transcript playback" hidden>
    <button id="next" type="button">Next message</button>
    <button id="play" type="button">Play chat</button>
    <button id="restart" type="button">Restart</button>
    <button id="follow" type="button" aria-pressed="true" aria-controls="tape">Follow new messages</button>
  </div>
  <p class="meta"><span id="state" role="status">Recorded example</span><span id="progress"></span></p>
  <p class="sr-only" id="announcement" aria-live="polite"></p>
  <section class="tape" id="tape" aria-label="Synthetic chat transcript" tabindex="0">
    <ol role="list">${lines}</ol>
  </section>
  <footer>Sample status and questions only. AI is offline here. During playback, Escape pauses between messages.</footer>
</main>
<script>
  const tape=document.getElementById("tape");
  const lines=[...tape.querySelectorAll("li")];
  const next=document.getElementById("next");
  const play=document.getElementById("play");
  const restart=document.getElementById("restart");
  const follow=document.getElementById("follow");
  const state=document.getElementById("state");
  const progress=document.getElementById("progress");
  const announcement=document.getElementById("announcement");
  let shown=0, mode="Ready", timer=null, following=true;

  function followLatest() {
    tape.scrollTop=tape.scrollHeight;
  }

  follow.addEventListener("click",() => {
    following=!following;
    follow.setAttribute("aria-pressed",String(following));
    if (following) followLatest();
  });

  function update() {
    if (state.textContent!==mode) state.textContent=mode;
    progress.textContent=shown+" / "+lines.length+" messages";
    next.disabled=mode==="Playing"||shown>=lines.length;
    play.disabled=shown>=lines.length;
    play.textContent=mode==="Playing"?"Pause chat":"Play chat";
  }

  function halt(label) {
    if (timer!==null) clearTimeout(timer);
    timer=null;
    mode=label;
    update();
  }

  function reveal() {
    if (shown>=lines.length) return;
    const line=lines[shown++];
    line.hidden=false;
    announcement.textContent=line.querySelector(".speaker strong").textContent
      +": "+line.querySelector(".message").textContent;
    if (following) followLatest();
    if (shown>=lines.length) {
      const focusOnPlayback=[play,next].includes(document.activeElement);
      halt("End of tape");
      if (focusOnPlayback) restart.focus();
    } else update();
  }

  function schedule() {
    timer=setTimeout(() => {
      timer=null;
      reveal();
      if (mode==="Playing") schedule();
    },900);
  }

  next.addEventListener("click",reveal);
  play.addEventListener("click",() => {
    if (mode==="Playing") halt("Paused");
    else if (shown<lines.length) {
      mode="Playing";
      update();
      schedule();
    }
  });

  function rewind(label) {
    for (const line of lines) line.hidden=true;
    shown=0;
    tape.scrollTop=0;
    halt(label);
    reveal();
  }

  restart.addEventListener("click",() => rewind("Rewound"));
  document.addEventListener("keydown",event => {
    if (event.key==="Escape"&&mode==="Playing") {
      event.preventDefault();
      halt("Paused");
    }
  });
  rewind("Ready");
  document.getElementById("controls").hidden=false;
</script>
</body>
</html>`;
}
