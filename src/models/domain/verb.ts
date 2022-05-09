import { VerbBody } from "./verb-request-body";

export class Verb {
    public signature: string;
    public tag: string;
    public summary: string;
    public url: string;
    public model: string;
    public isPersistedModel: boolean;
    public parameters?: string[];
    public requestBodyRef?: string;
    public responseBodyRef?:  string;
    public responseCodes: string[];
}
