/**
 * Record a dip, for @nobiggie.crumbs. Plays a scripted pop → dip → bite in the chosen
 * flavour, composites it into a 1080×1920 (Reels/Stories) or 1080×1080 frame with the
 * headline, the counter and a "nobiggie.shop" end card, and records it on the device with
 * MediaRecorder: MP4 where the browser can, WebM otherwise. Sound comes along if it's on.
 * Nothing is uploaded anywhere.
 */
import { NeutralToneMapping, Scene, WebGLRenderer } from 'three';
import { Director } from '../three/director';
import { dips, flavourById, flavours, type FlavourId } from '../content/facts';
import { sound } from '../lib/sound';
import { track } from '../lib/track';

type Format = 'story' | 'square';
const SIZES: Record<Format, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

let dialog: HTMLDialogElement | null = null;

export function openRecorder(start: FlavourId) {
  if (!dialog) dialog = build();
  const sel = dialog.querySelector<HTMLSelectElement>('[data-rec-flavour]')!;
  sel.value = start;
  dialog.querySelector<HTMLElement>('[data-rec-result]')!.hidden = true;
  dialog.showModal();
}

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'recorder';
  d.setAttribute('aria-labelledby', 'rec-title');
  d.innerHTML = `
    <div class="recorder-in">
      <header class="recorder-head">
        <h2 id="rec-title">Record a dip</h2>
        <button type="button" class="icon-btn" data-rec-close aria-label="Close">✕</button>
      </header>
      <p class="recorder-lede">A short clip of the cup, made on your phone. Post it and tag <b>@nobiggie.crumbs</b>.</p>
      <div class="recorder-opts">
        <label class="field"><span class="label">Flavour</span>
          <select class="input" data-rec-flavour>${flavours.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}</select></label>
        <fieldset class="recorder-fmt"><legend class="label">Shape</legend>
          <label><input type="radio" name="rec-fmt" value="story" checked> Reel / Story 9:16</label>
          <label><input type="radio" name="rec-fmt" value="square"> Square 1:1</label>
        </fieldset>
      </div>
      <div class="recorder-preview" data-rec-preview><p class="hand">preview shows up here</p></div>
      <p class="small muted" data-rec-status aria-live="polite">${sound.enabled ? 'Sound is on, so it gets recorded too.' : 'Sound is off. Switch it on under the cup to record it too.'}</p>
      <button type="button" class="btn btn-block" data-rec-go>Record</button>
      <div class="recorder-result" data-rec-result hidden>
        <a class="btn btn-cocoa btn-block" data-rec-download download>Download</a>
        <button type="button" class="btn btn-ghost btn-block" data-rec-share hidden>Share</button>
      </div>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    .recorder{border:0;padding:0;border-radius:20px;background:var(--paper);color:var(--cocoa);width:min(420px,94vw);max-height:94svh}
    .recorder::backdrop{background:rgb(30 18 10/.45)}
    .recorder-in{display:flex;flex-direction:column;gap:12px;padding:16px 18px 20px;overflow:auto;max-height:94svh}
    .recorder-head{display:flex;justify-content:space-between;align-items:center}
    .recorder-head h2{font-size:1.7rem}
    .recorder-opts{display:grid;gap:10px}
    .recorder-fmt{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 16px}
    .recorder-fmt label{display:flex;align-items:center;gap:6px;min-height:44px}
    .recorder-preview{display:grid;place-items:center;background:var(--cream-2);border-radius:12px;min-height:180px;overflow:hidden}
    .recorder-preview canvas,.recorder-preview video{width:100%;height:auto;max-height:50svh;object-fit:contain;display:block}
    .recorder-result{display:grid;gap:8px}`;
  d.append(style);
  document.body.append(d);
  d.querySelector('[data-rec-close]')!.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => e.target === d && d.close());
  d.querySelector('[data-rec-go]')!.addEventListener('click', () => record(d));
  return d;
}

