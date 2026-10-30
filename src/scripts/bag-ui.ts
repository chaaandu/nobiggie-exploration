/**
 * Everything that touches the bag: Add buttons (feedback on the button itself, never a
 * toast), quantity steppers, Order buttons (open the bag), the header count, the sticky
 * bar's numbers, and the bag sheet itself.
 */
import { add, count, ensure, getBag, qtyOf, setNote, setPincode, setQty, subscribe, subtotal, type BagState } from '../lib/bag';
import { checkoutTarget } from '../lib/checkout';
import { checkPincode } from '../lib/delivery';
import { currentFlavour } from '../lib/current-flavour';
import { rupees } from '../lib/format';
import { track } from '../lib/track';
import { checkout, delivery, dips, flavourById, type FlavourId } from '../content/facts';

const dialog = document.querySelector<HTMLDialogElement>('[data-bag]')!;
const $ = <T extends Element = HTMLElement>(s: string) => dialog.querySelector<T>(s)!;
const live = document.getElementById('live');
const announce = (t: string) => {
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => (live.textContent = t));
};

/* ------------------------------------------------------------ the sheet */

function open() {
  if (dialog.open) return;
  render(getBag());
  dialog.showModal();
  document.documentElement.dataset.bagOpen = '';
}
function close() {
  dialog.close();
}
dialog.addEventListener('close', () => delete document.documentElement.dataset.bagOpen);
// tap the backdrop to close
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) close();
});
dialog.querySelectorAll('[data-bag-close]').forEach((b) => b.addEventListener('click', close));

// swipe the sheet down to close (phones)
let dragY: number | null = null;
dialog.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('.grab, .bag-head')) dragY = e.clientY;
});
dialog.addEventListener('pointerup', (e) => {
  if (dragY !== null && e.clientY - dragY > 60) close();
  dragY = null;
});

