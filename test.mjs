import assert from 'node:assert/strict';
import {
  sureOku, sureYaz, saatOku, saatYaz, dagit, suDoldur, tamYuvarla, sinirlar, planOzet, durum,
  ORNEK, ORNEK_KAYIT, ORNEK_SAAT,
} from './core.mjs';

let sayac = 0;
const kontrol = (ad, fn) => { try { fn(); sayac++; } catch (e) { console.error('✗ ' + ad); throw e; } };
const toplam = a => a.reduce((x, y) => x + y, 0);

// ---------- Okuma / yazma ----------
kontrol('Süre okuma', () => {
  assert.equal(sureOku('4:30'), 270);
  assert.equal(sureOku('1:02:03'), 3723);
  assert.equal(sureOku('90'), 90);
  assert.equal(sureOku(' 0:05 '), 5);
});
kontrol('Hatalı süre', () => { for (const s of ['4:75', 'abc', '', '-3', '1:2', '4,5']) assert.equal(sureOku(s), null, s); });
kontrol('Süre yazma', () => {
  assert.equal(sureYaz(270), '4:30');
  assert.equal(sureYaz(3723), '1:02:03');
  assert.equal(sureYaz(-58), '−0:58');
  assert.equal(sureYaz(35, true), '+0:35');
  assert.equal(sureYaz(0, true), '+0:00');
});
kontrol('Saat okuma ve yazma', () => {
  assert.equal(saatOku('20:00'), 72000);
  assert.equal(saatOku('9.05'), 9 * 3600 + 300);
  assert.equal(saatOku('20:00:30'), 72030);
  assert.equal(saatOku('24:00'), null);
  assert.equal(saatOku('20:60'), null);
  assert.equal(saatYaz(72030), '20:00:30');
  assert.equal(saatYaz(86400 + 61, false), '00:01');
});

// ---------- Paylaştırma ----------
kontrol('Oranlı: esneklik payıyla orantılı kısalır', () => {
  // payları 100 ve 300; 80 saniye kısalmalı -> 20 ve 60
  const { sureler, artan } = dagit([{ sure: 200, min: 100, max: 200 }, { sure: 400, min: 100, max: 400 }], 520);
  assert.deepEqual(sureler, [180, 340]);
  assert.equal(artan, 0);
});
kontrol('Eşit: herkes aynı kısalır', () => {
  const { sureler } = dagit([{ sure: 200, min: 100, max: 200 }, { sure: 400, min: 100, max: 400 }], 520, 'esit');
  assert.deepEqual(sureler, [160, 360]);
});
kontrol('Eşit: payı biten durur, kalanı diğerleri taşır', () => {
  // payları 10, 100, 100; 150 sn kısalmalı -> 10, 70, 70
  const { sureler } = dagit([{ sure: 60, min: 50, max: 60 }, { sure: 300, min: 200, max: 300 }, { sure: 300, min: 200, max: 300 }], 510, 'esit');
  assert.deepEqual(sureler, [50, 230, 230]);
});
kontrol('Sabit bölüme dokunulmaz', () => {
  const { sureler } = dagit([{ sure: 180, min: 180, max: 180 }, { sure: 300, min: 60, max: 400 }], 400);
  assert.deepEqual(sureler, [180, 220]);
});
kontrol('Uzatma da çalışır', () => {
  const { sureler, artan } = dagit([{ sure: 100, min: 50, max: 150 }, { sure: 100, min: 50, max: 250 }], 300);
  assert.deepEqual(sureler, [125, 175]);
  assert.equal(artan, 0);
});
kontrol('Sığmıyorsa: hepsi en kısada, artan pozitif', () => {
  const { sureler, artan } = dagit([{ sure: 100, min: 80, max: 100 }, { sure: 100, min: 90, max: 100 }], 150);
  assert.deepEqual(sureler, [80, 90]);
  assert.equal(artan, 20);
});
kontrol('Dolmuyorsa: hepsi en uzunda, artan negatif', () => {
  const { sureler, artan } = dagit([{ sure: 100, min: 80, max: 120 }], 200);
  assert.deepEqual(sureler, [120]);
  assert.equal(artan, -80);
});
kontrol('Su doldurma seviyesi', () => {
  assert.deepEqual(suDoldur([10, 100, 100], 150), [10, 70, 70]);
  assert.deepEqual(suDoldur([0, 50], 20), [0, 20]);
  assert.deepEqual(suDoldur([30, 30, 30], 90), [30, 30, 30]);
});
kontrol('Tam saniyeye yuvarlama toplamı korur', () => {
  const s = tamYuvarla([10.4, 10.4, 10.2], 31, [0, 0, 0], [99, 99, 99]);
  assert.equal(toplam(s), 31);
  assert.deepEqual(s, [11, 10, 10]);
});
kontrol('3000 rastgele durum: toplam, sınırlar ve kip kuralları', () => {
  let tohum = 7;
  const r = () => { tohum ^= tohum << 13; tohum >>>= 0; tohum ^= tohum >>> 17; tohum ^= tohum << 5; tohum >>>= 0; return tohum / 4294967296; };
  for (let k = 0; k < 3000; k++) {
    const n = 1 + Math.floor(r() * 8);
    const p = Array.from({ length: n }, () => {
      const sure = 10 + Math.floor(r() * 500);
      return r() < 0.3 ? { sure, min: sure, max: sure } : { sure, min: Math.floor(sure * r()), max: sure + Math.floor(r() * 300) };
    });
    const plan = toplam(p.map(x => x.sure));
    const hedef = Math.max(0, plan + Math.floor((r() - 0.5) * plan));
    for (const kip of ['oranli', 'esit']) {
      const { sureler, artan } = dagit(p, hedef, kip);
      sureler.forEach((s, i) => { assert.ok(Number.isInteger(s)); assert.ok(s >= p[i].min && s <= p[i].max, `sınır ${k}`); });
      assert.equal(toplam(sureler) - artan, hedef, `toplam ${k} ${kip}`);   // artan: hedefi ne kadar aştığı
      // Kısalırken hiçbir bölüm uzamaz, uzarken hiçbiri kısalmaz
      sureler.forEach((s, i) => { if (hedef < plan) assert.ok(s <= p[i].sure); if (hedef > plan) assert.ok(s >= p[i].sure); });
      if (artan > 0) sureler.forEach((s, i) => assert.equal(s, p[i].min));
      if (artan < 0) sureler.forEach((s, i) => assert.equal(s, p[i].max));
    }
  }
});

