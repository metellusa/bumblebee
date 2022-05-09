import Case from "case";
import fs from "fs";
import pluralize from "pluralize";
import YAML from "yaml";
import { SWAGGER_PARAMETER_PREFIX, PERSISTENT_MODEL_LABEL, SWAGGER_SCHEMA_PREFIX } from "../constants";
import { Path } from "../models/domain/path";
import { Property } from "../models/domain/property";
import { SubmitSwaggerRequest } from "../models/api/submit-swagger-request";
import { Verb } from "../models/domain/verb";
import { VerbBody } from "../models/domain/verb-body";
import CommonUtils from "../utils/common-utils";
import { SubmitSwaggerResponse } from "../models/api/submit-swagger-response";
import { VerbBodyType } from "../enums/verb-body-type.enum";
import { Parameter } from "../models/domain/parameter";

export default class ActionsService {

    private static inputYaml: any;

    /**
     * @description Parses a given swagger
     * @param swaggerRequest the swagger to be parsed
     * @returns {SubmitSwaggerResponse} returns a parsed swagger
     */
    public static async submitSwagger(swaggerRequest: SubmitSwaggerRequest): Promise<SubmitSwaggerResponse> {

        if (fs.existsSync(swaggerRequest.filePath)) {
            this.inputYaml = YAML.parse(fs.readFileSync(swaggerRequest.filePath, 'utf8'));
            let tags: string[] = [];
            let paths: Path[] = [];
            let components = new Map<string, object>();
            let validationErrors = [];
            const addVerbBodyToComponents = (reference: string): string | undefined => {
                if (reference) {
                    reference = reference.substring(2, reference.length).replace(/\//g, '.');
                    const body = CommonUtils.getField(this.inputYaml, reference);
                    const name = reference.replace(SWAGGER_SCHEMA_PREFIX, "");

                    if (!components.has(name)) {
                        components.set(name, this.createVerbBody(body, name));
                    }

                    return name;
                }
            }
            const addParametersToComponents = (referenceObjs: object[]): string[] | undefined => {
                if (referenceObjs) {
                    let names: string[] = [];
                    referenceObjs.forEach(referenceObj => {
                        let reference: string = CommonUtils.getField(referenceObj, "$ref");
                        if (reference) {
                            reference = reference.substring(2, reference.length).replace(/\//g, '.');
                            const parameter = CommonUtils.getField(this.inputYaml, reference);
                            const name = reference.replace(SWAGGER_PARAMETER_PREFIX, "");

                            if (!components.has(name)) {
                                components.set(name, this.createParameter(parameter));
                            }
                            names.push(name);
                        }
                    });

                    return names;
                }
            }

            if (this.inputYaml.tags) {
                this.inputYaml.tags.forEach((obj: { name: string; }) => {
                    let tag = Case.lower(obj.name);
                    tags.push(tag);
                })
            }

            if (this.inputYaml.paths) {
                for (const [path, pathData] of Object.entries(this.inputYaml.paths)) {
                    let verbs = [];

                    for (const [rawVerb, rawVerbData] of Object.entries(pathData as object)) {
                        if (CommonUtils.isValidVerb(rawVerb)) {
                            const verb = this.createVerb(path, rawVerb, rawVerbData);

                            // If the verb has requestBody, create an entity verbBody and add it to components map
                            if (CommonUtils.getField(rawVerbData, "requestBody")) {
                                const requestBodyRef = CommonUtils.getField(rawVerbData, 'requestBody.content.application/json.schema.$ref');

                                const bodyName = addVerbBodyToComponents(requestBodyRef);
                                if (bodyName) {
                                    this.validateRequestObject(requestBodyRef, path);
                                    verb.requestBodyRef = bodyName
                                } else {
                                    validationErrors.push(`Request body: "${requestBodyRef}" for path: ${path} must be referenced under #${SWAGGER_SCHEMA_PREFIX.replace(/./g, "/")}`);
                                }
                            }

                            // If the verb has responseBody, create an entity verbBody and add it to components map
                            if (CommonUtils.getField(rawVerbData, "responses.200")) {
                                const responseBodyRef = CommonUtils.getField(rawVerbData, 'responses.200.content.application/json.schema.$ref')
                                    || CommonUtils.getField(rawVerbData, 'responses.200.content.application/json.schema.items.$ref');
                                const bodyName = addVerbBodyToComponents(responseBodyRef);

                                if (bodyName) {
                                    this.validateResponseObject(responseBodyRef, path);
                                    verb.responseBodyRef = bodyName
                                } else {
                                    validationErrors.push(`Request body: "${responseBodyRef}" for path ${path} must be referenced under #${SWAGGER_SCHEMA_PREFIX.replace(/./g, "/")}`);
                                }
                            }
                            // If the verb has parameters, create an entity verbBody and add it to components map
                            if (CommonUtils.getField(rawVerbData, "parameters")) {
                                const parameterRefs = CommonUtils.getField(rawVerbData, "parameters");
                                const parameterNames = addParametersToComponents(parameterRefs);
                                if (parameterNames) {
                                    verb.parameters = parameterNames;
                                } else {
                                    validationErrors.push(`Parameters for ${path} must be referenced under #${SWAGGER_PARAMETER_PREFIX.replace(/./g, "/")}`);
                                }
                            }
                            verbs.push(verb);
                        }
                    }
                    paths.push({
                        path,
                        verbs
                    });
                }
            }
            return {
                tags,
                paths,
                components: Array.from(components)
            };
        }
        throw new Error(`File ${swaggerRequest.filePath} not found`);
    }

    /**
     * @description Convert the verb of given path to an entity Verb object
     * @param url the verb's url
     * @param signature the verb's signature
     * @param verbFields the verb's fields
     * @returns {Verb} returns an entity Verb object
     */
    private static createVerb(url: string, signature: string, verbFields: any): Verb {
        let verb = new Verb();

        if (verbFields.tags) {
            const tag = Case.lower(verbFields.tags[0]);
            const model = pluralize.singular(tag.substring(0, tag.indexOf(" ("))) || tag;

            verb.signature = signature;
            verb.tag = tag;
            verb.url = url;
            verb.summary = Case.lower(verbFields.summary);
            verb.model = Case.kebab(model);
            verb.responseCodes = Object.getOwnPropertyNames(verbFields.responses);
            verb.isPersistedModel = tag.includes(PERSISTENT_MODEL_LABEL);
        }

        return verb;
    }

    /**
     * @description Convert a verb's body to an entity VerbBody object
     * @param body the verb's body
     * @param name the body name
     * @returns {VerbBody} returns an entity VerbBody object
     */
    private static createVerbBody(body: object, name: string): VerbBody {
        let properties: Property[] = [];
        let type: VerbBodyType;
        const bodyRequiredFields = CommonUtils.getField(body, 'required') || [];
        const bodyProperties = CommonUtils.getField(body, 'properties') || [];

        for (const property in bodyProperties) {
            const isRequired = bodyRequiredFields.includes(property);
            const propertyFields = bodyProperties[property];
            properties.push(this.createProperty(property, propertyFields, isRequired));
        }

        if (name.endsWith(VerbBodyType.request)) {
            type = VerbBodyType.request;
        } else if (name.endsWith(VerbBodyType.response)) {
            type = VerbBodyType.response;
        } else {
            type = VerbBodyType.model;
        }

        return {
            type,
            name,
            properties
        };
    }

    /**
     * @description Convert a request body's property to an entity Property object
     * @param property the property name
     * @param propertyFields the property's fields
     * @param isRequired is the property required?
     * @returns {Property} returns an entity Property object
     */
    private static createProperty(property: string, propertyFields: object, isRequired: boolean): Property {
        let propertyRef: string = CommonUtils.getField(propertyFields, '$ref');

        // if propertyFields has a reference, replace the reference string with its actual object
        if (propertyRef) {
            propertyRef = propertyRef.substring(2, propertyRef.length).replace(/\//g, '.');
            propertyFields = CommonUtils.getField(this.inputYaml, propertyRef);
        }

        let entityPropertyObj: Property = {
            isRequired: isRequired,
            name: property,
            type: this.determineTsDataType(property, propertyFields),
            description: CommonUtils.getField(propertyFields, "description"),
            example: CommonUtils.getField(propertyFields, "example")
        };

        // Check if there are any children property fields
        const childPropertyFields = CommonUtils.getField(propertyFields, "properties") || CommonUtils.getField(propertyFields, "items.properties");

        if (childPropertyFields) {
            let properties = [];
            const childPropertyRequiredFields = childPropertyFields.required || [];

            for (const childProperty in childPropertyFields) {
                let childPropertyObj = childPropertyFields[childProperty];
                let childPropertyFieldRef = CommonUtils.getField(childPropertyFields[childProperty], "$ref");

                if (childPropertyFieldRef) {
                    childPropertyFieldRef = childPropertyFieldRef.substring(2, childPropertyFieldRef.length).replace(/\//g, '.');
                    childPropertyObj = CommonUtils.getField(this.inputYaml, childPropertyFieldRef);
                }

                const isChildPropertyRequired = childPropertyRequiredFields.includes(childProperty) || true;

                properties.push(this.createProperty(childProperty, childPropertyObj, isChildPropertyRequired));
            }
            entityPropertyObj.properties = properties;
        }

        return entityPropertyObj;
    }

    /**
     * @description Convert a verb's parameter to an entity Parameter object
     * @param parameter the verb's parameter
     * @returns {Parameter} returns an entity Parameter object
     */
    static createParameter(parameter: any): Parameter {

        return {
            name: CommonUtils.getField(parameter, "name"),
            description: CommonUtils.getField(parameter, "description"),
            in: CommonUtils.getField(parameter, "in"),
            required: CommonUtils.getField(parameter, "required"),
            type: CommonUtils.getField(parameter, "schema.type")
        };
    }

    /**
     * @description Determines the valid Typescript type for a given swagger type
     * @param property the property for which the type must be determined
     * @param propertyFields the property's fields
     * @returns {string} returns the string label of a valid TypeScript datatype
     */
    private static determineTsDataType(property: string, propertyFields: object): string {
        const type: string = CommonUtils.getField(propertyFields, "type");
        const typeScriptDataTypes = new Map([
            ["string", "string"],
            ["integer", "number"],
            ["number", "number"],
            ["boolean", "boolean"],
            ["object", Case.pascal(property)]
        ]);

        if (type === 'array') {
            const arrayType = CommonUtils.getField(propertyFields, 'items.type');
            if (typeScriptDataTypes.has(arrayType)) {
                return `${typeScriptDataTypes.get(arrayType)}[]`;
            }
        }

        return typeScriptDataTypes.get(type) || "undefined";
    }

    private static validateRequestObject(name: string, path: string): string[] {
        let validationErrors: string[] = [];

        if (!name.endsWith(VerbBodyType.request)) {
            validationErrors.push(`requestBody: "${name}" for path: ${path} must end with suffix "-request"`);
        }

        if (name.includes("-model")) {
            validationErrors.push(`requestBody: "${name}" for path: ${path} should not include "-model" in its name`);
        }

        return validationErrors;
    }

    private static validateResponseObject(name: string, path: string): string[] {
        let validationErrors: string[] = [];
        if (name) {
            if (!name.endsWith(VerbBodyType.response) || !name.endsWith(VerbBodyType.model)) {
                validationErrors.push(`responseBody: "${name}" for path: ${path} must end with suffix "-response" or "-model"`);
            }
        } else {
            console.log(path);
            validationErrors.push(``);
        }

        return validationErrors;
    }

    // private static validateParameter(name: string, path: string): string[] {

    // }
}
