// Yayın Akışı: canlı bir programın bölümlerini, yayın tam saatinde bitsin diye yeniden paylaştırır.
// Bir bölüm uzarsa sonraki esnek bölümler kısalır; erken biterse uzar. Sabit bölümlere (reklam, şarkı) dokunulmaz.
// Bütün süreler saniye; saatler gece yarısından bu yana saniye.

// ---------- Okuma / yazma ----------
// "4:30" -> 270, "1:02:03" -> 3723, "90" -> 90 (düz sayı saniyedir). Geçersizse null.
export function sureOku(yazi) {
  const s = String(yazi).trim();
  if (/^\d+$/.test(s)) return +s;
  const m = s.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  return m[3] === undefined ? +m[1] * 60 + +m[2] : +m[1] * 3600 + +m[2] * 60 + +m[3];
}
export function sureYaz(sn, isaretli = false) {
  const n = Math.round(sn);
  const a = Math.abs(n);
  const h = Math.floor(a / 3600), d = Math.floor((a % 3600) / 60), s = a % 60;
  const govde = h ? `${h}:${String(d).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${d}:${String(s).padStart(2, '0')}`;
  return (n < 0 ? '−' : isaretli ? '+' : '') + govde;
}
// "20:00" -> 72000, "20:00:30" -> 72030. Geçersizse null.
export function saatOku(yazi) {
  const m = String(yazi).trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)(?::([0-5]\d))?$/);
  return m ? +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0) : null;
}
export function saatYaz(sn, saniyeli = true) {
  const t = ((Math.floor(sn) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600), d = Math.floor((t % 3600) / 60), s = t % 60;
  return `${String(h).padStart(2, '0')}:${String(d).padStart(2, '0')}${saniyeli ? ':' + String(s).padStart(2, '0') : ''}`;
}

// ---------- Paylaştırma ----------
// parcalar: [{ sure, min, max }] (min ≤ sure ≤ max). Toplamı hedef olacak yeni süreler bulur.
// kip 'oranli': her bölüm esneklik payı oranında kısalır/uzar (5 dakika esneyebilen, 1 dakika esneyebilenden 5 kat fazla).
// kip 'esit': her esnek bölüm aynı saniye kadar kısalır/uzar; sınırına dayanan durur, kalan diğerlerine dağılır (su doldurma).
// Dönüş: { sureler (tam saniye), artan } — artan > 0: o kadar saniye sığmıyor (hepsi en kısada bile taşıyor);
// artan < 0: o kadar saniye boş kalıyor (hepsi en uzunda bile yetmiyor).
export function dagit(parcalar, hedef, kip = 'oranli') {
  const plan = parcalar.reduce((a, p) => a + p.sure, 0);
  const D = hedef - plan;                     // > 0 uzat, < 0 kısalt
  const pay = parcalar.map(p => (D >= 0 ? p.max - p.sure : p.sure - p.min));
  const topPay = pay.reduce((a, b) => a + b, 0);
  const yon = Math.sign(D), ihtiyac = Math.abs(D);
  let degisim;
  if (ihtiyac === 0 || topPay === 0) degisim = parcalar.map(() => 0);
  else if (ihtiyac >= topPay) degisim = pay.slice();
  else if (kip === 'esit') degisim = suDoldur(pay, ihtiyac);
  else degisim = pay.map(p => (p * ihtiyac) / topPay);
  const ham = parcalar.map((p, i) => p.sure + yon * degisim[i]);
  const ulasilan = Math.min(ihtiyac, topPay);
  const sureler = tamYuvarla(ham, Math.round(plan + yon * ulasilan), parcalar.map(p => p.min), parcalar.map(p => p.max));
  return { sureler, artan: Math.round(yon * (ulasilan - ihtiyac)) + 0 };   // + 0: −0 çıkmasın
}

// Herkese aynı miktar, ama kimse kendi payını aşamaz: seviye L öyle ki Σ min(pay_i, L) = ihtiyac
export function suDoldur(pay, ihtiyac) {
  const sirali = pay.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  let kalan = ihtiyac, kisi = pay.filter(p => p > 0).length;
  const sonuc = pay.map(() => 0);
  let L = 0;
  for (const [p] of sirali) {
    if (p <= 0) continue;
    if ((p - L) * kisi >= kalan) { L += kalan / kisi; kalan = 0; break; }
    kalan -= (p - L) * kisi; L = p; kisi--;
  }
  for (let i = 0; i < pay.length; i++) sonuc[i] = Math.min(pay[i], L);
  return sonuc;
}

// Ondalıklı süreleri tam saniyeye çevirir; toplam tam olarak 'toplam' olur, sınırlar korunur (en büyük kalan yöntemi).
export function tamYuvarla(degerler, toplam, alt, ust) {
  const taban = degerler.map((v, i) => Math.max(alt[i], Math.min(ust[i], Math.floor(v + 1e-9))));
  let fark = toplam - taban.reduce((a, b) => a + b, 0);
  const sira = degerler.map((v, i) => [v - Math.floor(v + 1e-9), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let tur = 0; fark > 0 && tur < 3; tur++) {
    for (const [, i] of sira) { if (fark <= 0) break; if (taban[i] < ust[i]) { taban[i]++; fark--; } }
  }
  for (let tur = 0; fark < 0 && tur < 3; tur++) {
    for (const [, i] of [...sira].reverse()) { if (fark >= 0) break; if (taban[i] > alt[i]) { taban[i]--; fark++; } }
  }
  return taban;
}

// ---------- Plan kontrolü ----------
// bolum: { ad, sure, esnek (bool), min, max }. Sabit bölümde min = max = sure sayılır.
export function sinirlar(b) {
  if (!b.esnek) return { sure: b.sure, min: b.sure, max: b.sure };
  const min = Math.min(b.min ?? b.sure, b.sure), max = Math.max(b.max ?? b.sure, b.sure);
  return { sure: b.sure, min: Math.max(0, min), max };
}
export function planOzet(program) {
  const s = program.bolumler.map(sinirlar);
  const pencere = program.bitis - program.baslangic;
  const top = k => s.reduce((a, b) => a + b[k], 0);
  return { pencere, plan: top('sure'), enKisa: top('min'), enUzun: top('max'), fark: top('sure') - pencere };
}

// ---------- Canlı durum ----------
// program: { baslangic, bitis, bolumler }. kayit: biten her bölümün bitiş saati (artan). simdi: şu anki saat.
// Yayın baslangic'ta başlamış sayılır. Şu anki bölüm, kayıttaki son bitişten bu yana sürüyor.
export function durum(program, kayitHam, simdi, kip = 'oranli') {
  const { baslangic, bitis, bolumler } = program;
  const kayit = kayitHam.map(Math.round);   // tam saniye: kesirli saniyeler "0:00 geç" gibi hayalet sapmalar doğurmasın
  const n = bolumler.length;
  const basladi = simdi >= baslangic || kayit.length > 0;
  const bitenler = kayit.slice(0, n).map((son, i) => {
    const bas = i === 0 ? baslangic : kayit[i - 1];
    return { i, ad: bolumler[i].ad, plan: bolumler[i].sure, gercek: son - bas, fark: son - bas - bolumler[i].sure, bas, son };
  });
  const k = bitenler.length;
  if (k >= n) {
    const son = kayit[n - 1];
    return { asama: 'bitti', bitenler, gelecek: [], tahminiBitis: son, sapma: son - bitis, artan: 0 };
  }
  const simdikiBas = k === 0 ? baslangic : kayit[k - 1];
  const an = basladi ? Math.max(simdi, simdikiBas) : baslangic;
  const gecen = basladi ? Math.max(0, Math.floor(an - simdikiBas)) : 0;

  // Kalan bölümler: şu anki bölümün kalan kısmı + sonrakiler
  const parcalar = bolumler.slice(k).map((b, j) => {
    const s = sinirlar(b);
    if (j > 0) return s;
    return { sure: Math.max(0, s.sure - gecen), min: Math.max(0, s.min - gecen), max: Math.max(0, s.max - gecen) };
  });
  const kalanPencere = Math.max(0, bitis - (simdikiBas + gecen));
  const { sureler, artan } = dagit(parcalar, kalanPencere, kip);

  let t = simdikiBas + gecen;
  const gelecek = [];
  // Geri sayım: her bölümün "en geç başlama" saati — sonraki her şey en kısa haline inse bile tam bitişe yetişmek için
  const minler = parcalar.map(p => p.min);
  let sondanMin = 0;
  const enGec = new Array(parcalar.length);
  for (let j = parcalar.length - 1; j >= 0; j--) { sondanMin += minler[j]; enGec[j] = bitis - sondanMin; }
  for (let j = 0; j < parcalar.length; j++) {
    const b = bolumler[k + j];
    const yeni = j === 0 ? gecen + sureler[0] : sureler[j];
    gelecek.push({
      i: k + j, ad: b.ad, esnek: !!b.esnek, plan: b.sure, yeni, fark: yeni - b.sure,
      baslar: j === 0 ? simdikiBas : t, biter: (j === 0 ? simdikiBas : t) + yeni,
      enGec: j === 0 ? null : enGec[j],
      tasiyor: j === 0 && gecen > sinirlar(b).max,
    });
    t = (j === 0 ? simdikiBas : t) + yeni;
  }
  const tahminiBitis = t;   // sığmayan kısım (artan) zaten bölümlerin içinde: hepsi en kısada ve yine de geç bitiyor
  const simdiki = gelecek[0];
  return {
    asama: basladi ? 'canli' : 'once',
    bitenler, gelecek, simdiki: { ...simdiki, gecen, kalan: simdiki.yeni - gecen },
    tahminiBitis, sapma: tahminiBitis - bitis, artan,
  };
}

// ---------- Uydurma örnek: bir saatlik canlı müzik programı ----------
export const ORNEK = {
  ad: 'Cuma Gecesi Canlı',
  baslangic: 20 * 3600,
  bitis: 20 * 3600 + 50 * 60,
  bolumler: [
    { ad: 'Açılış jeneriği', sure: 60, esnek: false },
    { ad: 'Sunucu karşılama', sure: 150, esnek: true, min: 60, max: 240 },
    { ad: '1. sahne: grup performansı', sure: 255, esnek: false },
    { ad: 'Konuk röportajı', sure: 420, esnek: true, min: 180, max: 540 },
    { ad: 'Reklam arası', sure: 180, esnek: false },
    { ad: '2. sahne: akustik', sure: 230, esnek: false },
    { ad: 'Seyirci soruları', sure: 300, esnek: true, min: 60, max: 420 },
    { ad: '3. sahne: yeni şarkı', sure: 245, esnek: false },
    { ad: 'Sohbet', sure: 460, esnek: true, min: 120, max: 600 },
    { ad: 'Reklam arası', sure: 180, esnek: false },
    { ad: 'Final sahnesi', sure: 330, esnek: false },
    { ad: 'Teşekkür ve kapanış', sure: 150, esnek: true, min: 60, max: 210 },
    { ad: 'Kapanış jeneriği', sure: 40, esnek: false },
  ],
};
// Örnek kayıt: karşılama 40 sn, röportaj 2 dakika uzamış; şimdi reklam arası sürüyor
export const ORNEK_KAYIT = (() => {
  const b = ORNEK.bolumler, s = ORNEK.baslangic;
  const gercek = [62, 190, 255, 540];
  const k = []; let t = s;
  for (const g of gercek) { t += g; k.push(t); }
  return k;
})();
export const ORNEK_SAAT = ORNEK_KAYIT[3] + 75;
