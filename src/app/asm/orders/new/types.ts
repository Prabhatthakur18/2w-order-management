export type DealerOption = {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNo: string;
  creditLimit: string | null;
  creditDays: number | null;
};

export type OemOption = { id: string; code: string; name: string };

export type SchemeOption = {
  id: string;
  code: string;
  name: string;
  discountPct: string | null;
  flatAmount: string | null;
};

export type WizardConfig = {
  maxCombinedPct: string;
  approvalAbovePct: string;
  allowStacking: boolean;
};

export type DealerDetail = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNo: string;
  priceTierId: string | null;
  subDealers: {
    id: string;
    name: string;
    address: string;
    contactNo: string;
  }[];
  printingFrames: {
    id: string;
    label: string;
    isDefault: boolean;
    fileAssetId: string;
  }[];
};
