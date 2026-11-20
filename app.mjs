import { sureOku, sureYaz, saatOku, saatYaz, sinirlar, planOzet, durum, ORNEK, ORNEK_KAYIT, ORNEK_SAAT } from './core.mjs';

const $ = id => document.getElementById(id);
const ANAHTAR = 'yayin-akisi-v1';
const kacama = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// program: { ad, baslangic, bitis, bolumler }, canli: { kayit, saat, hiz, calisiyor, gercekSaat }, kip
let program = structuredClone(ORNEK);
let canli = { kayit: [], saat: null, hiz: 1, calisiyor: false, gercekSaat: false };
let kip = 'oranli';
let ref = Date.now();   // canli.saat'in ölçüldüğü an

function kaydet() {
  try { localStorage.setItem(ANAHTAR, JSON.stringify({ program, canli: { ...canli, calisiyor: false, saat: simdi() }, kip })); } catch { /* özel pencere */ }
}
function yukle() {
  try {
    const d = JSON.parse(localStorage.getItem(ANAHTAR) || 'null');
    if (!d?.program?.bolumler?.length) return;
    const sn = x => (Number.isInteger(x) && x >= 0 && x < 86400 * 2 ? x : null);
    const bolumler = d.program.bolumler.slice(0, 60).map(b => ({
      ad: String(b.ad ?? 'Bölüm').slice(0, 60), sure: sn(b.sure) ?? 60, esnek: !!b.esnek,
      min: sn(b.min) ?? undefined, max: sn(b.max) ?? undefined,
    }));
    const bas = sn(d.program.baslangic) ?? ORNEK.baslangic;
    program = { ad: String(d.program.ad ?? '').slice(0, 40), baslangic: bas, bitis: Math.max(bas + 60, sn(d.program.bitis) ?? bas + 3600), bolumler };
    const k = Array.isArray(d.canli?.kayit) ? d.canli.kayit.filter(x => typeof x === 'number' && isFinite(x)).slice(0, bolumler.length) : [];
    canli = { kayit: k, saat: typeof d.canli?.saat === 'number' ? d.canli.saat : null, hiz: [1, 10, 60].includes(d.canli?.hiz) ? d.canli.hiz : 1, calisiyor: false, gercekSaat: !!d.canli?.gercekSaat };
    if (d.kip === 'esit') kip = 'esit';
  } catch { /* bozuk kayıt */ }
}

// ---------- Saat ----------
function duvarSaati() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000; }
function simdi() {
  if (canli.gercekSaat) return duvarSaati();
  if (canli.saat === null) return program.baslangic;
  return canli.calisiyor ? canli.saat + ((Date.now() - ref) / 1000) * canli.hiz : canli.saat;
}
function saatiDondur() { canli.saat = simdi(); ref = Date.now(); }

// ---------- Program tablosu ----------
function programCiz() {
  $('ad').value = program.ad;
  $('baslangic').value = saatYaz(program.baslangic, program.baslangic % 60 !== 0);
  $('bitis').value = saatYaz(program.bitis, program.bitis % 60 !== 0);
  document.querySelectorAll('input[name=kip]').forEach(r => { r.checked = r.value === kip; });
  const tb = $('bolumler');
  tb.innerHTML = '';
  program.bolumler.forEach((b, i) => {
    const s = sinirlar(b);
    const tr = document.createElement('tr');
    tr.className = i < canli.kayit.length ? 'gecti' : '';
    tr.innerHTML = `<td><input class="ad" maxlength="60" value="${kacama(b.ad)}" aria-label="${i + 1}. bölümün adı"></td>
      <td><input class="sure" inputmode="numeric" value="${sureYaz(b.sure)}" aria-label="${i + 1}. bölümün süresi"></td>
      <td class="orta"><input type="checkbox" class="esnek" ${b.esnek ? 'checked' : ''} aria-label="${i + 1}. bölüm esnek mi"></td>
      <td><input class="min" inputmode="numeric" value="${sureYaz(s.min)}" ${b.esnek ? '' : 'disabled'} aria-label="${i + 1}. bölüm en kısa"></td>
      <td><input class="max" inputmode="numeric" value="${sureYaz(s.max)}" ${b.esnek ? '' : 'disabled'} aria-label="${i + 1}. bölüm en uzun"></td>
      <td class="islem"><button class="kucuk yukari" aria-label="${i + 1}. bölümü yukarı al" ${i === 0 ? 'disabled' : ''}>↑</button><button class="kucuk sil" aria-label="${i + 1}. bölümü sil" ${program.bolumler.length <= 1 ? 'disabled' : ''}>×</button></td>`;
    const q = c => tr.querySelector(c);
    q('.ad').oninput = e => { b.ad = e.target.value.trim() || `Bölüm ${i + 1}`; degisti(false); };
    const sureAlani = (alan, uygula) => {
      q(alan).oninput = e => {
        const v = sureOku(e.target.value);
        const iyi = v !== null && v <= 6 * 3600;
        e.target.classList.toggle('hatali', !iyi);
        if (iyi) { uygula(v); degisti(false); }
      };
      q(alan).onchange = () => programCiz();   // odaktan çıkınca düzgün biçimde yeniden yaz
    };
    sureAlani('.sure', v => { b.sure = v; });
    sureAlani('.min', v => { b.min = v; });
    sureAlani('.max', v => { b.max = v; });
    q('.esnek').onchange = e => {
      b.esnek = e.target.checked;
      if (b.esnek && b.min === undefined) { b.min = Math.round(b.sure * 0.5); b.max = Math.round(b.sure * 1.5); }
      degisti(true);
    };
    q('.yukari').onclick = () => { [program.bolumler[i - 1], program.bolumler[i]] = [program.bolumler[i], program.bolumler[i - 1]]; degisti(true); };
    q('.sil').onclick = () => { program.bolumler.splice(i, 1); canli.kayit = canli.kayit.slice(0, program.bolumler.length); degisti(true); };
    tb.append(tr);
  });
}
function degisti(tablo) { kaydet(); if (tablo) programCiz(); ciz(); }

