import type { MDXComponents } from "mdx/types";
import { Callout } from "./components/ui/Callout";
import { Mermaid } from "./components/ui/Mermaid";
import { BrowserFrame } from "./components/mock/BrowserFrame";
import { AdminShell } from "./components/mock/AdminShell";
import { PublicSiteShell } from "./components/mock/PublicSiteShell";
import { KdsScreen } from "./components/mock/screens/KdsScreen";
import { PixCheckoutScreen } from "./components/mock/screens/PixCheckoutScreen";
import { AiApprovalsScreen } from "./components/mock/screens/AiApprovalsScreen";
import { CardapioScreen } from "./components/mock/screens/CardapioScreen";
import { EncomendaAdminScreen } from "./components/mock/screens/EncomendaAdminScreen";
import { CampaignFormScreen } from "./components/mock/screens/CampaignFormScreen";
import { PriceHistoryScreen } from "./components/mock/screens/PriceHistoryScreen";
import { ProductionPlanScreen } from "./components/mock/screens/ProductionPlanScreen";
import { AbandonedCartScreen } from "./components/mock/screens/AbandonedCartScreen";
import { NpsScreen } from "./components/mock/screens/NpsScreen";
import { PurchaseImpactScreen } from "./components/mock/screens/PurchaseImpactScreen";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Callout,
    Mermaid,
    BrowserFrame,
    AdminShell,
    PublicSiteShell,
    KdsScreen,
    PixCheckoutScreen,
    AiApprovalsScreen,
    CardapioScreen,
    EncomendaAdminScreen,
    CampaignFormScreen,
    PriceHistoryScreen,
    ProductionPlanScreen,
    AbandonedCartScreen,
    NpsScreen,
    PurchaseImpactScreen,
    ...components,
  };
}
