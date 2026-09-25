export type DealerOption = {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string | null;
  contactNo: string | null;
  gstin: string | null;
  creditLimit: string | null;
  creditDays: number | null;
};

export type OemOption = { id: string; code: string; name: string };

export type TransporterOption = { id: string; code: string; name: string };

export type SchemeOption = {
  id: string;
  code: string;
  name: string;
  discountPct: string | null;
  flatAmount: string | null;
};

export type WizardConfig = {
  minDealerPct: string;
  maxDealerPct: string;
};

export type DealerDetail = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNo: string | null;
  priceTierId: string | null;
  subDealers: {
    id: string;
    name: string;
    address: string | null;
    contactNo: string | null;
  }[];
  printingFrames: {
    id: string;
    label: string;
    isDefault: boolean;
    mode: "IMAGE" | "CONTENT";
    fileAssetId: string | null;
    contentText: string | null;
    contentLanguage: string | null;
    withOemLogo: boolean | null;
  }[];
};