$('ad').oninput = () => { program.ad = $('ad').value; degisti(false); };
for (const alan of ['baslangic', 'bitis']) {
  $(alan).oninput = () => {
    const v = saatOku($(alan).value);
    $(alan).classList.toggle('hatali', v === null);
    if (v === null) return;
    const bas = saatOku($('baslangic').value), bit = saatOku($('bitis').value);
    if (bas === null || bit === null) return;
    program.baslangic = bas;
    program.bitis = bit > bas ? bit : bit + 86400;   // gece yarısını geçen yayın
    degisti(false);
  };
}
$('bolumEkle').onclick = () => { program.bolumler.push({ ad: `Bölüm ${program.bolumler.length + 1}`, sure: 180, esnek: true, min: 60, max: 300 }); degisti(true); };
$('ornek').onclick = () => { program = structuredClone(ORNEK); canli = { kayit: [], saat: null, hiz: 1, calisiyor: false, gercekSaat: false }; degisti(true); };
document.querySelectorAll('input[name=kip]').forEach(r => { r.onchange = () => { kip = r.value; degisti(false); }; });

// ---------- Canlı kart ----------
let sonAnahtar = '';
function canliCiz(d) {
  const kart = $('canli');
  if (!$('canliUst')) kart.innerHTML = '<div id="canliUst"></div><div id="canliAlt"></div>';
  const ust = $('canliUst');
  const saat = simdi();
  const sapmaYazi = d.sapma === 0 ? '<b class="iyi">Tam saatinde bitiyor</b>'
    : d.sapma > 0 ? `<b class="kotu">${sureYaz(d.sapma)} geç bitecek</b> — esnek bölümlerin hepsi en kısada bile yetmiyor`
      : `<b class="uyari">${sureYaz(-d.sapma)} erken bitecek</b> — esnek bölümlerin hepsi en uzunda bile doldurmuyor`;
  const dugmeler = `<div class="dugmeler">
      ${d.asama === 'bitti' ? '' : canli.saat === null && !canli.gercekSaat ? '<button id="baslat">▶ Başlat</button>' : `<button id="sonraki">⏭ Sonraki bölüm</button>`}
      ${!canli.gercekSaat && canli.saat !== null && d.asama !== 'bitti' ? `<button id="duraklat" class="ikinci">${canli.calisiyor ? '⏸ Durdur' : '▶ Devam'}</button>` : ''}
      <button id="geriAl" class="ikinci" ${canli.kayit.length ? '' : 'disabled'}>↶ Geri al</button>
      <button id="sifirla" class="ikinci">Sıfırla</button>
    </div>
    <div class="saat-ayar">
      <label class="satir"><input type="checkbox" id="gercekSaat" ${canli.gercekSaat ? 'checked' : ''}> Gerçek saati kullan</label>
      ${canli.gercekSaat ? '' : `<label class="satir">Prova hızı <select id="hiz">${[1, 10, 60].map(h => `<option value="${h}" ${canli.hiz === h ? 'selected' : ''}>×${h}</option>`).join('')}</select></label>`}
    </div>`;
  const saatSatiri = `<p class="saat">🕒 ${saatYaz(saat)}${canli.gercekSaat ? '' : canli.saat === null ? ' · prova saati' : canli.calisiyor ? ` · prova ×${canli.hiz}` : ' · durdu'}</p>`;
  const toplamFark = d.bitenler.reduce((a, b) => a + b.fark, 0);
  if (d.asama === 'bitti') {
    kart.className = 'kart ozet' + (d.sapma > 0 ? ' kotu' : '');
    ust.innerHTML = `<h2>${kacama(program.ad || 'Program')} bitti</h2>
      <div class="dev">${d.sapma === 0 ? 'Tam saatinde 🎉' : d.sapma > 0 ? `${sureYaz(d.sapma)} geç` : `${sureYaz(-d.sapma)} erken`}</div>
      <p class="not">Son bölüm ${saatYaz(d.tahminiBitis)}'da bitti; kesin bitiş ${saatYaz(program.bitis)} idi.</p>`;
  } else {
    const s = d.simdiki;
    const once = d.asama === 'once';
    kart.className = 'kart ozet' + (s.tasiyor || d.sapma > 0 ? ' kotu' : '');
    ust.innerHTML = `<h2>${once ? 'Yayın başlamadı' : `Şu an: ${kacama(s.ad)}`}</h2>
      <div class="dev">${once ? saatYaz(program.baslangic, false) : s.tasiyor ? `+${sureYaz(s.gecen - sinirlar(program.bolumler[s.i]).max)}` : sureYaz(s.kalan)} <small>${once ? 'başlıyor' : s.tasiyor ? 'süresini aştı, kalanlardan kesiliyor' : 'kaldı'}</small></div>
      ${once ? '' : `<div class="ilerleme"><i style="width:${Math.min(100, (s.gecen / Math.max(1, s.yeni)) * 100).toFixed(1)}%"></i></div>`}
      <div class="kutular">
        <div><b>${sapmaYazi.startsWith('<b class="iyi">') ? '✓' : sureYaz(d.sapma, true)}</b><span>yayın sonu</span></div>
        <div><b>${sureYaz(toplamFark, true)}</b><span>şimdiye kadarki sapma</span></div>
        <div><b>${once ? program.bolumler[0]?.ad ? kacama(program.bolumler[0].ad) : '—' : d.gelecek[1] ? kacama(d.gelecek[1].ad) : 'son bölüm'}</b><span>${once ? 'ilk bölüm' : 'sıradaki'}</span></div>
      </div>
      <p class="not">${sapmaYazi}.</p>`;
  }
  ust.innerHTML += saatSatiri;
  // Düğmeleri sadece durum değişince yeniden kur: her çeyrek saniyede kurarsam basılı tutulan tıklama kaybolur
  const anahtar = [d.asama, canli.calisiyor, canli.gercekSaat, canli.saat === null, canli.kayit.length, canli.hiz].join('|');
  if (anahtar === sonAnahtar) return;
  sonAnahtar = anahtar;
  $('canliAlt').innerHTML = dugmeler;
  const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  on('baslat', () => { canli.saat = program.baslangic; ref = Date.now(); canli.calisiyor = true; degisti(true); dongu(); });
  on('sonraki', () => { if (canli.kayit.length < program.bolumler.length) { canli.kayit.push(Math.round(Math.max(simdi(), canli.kayit.at(-1) ?? program.baslangic))); degisti(true); } });
  on('duraklat', () => { saatiDondur(); canli.calisiyor = !canli.calisiyor; degisti(false); dongu(); });
  on('geriAl', () => { canli.kayit.pop(); degisti(true); });
  on('sifirla', () => { canli = { ...canli, kayit: [], saat: null, calisiyor: false }; degisti(true); });
  const g = $('gercekSaat'); if (g) g.onchange = () => { canli.gercekSaat = g.checked; if (!g.checked) { canli.saat = duvarSaati(); ref = Date.now(); } degisti(false); dongu(); };
  const h = $('hiz'); if (h) h.onchange = () => { saatiDondur(); canli.hiz = +h.value; degisti(false); };
}