function render(s: BagState) {
  const lines = $('[data-bag-lines]');
  $('[data-bag-empty]').hidden = s.lines.length > 0;
  $('[data-bag-extras]').hidden = s.lines.length === 0;
  $('[data-bag-foot]').hidden = s.lines.length === 0;
  lines.replaceChildren(
    ...s.lines.map((l) => {
      const f = flavourById(l.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="/renders/card-${f.id}-480.webp" alt="" width="56" height="56" loading="lazy" />
        <div><p class="l-name">${f.name}</p><p class="l-sub">${dips[f.dip].short} · ${rupees(f.price)} each</p></div>
        <div class="l-qty" role="group" aria-label="Quantity of ${f.name}">
          <button type="button" data-line="${f.id}" data-d="-1" aria-label="One fewer ${f.name}">−</button>
          <output>${l.qty}</output>
          <button type="button" data-line="${f.id}" data-d="1" aria-label="One more ${f.name}">+</button>
        </div>`;
      return li;
    }),
  );
  $('[data-bag-total]').textContent = rupees(subtotal(s));
  const fee = delivery.fee;
  $('[data-bag-delivery]').textContent =
    fee === 0 ? 'Delivery is free.' : typeof fee === 'number' ? `Delivery ${rupees(fee)}${delivery.freeAbove ? `, free over ${rupees(delivery.freeAbove)}` : ''}.` : 'Delivery: we confirm it with you on WhatsApp.';
  renderCta(s);
  const pin = $<HTMLInputElement>('[data-pin]');
  if (document.activeElement !== pin) pin.value = s.pincode;
  showPin(s.pincode);
  dialog.querySelectorAll<HTMLInputElement>('[data-note]').forEach((i) => {
    if (document.activeElement !== i) i.value = s.note[i.dataset.note as 'to' | 'from' | 'message'] ?? '';
  });
  if (s.note.to || s.note.from || s.note.message) $<HTMLDetailsElement>('[data-note-box]').open = true;
}

function renderCta(s: BagState) {
  const box = $('[data-bag-cta]');
  if (!s.lines.length) return box.replaceChildren();
  const t = checkoutTarget(s);
  const meta = { mode: t.mode, items: count(s), total: subtotal(s) };
  if (t.kind === 'link') {
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = t.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `${t.label} · ${rupees(subtotal(s))}`;
    a.addEventListener('click', () => track('checkout_click', meta));
    const note = document.createElement('p');
    note.className = 'small muted';
    note.textContent =
      t.mode === 'whatsapp'
        ? `Opens WhatsApp with your order filled in. ${checkout.paymentNote ?? 'We confirm and take payment there.'}`
        : t.mode === 'shopify'
          ? 'Secure checkout on Shopify.'
          : 'Secure payment on Razorpay.';
    box.replaceChildren(a, note);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'pay-links';
    t.links.forEach((l) => {
      const a = document.createElement('a');
      a.className = 'btn';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `Pay for ${l.name}`;
      a.addEventListener('click', () => track('checkout_click', meta));
      wrap.append(a);
    });
    box.replaceChildren(wrap);
  }
}

function showPin(v: string) {
  const msg = $('[data-pin-msg]');
  const r = checkPincode(v);
  msg.textContent = r?.text ?? '';
  msg.dataset.tone = r?.tone ?? '';
}

dialog.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-line]');
  if (!b) return;
  const id = b.dataset.line as FlavourId;
  const next = qtyOf(id) + Number(b.dataset.d);
  setQty(id, next);
  announce(next ? `${flavourById(id).name}: ${next}. ${count()} in your bag.` : `${flavourById(id).name} removed.`);
});
$<HTMLInputElement>('[data-pin]').addEventListener('input', (e) => {
  const v = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
  (e.target as HTMLInputElement).value = v;
  setPincode(v);
});
dialog.querySelectorAll<HTMLInputElement>('[data-note]').forEach((i) =>
  i.addEventListener('input', () => setNote({ [i.dataset.note as string]: i.value.trim() })),
);

/* ------------------------------------------------------------ the rest of the page */

function syncCount(s: BagState) {
  const n = count(s);
  document.querySelectorAll<HTMLElement>('[data-bag-count]').forEach((el) => {
    el.textContent = String(n);
    if (n) el.dataset.n = String(n);
    else delete el.dataset.n;
  });
  document.querySelectorAll<HTMLElement>('[data-bag-open]').forEach((el) => el.setAttribute('aria-label', `Bag, ${n} item${n === 1 ? '' : 's'}`));
}

subscribe((s) => {
  syncCount(s);
  if (dialog.open) render(s);
});
syncCount(getBag());

// "Added · 2 in bag", on the button you pressed, for a couple of seconds.
const timers = new WeakMap<Element, number>();
function confirmOn(button: HTMLElement, text: string) {
  const label = button.querySelector<HTMLElement>('[data-add-label]') ?? button;
  if (!label.dataset.idle) label.dataset.idle = label.textContent ?? '';
  label.textContent = text;
  button.dataset.added = '';
  clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => {
      label.textContent = label.dataset.idle ?? 'Add';
      delete button.dataset.added;
    }, 2400),
  );
}
window.addEventListener('nb:added', (e) => {
  const { button } = (e as CustomEvent<{ button: HTMLElement }>).detail;
  confirmOn(button, `Added · ${count()} in bag`);
  announce(`Added. ${count()} in your bag.`);
});

/** The stepper that belongs to an Add button: nearest one for the same flavour. */
function stepperFor(btn: HTMLElement, id: string): HTMLElement | null {
  let el: HTMLElement | null = btn;
  for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
    const s = el.querySelector<HTMLElement>(`[data-stepper][data-qty-for="${id}"]`);
    if (s) return s;
  }
  return null;
}

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;

  const step = t.closest<HTMLButtonElement>('[data-stepper] [data-step]');
  if (step) {
    const box = step.closest<HTMLElement>('[data-stepper]')!;
    const out = box.querySelector('output')!;
    const max = Number(box.dataset.max) || 20;
    out.textContent = String(Math.min(max, Math.max(1, Number(out.textContent) + Number(step.dataset.step))));
    return;
  }

  const addBtn = t.closest<HTMLElement>('[data-add]');
  if (addBtn) {
    const id = addBtn.dataset.add as FlavourId;
    const qty = Number(addBtn.dataset.addQty) || Number(stepperFor(addBtn, id)?.querySelector('output')?.textContent) || 1;
    add(id, qty);
    track('add_to_bag', { flavour: id, qty, source: addBtn.closest('section, article')?.id || location.pathname });
    confirmOn(addBtn, `Added · ${qtyOf(id)} in bag`);
    announce(`Added ${qty} ${flavourById(id).name}. ${count()} in your bag.`);
    return;
  }

  const order = t.closest<HTMLAnchorElement>('[data-order]');
  if (order) {
    e.preventDefault();
    const id = (order.dataset.orderFlavour as FlavourId) || currentFlavour();
    ensure(id, Number(order.dataset.orderQty) || 1);
    track('add_to_bag', { flavour: id, qty: Number(order.dataset.orderQty) || 1, source: 'order_button' });
    open();
    return;
  }

  if (t.closest('[data-bag-open]')) {
    e.preventDefault();
    open();
  }
});

export { open as openBag };
