/**
 * EMV QR Parser (subset for SBP)
 * Format: [ID(2)][LEN(2)][VALUE(LEN)]...
 * Supports nested templates (IDs 26-51 for Merchant Account Info, 62 for additional)
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

export function parseEMVQR(raw: string): EmvNode {
  // Remove non-digits for robustness (EMV is numeric), but keep letters for SBP urls (fallback)
  const cleaned = raw.replace(/\s+/g, "");
  // When payload is not pure EMV (e.g. bank URL), return minimal info
  if (!/^\d{4,}$/.test(cleaned)) {
    const info: EmvNode = { raw };
    // try amount param
    const m = cleaned.match(/(?:amount|sum|amt|s|a)[=:]([0-9]+(?:[.,][0-9]+)?)/i);
    if (m) info.amount = Number(m[1].replace(",", "."));
    return info;
  }

  let idx = 0;
  const root: EmvNode = { _raw: cleaned, nodes: {} };
  while (idx + 4 <= cleaned.length) {
    const { id, value, end } = readPair(cleaned, idx);
    if (isTemplate(id)) {
      // parse nested
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

  // Map common fields
  const currency = root.nodes["53"];
  const amount = root.nodes["54"] ? Number(root.nodes["54"]) : undefined;
  const merchant = root.nodes["59"];
  const city = root.nodes["60"];
  // try account info from 26..51
  let account = undefined;
  for (let i = 26; i <= 51; i++) {
    const key = String(i).padStart(2, "0");
    if (root.nodes[key]) {
      const node = root.nodes[key];
      // SBP often puts bank id in 00, account in 01/02 etc
      const parts: string[] = [];
      Object.keys(node).sort().forEach(k => parts.push(`${k}:${node[k]}`));
      account = parts.join("; ");
      break;
    }
  }

  return {
    raw,
    currency,
    amount,
    merchant,
    city,
    account,
    nodes: root.nodes
  };
}
