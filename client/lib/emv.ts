export type EMVTree = {
  value?: string;
  nodes?: Record<string, EMVTree | any>;
};

export type EMVParsed = {
  currency?: string; // e.g. RUB
  amount?: number;   // RUB
  merchant?: string;
  city?: string;
  account?: string; // from 26.xx (01/02)
  additional: Record<string, string>;
  raw?: string;
};

function safeNumber(n: string | undefined | null): number | undefined {
  if (!n) return undefined;
  const x = Number(n.replace(",", "."));
  return Number.isFinite(x) ? x : undefined;
}

function isLikelyEMV(s: string) {
  // Typical dynamic EMV starts with 000201... but some payloads may have noise around
  return /\b00020101/.test(s) || /^[0-9]{6}/.test(s);
}

/**
 * Generic EMV TLV parser (2-digit tag, 2-digit length, value)
 */
function parseTLV(input: string): { tree: EMVTree; rest: string } {
  let i = 0;
  const root: EMVTree = { nodes: {} };

  const read = (len: number) => {
    const part = input.slice(i, i + len);
    i += len;
    return part;
  };

  const parseNode = (limit: number): EMVTree => {
    const node: EMVTree = { nodes: {} };
    let consumed = 0;
    while (consumed < limit && i + 4 <= input.length) {
      const tag = read(2);
      const lenStr = read(2);
      if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) {
        // not TLV, bail
        break;
      }
      const l = parseInt(lenStr, 10);
      const val = read(l);
      consumed += 4 + l;

      // Composite templates (like 26 Merchant Account Information) also use 2-2-L TLV inside
      if (/^(26|62)$/.test(tag)) {
        // parse nested TLV
        let j = 0;
        const inner: Record<string, any> = {};
        while (j + 4 <= val.length) {
          const t = val.slice(j, j + 2);
          const ln = parseInt(val.slice(j + 2, j + 4), 10);
          const vv = val.slice(j + 4, j + 4 + ln);
          inner[t] = vv;
          j += 4 + ln;
        }
        (node.nodes as any)[tag] = inner;
      } else {
        (node.nodes as any)[tag] = val;
      }
    }
    return node;
  };

  // If input looks like EMV but may include noise, try to locate the start
  let start = input.search(/000201/);
  if (start === -1) start = 0;
  i = start;

  const maybePayloadLenTag = input.slice(i, i + 2);
  if (!/^\d{2}$/.test(maybePayloadLenTag)) {
    // give up with empty tree
    return { tree: root, rest: input.slice(i) };
  }

  // Try to greedily parse until CRC (63)
  // Find total length roughly by scanning for 6304
  const idx63 = input.indexOf("6304", i);
  let totalLen = idx63 > -1 ? (idx63 - i) + 8 : input.length - i;
  if (totalLen < 0) totalLen = input.length - i;

  const parsed = parseNode(totalLen);
  root.nodes = parsed.nodes;
  return { tree: root, rest: input.slice(i + totalLen) };
}

export function parseEMVQR(raw: string): EMVParsed | null {
  if (!raw || !isLikelyEMV(raw)) return null;
  try {
    const { tree } = parseTLV(raw);
    const nodes = tree.nodes || {};

    const currency = (nodes["58"] || "RUB") as string;
    const amountStr = nodes["54"] as string | undefined;
    const merchant = nodes["59"] as string | undefined;
    const city = nodes["60"] as string | undefined;

    let account = "";
    if (nodes["26"]) {
      const m = nodes["26"] as Record<string, string>;
      // Common sub-tags:
      // 01 – Globally Unique Identifier (GUID) / SBP ID
      // 02 – Merchant PAN / Account
      account = m["02"] || m["01"] || "";
    }

    const additional: Record<string, string> = {};
    if (nodes["62"]) {
      const extra = nodes["62"] as Record<string, string>;
      if (extra["01"]) additional.order_id = extra["01"];
      if (extra["05"]) additional.terminal_id = extra["05"];
      if (extra["07"]) additional.customer_id = extra["07"];
      if (extra["08"]) additional.loyalty_number = extra["08"];
    }

    const out: EMVParsed = {
      currency,
      amount: safeNumber(amountStr),
      merchant,
      city,
      account,
      additional,
      raw,
    };
    return out;
  } catch {
    return null;
  }
}

export function parseSBPLink(raw: string): {
  raw: string;
  sbp: true;
  host: string;
  type?: string;
  bank?: string;
  currency?: string;
  amount?: number;
  crc?: string;
} | null {
  try {
    if (!raw) return null;
    // Extract https://qr.nspk.ru even from intent://… or noisy wrapper
    const m = raw.match(/https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9/_-]+(?:\?[^ \n\r<">#]*)?/i);
    if (!m) return null;
    const u = new URL(m[0]);
    const host = u.hostname.toLowerCase();
    if (host !== "qr.nspk.ru") return null;

    const get = (k: string) =>
      u.searchParams.get(k) ?? u.searchParams.get(k.toUpperCase());
    const type = get("type") ?? undefined;
    const bank = get("bank") ?? undefined;
    const cur = (get("cur") ?? "RUB").toUpperCase();
    const sumStr = get("sum") ?? get("amount") ?? get("amt");
    const kop = sumStr ? Number(sumStr) : NaN;
    const amountRub =
      Number.isFinite(kop) ? Math.round(kop as number) / 100 : undefined;
    const crc = get("crc") ?? undefined;

    return {
      raw: u.toString(),
      sbp: true,
      host,
      type,
      bank,
      currency: cur,
      amount: amountRub,
      crc,
    };
  } catch {
    return null;
  }
}