// ---------- Plan ----------
kontrol('Sabit bölümün sınırı kendisi', () => assert.deepEqual(sinirlar({ sure: 180, esnek: false, min: 10, max: 900 }), { sure: 180, min: 180, max: 180 }));
kontrol('Ters yazılmış sınırlar düzelir', () => assert.deepEqual(sinirlar({ sure: 100, esnek: true, min: 150, max: 50 }), { sure: 100, min: 100, max: 100 }));
kontrol('Örnek plan tam 50 dakika', () => {
  const o = planOzet(ORNEK);
  assert.equal(o.pencere, 3000);
  assert.equal(o.fark, 0);
  assert.ok(o.enKisa < o.pencere && o.enUzun > o.pencere);
});

// ---------- Canlı durum ----------
kontrol('Başlamadan önce: plan aynen', () => {
  const d = durum(ORNEK, [], ORNEK.baslangic - 600);
  assert.equal(d.asama, 'once');
  assert.deepEqual(d.gelecek.map(g => g.yeni), ORNEK.bolumler.map(b => b.sure));
  assert.equal(d.sapma, 0);
});
kontrol('Örnek: 2 dk 42 sn gecikme esnek bölümlerden alınır, yayın tam saatinde biter', () => {
  const d = durum(ORNEK, ORNEK_KAYIT, ORNEK_SAAT);
  assert.equal(d.asama, 'canli');
  assert.equal(toplam(d.bitenler.map(b => b.fark)), 162);
  assert.equal(d.simdiki.ad, 'Reklam arası');
  assert.equal(d.simdiki.gecen, 75);
  assert.equal(d.sapma, 0);
  assert.equal(d.gelecek.at(-1).biter, ORNEK.bitis);
  const kisalan = d.gelecek.filter(g => g.fark < 0);
  assert.deepEqual(kisalan.map(g => g.ad), ['Seyirci soruları', 'Sohbet', 'Teşekkür ve kapanış']);
  assert.equal(-toplam(kisalan.map(g => g.fark)), 162);
  for (const g of d.gelecek) if (!g.esnek) assert.equal(g.fark, 0, g.ad);
});
kontrol('Bölümler arka arkaya, boşluksuz', () => {
  const d = durum(ORNEK, ORNEK_KAYIT, ORNEK_SAAT, 'esit');
  for (let j = 1; j < d.gelecek.length; j++) assert.equal(d.gelecek[j].baslar, d.gelecek[j - 1].biter);
});
kontrol('En geç başlama: sonrası en kısada bile tam biter', () => {
  const d = durum(ORNEK, ORNEK_KAYIT, ORNEK_SAAT);
  for (const g of d.gelecek.slice(1)) {
    const sonrakiler = ORNEK.bolumler.slice(g.i).map(b => sinirlar(b).min);
    assert.equal(g.enGec + toplam(sonrakiler), ORNEK.bitis);
    assert.ok(g.baslar <= g.enGec);
  }
});
kontrol('Esnek bölüm sürerken: geçen süre yenisine dahil', () => {
  // Röportaj (7:00, 3:00–9:00) 2 dakikadır sürüyor, kimse gecikmedi
  const k = [ORNEK.baslangic + 60, ORNEK.baslangic + 210, ORNEK.baslangic + 465];
  const d = durum(ORNEK, k, k[2] + 120);
  assert.equal(d.simdiki.yeni, 420);
  assert.equal(d.simdiki.kalan, 300);
  assert.equal(d.sapma, 0);
});
kontrol('Sabit bölüm uzarsa (canlı bağlantı koptu): taşıyor işareti ve kalanlar kısalır', () => {
  const k = [ORNEK.baslangic + 60, ORNEK.baslangic + 210];
  const d = durum(ORNEK, k, k[1] + 255 + 90);   // 1. sahne 1:30 fazladan sürüyor
  assert.equal(d.simdiki.tasiyor, true);
  assert.equal(d.simdiki.kalan, 0);
  assert.equal(d.sapma, 0);
  assert.equal(-toplam(d.gelecek.slice(1).map(g => g.fark)), 90);
});
kontrol('Hiçbir esneklik yetmiyorsa: sapma pozitif', () => {
  const k = [ORNEK.baslangic + 60 + 1200];   // açılış jeneriği 20 dakika uzamış (!)
  const d = durum(ORNEK, k, k[0] + 1);
  assert.ok(d.artan > 0);
  assert.equal(d.sapma, d.artan);
  for (const g of d.gelecek.slice(1)) assert.equal(g.yeni, sinirlar(ORNEK.bolumler[g.i]).min);
});
kontrol('Erken biterse esnek bölümler uzar', () => {
  const k = [ORNEK.baslangic + 60, ORNEK.baslangic + 60 + 60];   // karşılama 2:30 yerine 1:00
  const d = durum(ORNEK, k, k[1]);
  assert.equal(d.sapma, 0);
  assert.equal(toplam(d.gelecek.map(g => g.fark)), 90);
});
kontrol('Bitti', () => {
  let t = ORNEK.baslangic; const k = ORNEK.bolumler.map(b => (t += b.sure));
  const d = durum(ORNEK, k, t + 5);
  assert.equal(d.asama, 'bitti');
  assert.equal(d.sapma, 0);
  assert.equal(d.bitenler.length, ORNEK.bolumler.length);
});
kontrol('Saat bölümün başından önceyse geçen 0', () => {
  const d = durum(ORNEK, [ORNEK.baslangic + 60], ORNEK.baslangic + 30);
  assert.equal(d.simdiki.gecen, 0);
});

kontrol('Kesirli saniyeli kayıt hayalet sapma doğurmaz', () => {
  // Reklam (sabit, 3:00) 30,4 sn erken kesildi; saat kesirli
  const k = [...ORNEK_KAYIT, ORNEK_KAYIT[3] + 149.6];
  const d = durum(ORNEK, k, k[4] + 10.37);
  assert.equal(d.sapma, 0);
  assert.equal(d.artan, 0);
  for (const g of d.gelecek) assert.ok(Number.isInteger(g.yeni) && Number.isInteger(g.baslar), g.ad);
});

console.log(`${sayac} kontrol geçti.`);
