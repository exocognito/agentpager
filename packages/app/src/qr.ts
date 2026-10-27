import QRCode from 'qrcode';
// qrcode's browser entry only renders SVG; terminal output must use its actual encoded matrix.
export function terminalQr(url: string) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const margin = 4, size = modules.size + margin * 2;
  const dark = (x: number, y: number) => x >= margin && x < size - margin && y >= margin && y < size - margin && modules.get(y - margin, x - margin) === 1;
  const rows: string[] = [];
  for (let y = 0; y < size; y += 2) {
    let line = '';
    for (let x = 0; x < size; x++) {
      const top = dark(x, y), bottom = dark(x, y + 1);
      line += top ? bottom ? '█' : '▀' : bottom ? '▄' : ' ';
    }
    rows.push(line);
  }
  return rows.join('\n');
}
