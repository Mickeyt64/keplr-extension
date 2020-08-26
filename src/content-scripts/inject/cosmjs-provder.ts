import {
  OfflineSigner,
  AccountData,
  PrehashType,
  StdSignature,
  InProcessOnlineSigner,
  BroadcastMode,
  SignRequest,
  BroadcastTxResult,
  Coin
} from "@cosmjs/launchpad";

import { Coin as CosmosJsCoin } from "@everett-protocol/cosmosjs/common/coin";

import { Keplr } from "./common";

import {
  GetKeyMsg,
  RequestSignMsg,
  RequestTxBuilderConfigMsg
} from "../../background/keyring";
import { sendMessage } from "../../common/message/send";
import { BACKGROUND_PORT } from "../../common/message/constant";
import { toBase64 } from "@cosmjs/encoding";

const Buffer = require("buffer/").Buffer;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Manifest = require("../../manifest.json");

type Mutable<T extends object> = {
  -readonly [K in keyof T]: T[K];
};

export class CosmJSOnlineSigner extends InProcessOnlineSigner {
  constructor(
    public readonly chainId: string,
    apiUrl: string,
    broadcastMode = BroadcastMode.Block
  ) {
    super(new CosmJSOfflineSigner(chainId), apiUrl, broadcastMode);
  }

  async enable(): Promise<boolean> {
    // If enabling is rejected, it will throw an error.
    await Keplr.enable(this.chainId);
    // When we should return false?
    return true;
  }

  async signAndBroadcast(
    address: string,
    request: SignRequest
  ): Promise<BroadcastTxResult> {
    // this.getSequence is the private method currently.
    // But, in the prototype, just use it by ignoring type-checking.
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    const { accountNumber, sequence } = await this.getSequence(address);

    if (!request.fee?.gas) {
      throw new Error(
        "Please, set gas explicitly. Gas adjustment is not supported yet"
      );
    }

    const random = new Uint8Array(4);
    crypto.getRandomValues(random);
    const id = Buffer.from(random).toString("hex");

    const msg = new RequestTxBuilderConfigMsg(
      {
        chainId: this.chainId,
        accountNumber,
        sequence,
        memo: request.memo || "",
        gas: request.fee.gas,
        fee: CosmJSOnlineSigner.coinsToString(request.fee?.amount)
      },
      id,
      true,
      window.location.origin
    );

    const txBuilderConfig = await sendMessage(BACKGROUND_PORT, msg);

    const resultRequest: Mutable<SignRequest> = request;

    resultRequest.fee = {
      gas: txBuilderConfig.config.gas,
      amount: txBuilderConfig.config.fee
        .split(",")
        .map(str => CosmosJsCoin.parse(str))
        .map(coin => {
          return {
            denom: coin.denom,
            amount: coin.amount.toString()
          };
        })
    };
    resultRequest.memo = txBuilderConfig.config.memo;

    return await super.signAndBroadcast(address, resultRequest);
  }

  private static coinsToString(coins: readonly Coin[] | undefined): string {
    if (coins === undefined) {
      return "";
    }

    return coins.map(coin => `${coin.amount} ${coin.denom}`).join(",");
  }
}

export class CosmJSOfflineSigner implements OfflineSigner {
  public readonly identifier: string = "keplr-extension";
  public readonly version: string = Manifest.version;

  constructor(public readonly chainId: string) {}

  async getAccounts(): Promise<AccountData[]> {
    const msg = new GetKeyMsg(this.chainId, window.location.origin);
    const key = await sendMessage(BACKGROUND_PORT, msg);

    if (
      key.algo !== "secp256k1" &&
      key.algo !== "ed25519" &&
      key.algo !== "sr25519"
    ) {
      throw new Error("Unknown key algo");
    }

    return Promise.resolve([
      {
        algo: key.algo,
        address: key.bech32Address,
        pubkey: new Uint8Array(Buffer.from(key.pubKeyHex, "hex"))
      }
    ]);
  }

  async sign(
    address: string,
    message: Uint8Array,
    prehashType: PrehashType = "sha256"
  ): Promise<StdSignature> {
    if (prehashType !== "sha256") {
      throw new Error("Unsupported prehash type");
    }

    const random = new Uint8Array(4);
    crypto.getRandomValues(random);
    const id = Buffer.from(random).toString("hex");

    const requestSignMsg = new RequestSignMsg(
      this.chainId,
      id,
      address,
      Buffer.from(message).toString("hex"),
      true,
      window.location.origin
    );

    const result = await sendMessage(BACKGROUND_PORT, requestSignMsg);

    const msg = new GetKeyMsg(this.chainId, window.location.origin);
    const key = await sendMessage(BACKGROUND_PORT, msg);

    return {
      // eslint-disable-next-line @typescript-eslint/camelcase
      pub_key: {
        type: "tendermint/PubKeySecp256k1",
        value: toBase64(Buffer.from(key.pubKeyHex, "hex"))
      },
      signature: toBase64(Buffer.from(result.signatureHex, "hex"))
    };
  }
}
