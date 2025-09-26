/**
 * EMV QR Parser with support for Additional Data Field Template (62.xx)
 */
export type EmvNode = Record<string, any>;

function readPair(input: string, idx: number) {
  const id = input.slice(idx, idx + 2);
  const len = parseInt(input.slice(idx + 2, idx + 4), 10);
  const start = idx + 4;
  const end = start + len;
  const value = input.slice(start, end);
  return { id, len, value, end };
}

function isTemplate(id: string) {
  const n = Number(id);
  return (n >= 26 && n <= 51) || id === "62";
}

function parseNSPKUrlAmount(raw: string): number | undefined {
  try {
    const u = new URL(raw);
    if (u.hostname.includes('qr.nspk.ru')) {
      const sum = u.searchParams.get('sum');
      const amount = u.searchParams.get('amount');
      if (sum && /^\d+$/.test(sum)) return Number(sum)/100;
      if (amount) return Number(amount.replace(',', '.'));
    }
  } catch (_) {}
  return undefined;
}
export function parseEMVQR(raw: string): EmvNode {
  const cleaned = raw.replace(/\s+/g, "");
  if (!/^\d{4,}$/.test(cleaned)) {
    const info: EmvNode = { raw };
    const m = cleaned.match(/(?:amount|sum|amt|s|a)[=:]([0-9]+(?:[.,][0-9]+)?)/i);
    if (m) info.amount = Number(m[1].replace(",", "."));
    const nspk = parseNSPKUrlAmount(raw);
    if (nspk !== undefined) info.amount = nspk;
    return info;
  }

  let idx = 0;
  const root: EmvNode = { _raw: cleaned, nodes: {} };
  while (idx + 4 <= cleaned.length) {
    const { id, value, end } = readPair(cleaned, idx);
    if (isTemplate(id)) {
      let j = 0, child: EmvNode = {};
      while (j + 4 <= value.length) {
        const sub = readPair(value, j);
        child[sub.id] = sub.value;
        j = sub.end;
      }
      root.nodes[id] = child;
    } else {
      root.nodes[id] = value;
    }
    idx = end;
  }

  const currency = root.nodes["53"];
  const amount = root.nodes["54"] ? Number(root.nodes["54"]) : undefined;
  const merchant = root.nodes["59"];
  const city = root.nodes["60"];

  let account = undefined;
  for (let i = 26; i <= 51; i++) {
    const key = String(i).padStart(2, "0");
    if (root.nodes[key]) {
      const node = root.nodes[key];
      const parts: string[] = [];
      Object.keys(node).sort().forEach(k => parts.push(`${k}:${node[k]}`));
      account = parts.join("; ");
      break;
    }
  }

  let additional: any = {};
  if (root.nodes["62"]) {
    const node = root.nodes["62"];
    if (node["01"]) additional.order_id = node["01"];
    if (node["05"]) additional.terminal_id = node["05"];
    if (node["07"]) additional.customer_id = node["07"];
    if (node["08"]) additional.loyalty_number = node["08"];
  }

  return { raw, currency, amount, merchant, city, account, additional, nodes: root.nodes };
}


/**
 * Lightweight parser for SBP (NSPK) functional link:
 * https://qr.nspk.ru/QR_ID?type=01&bank=000000000001&sum=10000&cur=RUB&crc=ABCD
 * sum — amount in kopecks (e.g. 10000 => 100.00 RUB)
 */
export function parseSBPLink(raw: string) {
  try {
    const u = new URL(raw);
    const hostOk = /(^|\.)qr\.nspk\.ru$/i.test(u.hostname) || /(^|\.)sub\.nspk\.ru$/i.test(u.hostname);
    if (!hostOk) return null;
    const params = u.searchParams;
    const type = params.get("type") || undefined;
    const bank = params.get("bank") || undefined;
    const sumStr = params.get("sum");
    const cur = (params.get("cur") || "RUB").toUpperCase();
    const crc = params.get("crc") || undefined;

    let amountRub: number | null = null;
    if (sumStr && /^\d+$/.test(sumStr)) {
      // kopecks to RUB
      amountRub = Number(sumStr) / 100;
    }

    return {
      raw,
      sbp: true,
      host: u.hostname,
      type,
      bank,
      currency: cur,
      amount: amountRub, // in RUB
      crc,
    };
  } catch {
    return null;
  }
}