// ---------- Akış tablosu ve çizelge ----------
function akisCiz(d) {
  const satirlar = [
    ...d.bitenler.map(b => ({ ...b, durum: 'bitti', yeni: b.gercek, baslar: b.bas })),
    ...d.gelecek.map((g, j) => ({ ...g, durum: j === 0 && d.asama !== 'once' ? 'simdi' : 'gelecek' })),
  ];
  const farkYaz = f => (f === 0 ? '<span class="sifir">—</span>' : `<span class="${f > 0 ? 'artti' : 'azaldi'}">${sureYaz(f, true)}</span>`);
  $('akis').innerHTML = `<thead><tr><th>Başlar</th><th>Bölüm</th><th>Plan</th><th>Şimdi</th><th>Fark</th><th>En geç</th></tr></thead><tbody>`
    + satirlar.map(r => {
      const geride = r.durum === 'gelecek' && r.enGec !== null && r.baslar > r.enGec;
      return `<tr class="${r.durum}${geride ? ' geride' : ''}">
        <td>${saatYaz(r.baslar)}</td>
        <td>${r.durum === 'simdi' ? '▶ ' : ''}${kacama(r.ad)}${r.esnek === false || (r.durum === 'bitti' && !program.bolumler[r.i]?.esnek) ? '<span class="rozet">sabit</span>' : ''}</td>
        <td>${sureYaz(r.plan)}</td>
        <td><b>${sureYaz(r.yeni)}</b></td>
        <td>${farkYaz(r.durum === 'bitti' ? r.fark : r.yeni - r.plan)}</td>
        <td>${r.durum === 'gelecek' && r.enGec !== null ? saatYaz(r.enGec, false) : ''}</td></tr>`;
    }).join('') + '</tbody>';

  // Yatay çizelge: her bölüm genişliği süresi kadar; kesin bitiş çizgisi
  const bas = program.baslangic;
  const son = Math.max(program.bitis, d.tahminiBitis, ...satirlar.map(r => r.baslar + r.yeni));
  const yuzde = t => ((t - bas) / (son - bas)) * 100;
  const parcalar = satirlar.map(r => {
    const sinif = r.durum === 'bitti' ? 'bitti' : r.durum === 'simdi' ? 'simdi' : r.esnek ? 'esnek' : 'sabit';
    return `<i class="${sinif}" style="left:${yuzde(r.baslar).toFixed(3)}%;width:${Math.max(0.2, yuzde(r.baslar + r.yeni) - yuzde(r.baslar)).toFixed(3)}%" title="${kacama(r.ad)} · ${sureYaz(r.yeni)}"></i>`;
  }).join('');
  const an = simdi();
  $('cizelge').innerHTML = `<div class="cizelge">${parcalar}
      <b class="bitis-cizgisi" style="left:${yuzde(program.bitis).toFixed(3)}%"></b>
      ${d.asama === 'canli' ? `<b class="simdi-cizgisi" style="left:${Math.min(100, yuzde(an)).toFixed(3)}%"></b>` : ''}
    </div>
    <div class="cizelge-alt"><span>${saatYaz(bas, false)}</span><span>kesin bitiş ${saatYaz(program.bitis, false)}</span></div>
    <div class="lejant"><span><i class="bitti"></i>bitti</span><span><i class="simdi"></i>şu an</span><span><i class="esnek"></i>esnek</span><span><i class="sabit"></i>sabit</span></div>`;
}

