import { getEngine } from "2key-ratchet";
import { ProviderInfo } from "node-webcrypto-p11";
import * as core from "webcrypto-core";
import { OPENSSL_CERT_STORAGE_DIR, OPENSSL_KEY_STORAGE_DIR } from "../../core/const";
import { OpenSSLCertificateStorage } from "./ossl_cert_storage";
import { OpenSSLKeyStorage } from "./ossl_key_storage";

export class OpenSSLCrypto implements core.CryptoStorages, core.NativeCrypto {

    public readonly info: ProviderInfo = {
        id: "61e5e90712ba8abfb6bde6b4504b54bf88d36d0c",
        slot: 0,
        name: "OpenSSL",
        reader: "OpenSSL",
        serialNumber: "61e5e90712ba8abfb6bde6b4504b54bf88d36d0c",
        isRemovable: false,
        isHardware: false,
        algorithms: [
            "SHA-1",
            "SHA-256",
            "SHA-384",
            "SHA-512",
            "RSASSA-PKCS1-v1_5",
            "RSA-PSS",
            "HMAC",
            "AES-CBC",
            "AES-GCM",
            "PBKDF2",
            "ECDH",
            "ECDSA",
        ],
    };

    public crypto = getEngine().crypto;
    public subtle = getEngine().crypto.subtle;
    public keyStorage = new OpenSSLKeyStorage(`${OPENSSL_KEY_STORAGE_DIR}/store.json`);
    public certStorage = new OpenSSLCertificateStorage(`${OPENSSL_CERT_STORAGE_DIR}/store.json`);

    public isLoggedIn = true;

    public getRandomValues<T extends Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView>(array: T): T {
        return this.crypto.getRandomValues(array);
    }
}
