import {
  BadgeIndianRupee,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plus,
  Settings2,
  Truck,
  Users,
} from "lucide-react";

/** Lucide at h-5 w-5 for nav, per the design system. */
const cls = "h-5 w-5";

export const Icons = {
  home: <LayoutDashboard className={cls} />,
  orders: <ClipboardList className={cls} />,
  plus: <Plus className={cls} />,
  masters: <Boxes className={cls} />,
  pricing: <BadgeIndianRupee className={cls} />,
  stock: <Boxes className={cls} />,
  invoice: <FileText className={cls} />,
  truck: <Truck className={cls} />,
  users: <Users className={cls} />,
  settings: <Settings2 className={cls} />,
  check: <CheckCircle2 className={cls} />,
};