function ciz() {
  const o = planOzet(program);
  $('planOzet').innerHTML = `Pencere ${sureYaz(o.pencere)} · plan ${sureYaz(o.plan)}${o.fark ? ` (<b class="${o.fark > 0 ? 'kotu' : 'uyari'}">${sureYaz(Math.abs(o.fark))} ${o.fark > 0 ? 'uzun' : 'kısa'}</b>)` : ' (tam)'} · esnekliklerle ${sureYaz(o.enKisa)} ile ${sureYaz(o.enUzun)} arası.`
    + (o.enKisa > o.pencere ? ' <b class="kotu">En kısa haliyle bile sığmıyor.</b>' : o.enUzun < o.pencere ? ' <b class="uyari">En uzun haliyle bile doldurmuyor.</b>' : '');
  // Prova saati hiç başlatılmadıysa yayın daha başlamamış sayılır
  const d = durum(program, canli.kayit, canli.saat === null && !canli.gercekSaat ? program.baslangic - 1 : simdi(), kip);
  canliCiz(d);
  akisCiz(d);
}

// Saat çalışırken ekranı her çeyrek saniyede tazele
let zamanlayici = 0;
function dongu() {
  clearInterval(zamanlayici);
  if (canli.calisiyor || canli.gercekSaat) zamanlayici = setInterval(ciz, 250);
}

// ---------- Başlangıç ----------
if (new URLSearchParams(location.search).has('ornek')) {
  canli = { kayit: ORNEK_KAYIT.slice(), saat: ORNEK_SAAT, hiz: 1, calisiyor: false, gercekSaat: false };
} else yukle();
programCiz();
ciz();
dongu();
