import { createContext, useContext } from "react";

/** Set only when Shadowfax auth gate is on and the user is signed in. */
export const ShadowfaxSessionContext = createContext(null);

export function useShadowfaxSession() {
  return useContext(ShadowfaxSessionContext);
}
