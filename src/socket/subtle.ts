import { Convert } from "pvtsutils";
import * as core from "webcrypto-core";
import { CryptoKeyPairProto, CryptoKeyProto } from "../core";
import { SignActionProto, VerifyActionProto } from "../core/protos/subtle";
import { ExportKeyActionProto, ImportKeyActionProto } from "../core/protos/subtle";
import { DecryptActionProto, EncryptActionProto } from "../core/protos/subtle";
import { DeriveBitsActionProto, DeriveKeyActionProto } from "../core/protos/subtle";
import { UnwrapKeyActionProto, WrapKeyActionProto } from "../core/protos/subtle";
import { DigestActionProto, GenerateKeyActionProto } from "../core/protos/subtle";
import { SocketCrypto } from "./crypto";
import * as utils from "./utils";

export class SubtleCrypto implements core.NativeSubtleCrypto {

  protected readonly service: SocketCrypto;

  constructor(crypto: SocketCrypto) {
    this.service = crypto;
  }

  public async encrypt(algorithm: Algorithm, key: CryptoKeyProto, data: BufferSource) {
    return this.encryptData(algorithm, key, data, "encrypt");
  }

  public async decrypt(algorithm: Algorithm, key: CryptoKeyProto, data: BufferSource) {
    return this.encryptData(algorithm, key, data, "decrypt");
  }

  public async deriveBits(algorithm: string | EcdhKeyDeriveParams | DhKeyDeriveParams | ConcatParams | HkdfCtrParams | Pbkdf2Params, baseKey: CryptoKeyProto, length: number) {
    // check
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkCryptoKey(baseKey, "baseKey");
    utils.checkPrimitive(length, "number", "length");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm);
    utils.checkCryptoKey(algProto, "algorithm.public");
    algProto.public = await utils.Cast<CryptoKeyProto>(algProto.public).exportProto();

    // fill action
    const action = new DeriveBitsActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.key = baseKey;
    action.length = length;

