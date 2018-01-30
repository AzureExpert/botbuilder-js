import * as request from 'request';

var getPem = require('rsa-pem-from-mod-exp');
var base64url = require('base64url');


export class OpenIdMetadata {
    private url: string;
    private lastUpdated = 0;
    private keys: IKey[];

    constructor(url: string) {
        this.url = url;
    }

    public getKey(keyId: string, cb: (key: IOpenIdMetadataKey) => void): void {
        // If keys are more than 5 days old, refresh them
        const now = new Date().getTime();
        if (this.lastUpdated < (now - 1000 * 60 * 60 * 24 * 5)) {
            this.refreshCache((err) => {
                if (err) {
                    // logger.error('Error retrieving OpenId metadata at ' + this.url + ', error: ' + err.toString());
                    // fall through and return cached key on error
                }

                // Search the cache even if we failed to refresh
                const key = this.findKey(keyId);
                cb(key);
            });
        } else {
            // Otherwise read from cache
            const key = this.findKey(keyId);
            cb(key);
        }
    }

    private refreshCache(cb: (err: Error) => void): void {
        let options: request.Options = {
            method: 'GET',
            url: this.url,
            json: true
        };

        request(options, (err, response, body) => {
            if (!err && (response.statusCode >= 400 || !body)) {
                err = new Error('Failed to load openID config: ' + response.statusCode);
            }

            if (err) {
                cb(err);
            } else {
                let openIdConfig = <IOpenIdConfig>body;

                options = {
                    method: 'GET',
                    url: openIdConfig.jwks_uri,
                    json: true
                };

                request(options, (err2, response2, body2) => {
                    if (!err2 && (response2.statusCode >= 400 || !body2)) {
                        err2 = new Error('Failed to load Keys: ' + response2.statusCode);
                    }

                    if (!err2) {
                        this.lastUpdated = new Date().getTime();
                        this.keys = <IKey[]>body2.keys;
                    }

                    cb(err2);
                });
            }
        });
    }

    private findKey(keyId: string): IOpenIdMetadataKey {
        if (!this.keys) {
            return null;
        }

        for (let i = 0; i < this.keys.length; i++) {
            if (this.keys[i].kid === keyId) {
                const key = this.keys[i];

                if (!key.n || !key.e) {
                    // Return null for non-RSA keys
                    return null;
                }

                const modulus = base64url.toBase64(key.n);
                const exponent = key.e;

                return {key: getPem(modulus, exponent), endorsements: key.endorsements} as IOpenIdMetadataKey;
            }
        }

        return null;
    }
}

interface IOpenIdConfig {
    issuer: string;
    authorization_endpoint: string;
    jwks_uri: string;
    id_token_signing_alg_values_supported: string[];
    token_endpoint_auth_methods_supported: string[];
}

interface IKey {
    kty: string;
    use: string;
    kid: string;
    x5t: string;
    n: string;
    e: string;
    x5c: string[];
    endorsements?: string[];
}

export interface IOpenIdMetadataKey {
    key: string;
    endorsements?: string[];
}
