import { Convert } from "pvtsutils";

import { Server, Session } from "../../connection/server";
import { ServiceCryptoItem } from "../crypto_item";
import { CryptoService } from "./crypto";
import { Service } from "./service";

import { ActionProto, ResultProto } from "../../core/proto";
import { ArrayStringConverter } from "../../core/protos/converter";
import * as P from "../../core/protos/keystorage";
import { WebCryptoLocalError } from "../error";
import { PvCrypto } from "../pv_crypto/crypto";

export class KeyStorageService extends Service<CryptoService> {

    constructor(server: Server, crypto: CryptoService) {
        super(server, crypto, [
            //#region List of actions
            P.KeyStorageKeysActionProto,
            P.KeyStorageIndexOfActionProto,
            P.KeyStorageGetItemActionProto,
            P.KeyStorageSetItemActionProto,
            P.KeyStorageRemoveItemActionProto,
            P.KeyStorageClearActionProto,
            //#endregion
        ]);
    }

    public async getCrypto(id: string) {
        return await this.object.getCrypto(id);
    }

    public getMemoryStorage() {
        return this.object.object.memoryStorage;
    }

    protected async onMessage(session: Session, action: ActionProto) {
        const result = new ResultProto(action);
        switch (action.action) {
            // getItem
            case P.KeyStorageGetItemActionProto.ACTION: {
                // prepare incoming data
                const params = await P.KeyStorageGetItemActionProto.importProto(action);
                const crypto = await this.getCrypto(params.providerID);

                // do operation
                const key = await crypto.keyStorage.getItem(
                    params.key,
                    params.algorithm.isEmpty() ? undefined : params.algorithm.toAlgorithm(),
                    params.extractable || undefined,
                    !params.keyUsages ? undefined : params.keyUsages,
                );

                if (key) {
                    // add keys to memory storage
                    const cryptoKey = new ServiceCryptoItem(key, params.providerID);
                    this.getMemoryStorage().add(cryptoKey);

                    result.data = await cryptoKey.toProto().exportProto();
                }
                break;
            }
            case P.KeyStorageSetItemActionProto.ACTION: {
                // prepare incoming data
                const params = await P.KeyStorageSetItemActionProto.importProto(action);
                const key = this.getMemoryStorage().item(params.item.id).item as CryptoKey;
                const crypto = await this.getCrypto(params.providerID);
                // do operation
                if ((key.algorithm as any).toAlgorithm) {
                    (key as any).algorithm = (key.algorithm as any).toAlgorithm();
                }
                let index: string;
                if (crypto instanceof PvCrypto) {
                    index = await crypto.keyStorage.setItem(key, {
                        pinFriendlyName: session.headers.origin,
                        pinDescription: key.usages.join(", "),
                    });
                } else {
                    index = await crypto.keyStorage.setItem(key);
                }
                result.data = Convert.FromUtf8String(index);
                // result
                break;
            }
            case P.KeyStorageRemoveItemActionProto.ACTION: {
                // prepare incoming data
                const params = await P.KeyStorageRemoveItemActionProto.importProto(action);
                const crypto = await this.getCrypto(params.providerID);
                // do operation
                await crypto.keyStorage.removeItem(params.key);
                // result
                break;
            }
            case P.KeyStorageKeysActionProto.ACTION: {
                // load key storage
                const params = await P.KeyStorageKeysActionProto.importProto(action);
                const crypto = await this.getCrypto(params.providerID);
                // do operation
                const keys = await crypto.keyStorage.keys();
                // result
                result.data = (await ArrayStringConverter.set(keys)).buffer;
                break;
            }
            case P.KeyStorageIndexOfActionProto.ACTION: {
                // load cert storage
                const params = await P.KeyStorageIndexOfActionProto.importProto(action);
                const crypto = await this.getCrypto(params.providerID);
                const key = this.getMemoryStorage().item(params.item.id).item as CryptoKey;

                // do operation
                const index = await crypto.keyStorage.indexOf(key as any);
                // result
                if (index) {
                    result.data = Convert.FromUtf8String(index);
                }
                break;
            }
            case P.KeyStorageClearActionProto.ACTION: {
                // load cert storage
                const params = await P.KeyStorageClearActionProto.importProto(action);
                const crypto = await this.getCrypto(params.providerID);

                // do operation
                await crypto.keyStorage.clear();
                // result
                break;
            }
            default:
                throw new WebCryptoLocalError(WebCryptoLocalError.CODE.ACTION_NOT_IMPLEMENTED, `Action '${action.action}' is not implemented`);
        }
        return result;
    }

}