    // request
    const result = await this.service.client.send(action);
    return result;
  }

  public async deriveKey(algorithm: string | EcdhKeyDeriveParams | DhKeyDeriveParams | ConcatParams | HkdfCtrParams | Pbkdf2Params, baseKey: CryptoKeyProto, derivedKeyType: string | AesDerivedKeyParams | HmacImportParams | ConcatParams | HkdfCtrParams | Pbkdf2Params, extractable: boolean, keyUsages: string[]) {
    // check incoming data
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkCryptoKey(baseKey, "baseKey");
    utils.checkAlgorithm(derivedKeyType, "algorithm");
    utils.checkPrimitive(extractable, "boolean", "extractable");
    utils.checkArray(keyUsages, "keyUsages");

    // prepare incoming data
    const algProto = utils.prepareAlgorithm(algorithm);
    utils.checkCryptoKey(algProto, "algorithm.public");
    algProto.public = await utils.Cast<CryptoKeyProto>(algProto.public).exportProto();
    const algKeyType = utils.prepareAlgorithm(derivedKeyType);

    // fill action
    const action = new DeriveKeyActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.derivedKeyType.fromAlgorithm(algKeyType);
    action.key = baseKey;
    action.extractable = extractable;
    action.usage = keyUsages;

    // request
    const result = await this.service.client.send(action);
    return await CryptoKeyProto.importProto(result);
  }

  public async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
    // check
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkBufferSource(data, "data");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm);
    const rawData = core.BufferSourceConverter.toArrayBuffer(data);

    // Use native digest if possible
    if (self.crypto) {
      try {
        return await self.crypto.subtle.digest(algorithm, rawData);
      } catch (err) {
        console.warn(`Cannot do native digest for algorithm '${algProto.name}'`);
      }
    }

    // fill action
    const action = new DigestActionProto();
    action.algorithm = algProto;
    action.data = rawData;
    action.providerID = this.service.id;

    // request
    const result = await this.service.client.send(action);
    return result;
  }

  public generateKey(algorithm: string, extractable: boolean, keyUsages: string[]): Promise<CryptoKeyPair | CryptoKey>;
  public generateKey(algorithm: RsaHashedKeyGenParams | EcKeyGenParams | DhKeyGenParams, extractable: boolean, keyUsages: string[]): Promise<CryptoKeyPair>;
  public generateKey(algorithm: AesKeyGenParams | HmacKeyGenParams | Pbkdf2Params, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
  public async generateKey(algorithm: AlgorithmIdentifier, extractable: boolean, keyUsages: string[]): Promise<CryptoKey | CryptoKeyPair> {
    // check
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkPrimitive(extractable, "boolean", "extractable");
    utils.checkArray(keyUsages, "keyUsages");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm);

    // Fill action
    const action = new GenerateKeyActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.extractable = extractable;
    action.usage = keyUsages;

    const result = await this.service.client.send(action);
    try {
      // CryptoKeyPair
      const keyPair = await CryptoKeyPairProto.importProto(result);
      return keyPair;
    } catch (e) {
      // CryptoKey
      const key = await CryptoKeyProto.importProto(result);
      return key;
    }
  }

  public async exportKey(format: string, key: CryptoKeyProto) {
    // check
    utils.checkPrimitive(format, "string", "format");
    utils.checkCryptoKey(key, "key");

    // fill action
    const action = new ExportKeyActionProto();
    action.providerID = this.service.id;
    action.format = format;
    action.key = key;

    // request
    const result = await this.service.client.send(action);
    if (format === "jwk") {
      return JSON.parse(Convert.ToBinary(result));
    } else {
      return result;
    }
  }

  public async importKey(format: KeyFormat, keyData: JsonWebKey | BufferSource, algorithm: string | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | DhImportKeyParams, extractable: boolean, keyUsages: string[]) {
    // check
    utils.checkPrimitive(format, "string", "format");
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkPrimitive(extractable, "boolean", "extractable");
    utils.checkArray(keyUsages, "keyUsages");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm as AlgorithmIdentifier);
    let preparedKeyData: ArrayBuffer;
    if (format === "jwk") {
      preparedKeyData = Convert.FromUtf8String(JSON.stringify(keyData));
    } else {
      utils.checkBufferSource(keyData, "keyData");
      preparedKeyData = core.BufferSourceConverter.toArrayBuffer(keyData as BufferSource);
    }

    // fill action
    const action = new ImportKeyActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.keyData = preparedKeyData;
    action.format = format;
    action.extractable = extractable;
    action.keyUsages = keyUsages;

    // request
    const result = await this.service.client.send(action);
    return await CryptoKeyProto.importProto(result);
  }

  public async sign(algorithm: string | RsaPssParams | EcdsaParams | AesCmacParams, key: CryptoKeyProto, data: BufferSource) {
    // check
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkCryptoKey(key, "key");
    utils.checkBufferSource(data, "data");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm as AlgorithmIdentifier);
    const rawData = core.BufferSourceConverter.toArrayBuffer(data);

    // fill action
    const action = new SignActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.key = key;
    action.data = rawData;

    // request
    const result = await this.service.client.send(action);
    return result;
  }

  public async verify(algorithm: string | RsaPssParams | EcdsaParams | AesCmacParams, key: CryptoKeyProto, signature: BufferSource, data: BufferSource) {
    // check
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkCryptoKey(key, "key");
    utils.checkBufferSource(signature, "signature");
    utils.checkBufferSource(data, "data");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm as AlgorithmIdentifier);
    const rawSignature = core.BufferSourceConverter.toArrayBuffer(signature);
    const rawData = core.BufferSourceConverter.toArrayBuffer(data);

    // fill action

    const action = new VerifyActionProto();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.key = key;
    action.data = rawData;
    action.signature = rawSignature;

    // request
    const result = await this.service.client.send(action);
    return !!(new Uint8Array(result)[0]);
  }

  public async wrapKey(format: string, key: CryptoKeyProto, wrappingKey: CryptoKeyProto, wrapAlgorithm: AlgorithmIdentifier) {
    // check
    utils.checkPrimitive(format, "string", "format");
    utils.checkCryptoKey(key, "key");
    utils.checkCryptoKey(wrappingKey, "wrappingKey");
    utils.checkAlgorithm(wrapAlgorithm, "wrapAlgorithm");

    // prepare
    const wrapAlgProto = utils.prepareAlgorithm(wrapAlgorithm);

    // fil action
    const action = new WrapKeyActionProto();
    action.providerID = this.service.id;
    action.wrapAlgorithm = wrapAlgProto;
    action.key = key;
    action.wrappingKey = wrappingKey;
    action.format = format;

    // request
    const result = await this.service.client.send(action);
    return result;
  }

  public async unwrapKey(format: string, wrappedKey: BufferSource, unwrappingKey: CryptoKeyProto, unwrapAlgorithm: AlgorithmIdentifier, unwrappedKeyAlgorithm: AlgorithmIdentifier, extractable: boolean, keyUsages: string[]) {
    // check
    utils.checkPrimitive(format, "string", "format");
    utils.checkBufferSource(wrappedKey, "wrappedKey");
    utils.checkCryptoKey(unwrappingKey, "unwrappingKey");
    utils.checkAlgorithm(unwrapAlgorithm, "unwrapAlgorithm");
    utils.checkAlgorithm(unwrappedKeyAlgorithm, "unwrappedKeyAlgorithm");
    utils.checkPrimitive(extractable, "boolean", "extractable");
    utils.checkArray(keyUsages, "keyUsages");

    // prepare
    const unwrapAlgProto = utils.prepareAlgorithm(unwrapAlgorithm);
    const unwrappedKeyAlgProto = utils.prepareAlgorithm(unwrappedKeyAlgorithm);
    const rawWrappedKey = core.BufferSourceConverter.toArrayBuffer(wrappedKey);

    // fill action
    const action = new UnwrapKeyActionProto();
    action.providerID = this.service.id;
    action.format = format;
    action.unwrapAlgorithm = unwrapAlgProto;
    action.unwrappedKeyAlgorithm = unwrappedKeyAlgProto;
    action.unwrappingKey = unwrappingKey;
    action.wrappedKey = rawWrappedKey;
    action.extractable = extractable;
    action.keyUsage = keyUsages;

    // request
    const result = await this.service.client.send(action);
    return await CryptoKeyProto.importProto(result);
  }

  protected async encryptData(algorithm: Algorithm, key: CryptoKeyProto, data: BufferSource, type: string) {
    // check data
    utils.checkAlgorithm(algorithm, "algorithm");
    utils.checkCryptoKey(key, "key");
    utils.checkBufferSource(data, "data");

    // prepare
    const algProto = utils.prepareAlgorithm(algorithm);
    const rawData = core.BufferSourceConverter.toArrayBuffer(data);

    // select encrypt/decrypt action
    let ActionClass: typeof EncryptActionProto;
    if (type === "encrypt") {
      ActionClass = EncryptActionProto;
    } else {
      ActionClass = DecryptActionProto;
    }

    // fill action
    const action = new ActionClass();
    action.providerID = this.service.id;
    action.algorithm = algProto;
    action.key = key;
    action.data = rawData;

    // request
    const result = await this.service.client.send(action);
    return result;
  }

}
