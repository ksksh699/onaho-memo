// 「合計使用金額をほかの物に換算する」ための一覧と計算(2026-09-08に mypage.astro から分離)。
// マイページの換算表示と、合計使用金額のシェア画像(src/pages/og/spend.png.js)の両方で使う。

export const MONEY_COMPARISON_ITEMS = [
  { name: '缶コーヒー', price: 130, unit: '本' },
  { name: 'ガチャガチャ', price: 300, unit: '回' },
  { name: 'コンビニおにぎり', price: 150, unit: '個' },
  { name: '牛丼(並盛)', price: 480, unit: '杯' },
  { name: 'カフェのコーヒー', price: 500, unit: '杯' },
  { name: '週刊少年マンガ誌', price: 290, unit: '冊' },
  { name: 'ラーメン', price: 900, unit: '杯' },
  { name: '文庫本', price: 700, unit: '冊' },
  { name: '映画館(1回)', price: 2000, unit: '回' },
  { name: '焼肉食べ放題', price: 4000, unit: '回' },
  { name: 'コミック全巻セット(20巻)', price: 12000, unit: 'セット' },
  { name: 'ワイヤレスイヤホン', price: 25000, unit: '個' },
  { name: 'Nintendo Switch 2', price: 49980, unit: '台' },
  { name: '電動アシスト自転車', price: 120000, unit: '台' },
  { name: 'PlayStation 5', price: 79980, unit: '台' },
  { name: 'iPhone 17', price: 139800, unit: '台' },
  { name: 'iPhone 17 Pro', price: 179800, unit: '台' },
  { name: '高性能ゲーミングPC', price: 250000, unit: '台' },
  { name: '大型有機ELテレビ(65インチ)', price: 350000, unit: '台' },
  { name: '海外旅行(1週間)', price: 300000, unit: '回' },
  { name: '国内旅行(3泊4日)', price: 100000, unit: '回' },
  { name: 'ハイエンドノートPC', price: 300000, unit: '台' },
  { name: 'ブランドバッグ', price: 350000, unit: '個' },
  { name: 'ブランド腕時計', price: 400000, unit: '本' },
  { name: '中古の軽自動車', price: 800000, unit: '台' },
  { name: '都内ワンルームの年間家賃', price: 1200000, unit: '年分' },
  { name: 'ハイブランド腕時計', price: 1500000, unit: '本' },
  { name: '新車(コンパクトカー)', price: 2000000, unit: '台' },
  { name: '新車(ミニバン)', price: 3500000, unit: '台' },
  { name: '結婚式の平均費用', price: 3000000, unit: '回分' },
  { name: '新車(高級セダン)', price: 6000000, unit: '台' },
  { name: '中古マンション(郊外)', price: 30000000, unit: '戸' },
];

export function moneyComparisonPicks(amount, count = 6) {
  if (!amount) return [];
  // 価格が安い順に並べ、その中から等間隔にcount件選ぶことで、
  // 少額〜高額まで幅広い「解像度」で例えを見せる
  const sorted = MONEY_COMPARISON_ITEMS.map((it) => ({ ...it, ratio: amount / it.price })).sort(
    (a, b) => a.price - b.price
  );
  if (sorted.length <= count) return sorted;
  const picks = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (count - 1));
    picks.push(sorted[idx]);
  }
  const seen = new Set();
  return picks.filter((it) => {
    if (seen.has(it.name)) return false;
    seen.add(it.name);
    return true;
  });
}

export function formatMoneyComparison(it) {
  if (it.ratio >= 1) {
    const count = it.ratio >= 10 ? Math.round(it.ratio) : Math.round(it.ratio * 10) / 10;
    return `${it.name} 約${count.toLocaleString()}${it.unit}分`;
  }
  const percent = Math.max(1, Math.round(it.ratio * 100));
  return `${it.name}の約${percent}%`;
}

