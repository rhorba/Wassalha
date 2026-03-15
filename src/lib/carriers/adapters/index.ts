import { AmanaAdapter }     from "./amana";
import { AramexAdapter }    from "./aramex";
import { CtmAdapter }       from "./ctm";
import { MarocolisAdapter } from "./marocolis";
import { SendexAdapter }    from "./sendex";
import type { CarrierAdapter } from "../types";

const adapters: Record<string, CarrierAdapter> = {
  amana:     new AmanaAdapter(),
  aramex:    new AramexAdapter(),
  ctm:       new CtmAdapter(),
  marocolis: new MarocolisAdapter(),
  sendex:    new SendexAdapter(),
};

export function getAdapter(slug: string): CarrierAdapter {
  const adapter = adapters[slug];
  if (!adapter) throw new Error(`No adapter registered for carrier slug: "${slug}"`);
  return adapter;
}
