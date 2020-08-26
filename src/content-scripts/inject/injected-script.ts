import { InjectedCosmosJSWalletProvider } from "./cosmosjs-provider";
import { CosmJSOnlineSigner } from "./cosmjs-provder";
import { Keplr } from "./common";
import { BroadcastMode } from "@cosmjs/launchpad";

// Give a priority to production build.
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  if (!window.keplr) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    window.keplr = Keplr;
  }

  if (!window.cosmosJSWalletProvider) {
    window.cosmosJSWalletProvider = new InjectedCosmosJSWalletProvider();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  if (!window.getCosmJSWalletProvider) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    window.getCosmJSOnlineSigner = (
      chainId: string,
      apiUrl: string,
      broadcastMode: BroadcastMode = BroadcastMode.Block
    ) => {
      return new CosmJSOnlineSigner(chainId, apiUrl, broadcastMode);
    };
  }
} else {
  window.cosmosJSWalletProvider = new InjectedCosmosJSWalletProvider();
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  window.getCosmJSOnlineSigner = (
    chainId: string,
    apiUrl: string,
    broadcastMode: BroadcastMode = BroadcastMode.Block
  ) => {
    return new CosmJSOnlineSigner(chainId, apiUrl, broadcastMode);
  };
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  window.keplr = Keplr;
}
