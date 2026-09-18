import "server-only";

/**
 * GST-based business lookup, backed by gstincheck.co.in
 * (https://documenter.getpostman.com/view/66843/2sBXirj8Lf) — a plain
 * GET request with an API key in the path, no captcha or session dance
 * (unlike GSTVerify, which requires a per-request solved captcha and was
 * ruled out for that reason).
 *
 * Swapping providers again means rewriting only the body of lookupGstin —
 * every caller (ASM add-dealer/add-sub-dealer forms) depends solely on this
 * function's signature and GstLookupResult shape.
 */

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/;

export type GstLookupResult =
  | {
      ok: true;
      data: {
        legalName: string;
        tradeName: string;
        gstStatus: string;
        registeredAt: string; // ISO date
        address: string;
        city: string;
        state: string;
        pincode: string;
      };
    }
  | { ok: false; error: string };

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_PATTERN.test(gstin.toUpperCase());
}

/** DD/MM/YYYY (as returned by gstincheck.co.in) -> ISO date, or "" through unchanged. */
function toIsoDate(ddmmyyyy: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

type GstincheckAddr = {
  adr?: string;
  loc?: string;
  stcd?: string;
  pncd?: string;
};

type GstincheckResponse = {
  flag: boolean;
  message: string;
  errorCode?: string;
  data?: {
    lgnm?: string;
    tradeNam?: string;
    sts?: string;
    rgdt?: string;
    pradr?: { adr?: string; addr?: GstincheckAddr };
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  GSTNUMBER_NOT_FOUND: "No business found for that GSTIN.",
  INVALID_GSTNUMBER: "That doesn't look like a valid GSTIN.",
  GST_SERVER_NOT_RESPOND: "The GST lookup service is under maintenance. Try again shortly.",
  CREDIT_NOT_AVAILABLE: "GST lookup credits are exhausted. Enter details manually or top up credits.",
  API_KEY_INVALID: "GST lookup is misconfigured (invalid API key). Enter details manually.",
  REQUEST_IN_PROGRESS: "A lookup is already in progress. Try again in a moment.",
  SERVER_ERROR: "GST lookup failed. Try again or enter details manually.",
  PROCESS_ERROR_RETRY: "GST lookup failed. Try again.",
};

export async function lookupGstin(gstinRaw: string): Promise<GstLookupResult> {
  const gstin = gstinRaw.trim().toUpperCase();

  if (!isValidGstinFormat(gstin)) {
    return {
      ok: false,
      error: "That doesn't look like a valid 15-character GSTIN.",
    };
  }

  const apiKey = process.env.GSTINCHECK_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GST lookup is not configured. Enter details manually." };
  }

  let res: Response;
  try {
    res = await fetch(`https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`, {
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach the GST lookup service. Enter details manually." };
  }

  if (!res.ok) {
    return { ok: false, error: "GST lookup failed. Enter details manually." };
  }

  const body = (await res.json()) as GstincheckResponse;

  if (!body.flag || !body.data) {
    const message = body.errorCode ? ERROR_MESSAGES[body.errorCode] : undefined;
    return { ok: false, error: message ?? body.message ?? "GST lookup failed." };
  }

  const d = body.data;
  const addr = d.pradr?.addr ?? {};

  return {
    ok: true,
    data: {
      legalName: d.lgnm ?? "",
      tradeName: d.tradeNam ?? d.lgnm ?? "",
      gstStatus: d.sts ?? "Unknown",
      registeredAt: toIsoDate(d.rgdt ?? ""),
      address: d.pradr?.adr ?? "",
      city: addr.loc ?? "",
      state: addr.stcd ?? "",
      pincode: addr.pncd ?? "",
    },
  };
}