async function record(d: HTMLDialogElement) {
  const go = d.querySelector<HTMLButtonElement>('[data-rec-go]')!;
  const status = d.querySelector<HTMLElement>('[data-rec-status]')!;
  const preview = d.querySelector<HTMLElement>('[data-rec-preview]')!;
  const result = d.querySelector<HTMLElement>('[data-rec-result]')!;
  const flavour = d.querySelector<HTMLSelectElement>('[data-rec-flavour]')!.value as FlavourId;
  const format = (d.querySelector<HTMLInputElement>('input[name="rec-fmt"]:checked')!.value as Format) ?? 'story';
  const mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) {
    status.textContent = 'This browser can’t record video. Try Chrome or Safari.';
    return;
  }
  go.disabled = true;
  result.hidden = true;
  status.textContent = 'Getting the cup ready…';

  const [W, H] = SIZES[format];
  // Weaker phones render the scene smaller and let the compositor scale it up.
  const weak = document.documentElement.dataset.weak !== undefined;
  const S = weak ? 720 : 1080;
  const gl = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(1);
  gl.setSize(S, S, false);
  gl.toneMapping = NeutralToneMapping;
  const scene = new Scene();
  const total = 24;
  let left = total;
  const director = new Director({
    flavour,
    total,
    lidOff: false,
    left: total,
    reduced: false,
    night: false,
    events: { popped() {}, bitten: (n) => (left = n), targets() {} },
  });
  try {
    await director.build(gl, scene);
  } catch {
    status.textContent = 'This phone can’t run the 3D cup, so it can’t record one either.';
    go.disabled = false;
    return;
  }
  scene.add(director.root);
  director.resize(S, S);
  await gl.compileAsync(scene, director.camera);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d')!;
  preview.replaceChildren(out);
  await Promise.all([document.fonts.load('640 80px "Fraunces"'), document.fonts.load('italic 600 80px "Fraunces"'), document.fonts.load('60px "Gochi Hand"')]);

  const f = flavourById(flavour);
  const sceneY = format === 'story' ? 520 : 40;
  const end = 7600;
  const draw = (t: number) => {
    g.fillStyle = '#F6EFE3';
    g.fillRect(0, 0, W, H);
    if (t < end - 1700) {
      g.drawImage(gl.domElement, 0, sceneY, W, W);
      g.textAlign = 'center';
      if (format === 'story') {
        g.fillStyle = '#3B2416';
        g.font = '640 92px "Fraunces"';
        g.fillText('Come for the cookies.', W / 2, 250);
        g.fillStyle = '#B3262E';
        g.font = 'italic 600 92px "Fraunces"';
        g.fillText('Stay for the dip.', W / 2, 360);
      }
      g.fillStyle = '#3B2416';
      g.font = '72px "Gochi Hand"';
      g.textAlign = 'right';
      g.fillText(`${left} left`, W - 70, sceneY + (format === 'story' ? 120 : 110));
      g.textAlign = 'center';
      g.font = '600 40px "Instrument Sans"';
      g.fillStyle = '#6B4E3B';
      g.fillText(`${f.name} · ${dips[f.dip].name} dip`, W / 2, format === 'story' ? H - 230 : H - 60);
    } else {
      // end card
      const a = Math.min(1, (t - (end - 1700)) / 300);
      g.globalAlpha = a;
      g.fillStyle = '#3B2416';
      g.textAlign = 'center';
      g.font = '760 150px "Fraunces"';
      g.fillText('No Biggie', W / 2, H / 2 - 40);
      g.fillStyle = '#B3262E';
      g.font = '84px "Gochi Hand"';
      g.fillText('Dip. Dunk. Repeat.', W / 2, H / 2 + 70);
      g.fillStyle = '#3B2416';
      g.font = '600 60px "Instrument Sans"';
      g.fillText('nobiggie.shop', W / 2, H / 2 + 220);
      g.globalAlpha = 1;
    }
  };

  const video = out.captureStream(30);
  const audio = sound.enabled ? sound.stream() : null;
  audio?.getAudioTracks().forEach((tr) => video.addTrack(tr));
  const rec = new MediaRecorder(video, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));

  // the script: a beat, pop, two dips and bites, end card
  const cues: [number, () => void][] = [
    [500, () => director.pop()],
    [1500, () => director.take()],
    [3200, () => director.take()],
  ];
  status.textContent = 'Recording… keep this screen open.';
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = performance.now() - t0;
      while (cues.length && cues[0][0] <= t) cues.shift()![1]();
      director.update();
      gl.render(scene, director.camera);
      draw(t);
      if (t < end) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  await done;
  director.dispose();
  gl.dispose();

  const type = mime.split(';')[0];
  const blob = new Blob(chunks, { type });
  const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  const name = `nobiggie-dip-${flavour}.${ext}`;
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.src = url;
  v.controls = true;
  v.playsInline = true;
  v.muted = !audio;
  preview.replaceChildren(v);
  const dl = d.querySelector<HTMLAnchorElement>('[data-rec-download]')!;
  dl.href = url;
  dl.download = name;
  const share = d.querySelector<HTMLButtonElement>('[data-rec-share]')!;
  const file = new File([blob], name, { type });
  share.hidden = !navigator.canShare?.({ files: [file] });
  share.onclick = () => navigator.share({ files: [file], text: 'Dip. Dunk. Repeat. @nobiggie.crumbs' }).catch(() => undefined);
  result.hidden = false;
  status.textContent = `Done. ${(blob.size / 1e6).toFixed(1)} MB ${ext.toUpperCase()}.`;
  go.disabled = false;
  go.textContent = 'Record again';
  track('record_dip', { flavour, format, ext });
}
