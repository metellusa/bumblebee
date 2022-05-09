import fs from "fs";
import { Swagger } from "../models/domain/swagger";
import {
    ADAPTERS_DIR,
    API_MODELS_DIR,
    APIS_DIR,
    CONTROLLER_FILE_SUFFIX,
    DATABASE_ADAPTER_FILE_SUFFIX,
    SERVICE_FILE_SUFFIX,
    ENTITY_MODELS_DIR,
    CORRELATION_ID_PARAM_DESCR,
    ADAPTER_MODELS_DIR,
    ROUTING_CONTROLLERS_LIB,
    JSON_CONTROLLER,
    APP_FILE_PATH,
    LOGGER_VAR_NAME,
    DATABASE_ADAPTER,
    UO_DATABASE_CONNECTORS_LIB,
    DOCUMENT_INSERT_RESPONSE,
    NANO,
    APP_TS_FILE_TEMPLATE
} from "../constants";
import Case from "case";
import { Verb } from "../models/domain/verb";
import CommonUtils from "../utils/common-utils";
import ModelsService from "./models.service";
import { Property } from "../models/domain/property";
import { VerbBody } from "../models/domain/verb-body";
import { VerbBodyType } from "../enums/verb-body-type.enum";
import { Parameter } from "../models/domain/parameter";
import { VerbElement } from "../models/domain/verb-element";
import path from "path";
import pluralize from "pluralize";
import { Decorator } from "../models/domain/decorator";
import { MethodParamDecorator } from "../enums/method-param-decorator.enum";
import SouceCodeUtils from "../utils/source-code-utils";

export default class SourceCodeService {

    /**
     * @description Generates all code files for a given swagger
     * @param swagger the swagger for which the files must be generated
     * @returns {void} nothing returned
     */
    public static async generateCodeFiles(swagger: Swagger) {
        const components: Map<string, VerbElement> = new Map<string, VerbElement>(swagger.components);

        if (fs.existsSync(swagger.targetLocation)) {
            // If an app.ts file does not exist under the src file, create it.
            if (!fs.existsSync(`${swagger.targetLocation}/${APP_FILE_PATH}.ts`)) {
                CommonUtils.createDirIfNotExist(`${swagger.targetLocation}/src`);
                fs.copyFileSync(APP_TS_FILE_TEMPLATE, `${swagger.targetLocation}/${APP_FILE_PATH}.ts`);
            }

            swagger.paths.forEach((path) => {
                path.verbs.forEach((verb) => {

                    let responseBodyName, requestBodyName;
                    let parameters: Parameter[] = [];

                    // Generate all the models pertaining to the request body if any
                    if (verb.requestBodyRef) {
                        const requestBodyObj = components.get(verb.requestBodyRef);
                        if (requestBodyObj) {
                            requestBodyName = requestBodyObj.name;
                            this.generateAllRelevantModels(requestBodyObj as VerbBody, verb.tag, verb.isPersistedModel, swagger.targetLocation);
                        }
                    }
                    // Generate all the models pertaining to the response body if any
                    if (verb.responseBodyRef) {
                        const responseBodyObj = components.get(verb.responseBodyRef);
                        if (responseBodyObj) {
                            responseBodyName = responseBodyObj.name;
                            this.generateAllRelevantModels(responseBodyObj as VerbBody, verb.tag, verb.isPersistedModel, swagger.targetLocation);
                        }
                    }
                    if (verb.parameters) {
                        verb.parameters.forEach(parameter => {
                            parameters.push(components.get(parameter) as Parameter);
                        })
                    }
                    // Generate the service files
                    this.generateService(verb, swagger.targetLocation, requestBodyName, responseBodyName, parameters);

                    // Generate the controller file
                    this.generateController(verb, swagger.targetLocation, requestBodyName, responseBodyName, parameters);

                    if (verb.isPersistedModel) {
                        this.generateDatabaseAdapter(verb, swagger.targetLocation, parameters);
                    }
                });
            });
        } else {
            throw new Error(`Target location specified: ${swagger.targetLocation} does not exist`);
        }
    }

    /**
     * @description Generates services in a given directory
     * @param verb the verb for which the service must be generated
     * @param directory the directory where the files must be generated
     * @param parameters the list of paramters
     * @returns {void} nothing returned
     */
    private static async generateService(verb: Verb, directory: string, requestBodyName?: string, responseBodyName?: string, parameters?: Parameter[]) {
        const serviceFolder = `${directory}/${APIS_DIR}/${Case.kebab(verb.tag)}/`;
        const isGetById = verb.signature === "get" && verb.url.charAt(verb.url.length - 1) === "}";
        let serviceFile;
        let className;
        let methodName;
        let classImports: string[] = [];
        let methodParams: string[] = [];
        let methodDescriptionParams: string[] = [];

        if (verb.isPersistedModel) {
            serviceFile = `${verb.signature}-${verb.model}.${SERVICE_FILE_SUFFIX}`;
            className = `${Case.pascal(`${verb.signature}_${verb.model}_service`)}`;
            methodName = `${Case.camel(`${verb.signature}_${verb.model}`)}${isGetById ? "ById" : ""}`;
            if (verb.signature === "get" && !isGetById) {
                methodName = pluralize.plural(methodName);
            }
        } else {
            const businessFunction = verb.url.substring(verb.url.lastIndexOf("/") + 1, verb.url.length);
            serviceFile = `${verb.signature}-${businessFunction}.${SERVICE_FILE_SUFFIX}`;
            className = `${Case.pascal(`${verb.signature}_${businessFunction}_service`)}`;
            methodName = `${Case.camel(`resolve_${verb.signature}_${businessFunction}`)}`;
        }

        if (requestBodyName) {
            const requestTypeModelPath = requestBodyName.endsWith("-model") ? `${ENTITY_MODELS_DIR}/${Case.kebab(requestBodyName)}`
                : `${API_MODELS_DIR}/${Case.kebab(verb.tag)}/${Case.kebab(requestBodyName)}`;
            const modelRelativePath = path.relative(`${APIS_DIR}/${Case.kebab(verb.tag)}`, `${requestTypeModelPath}`).replace(/\\/g, "/");

            requestBodyName = Case.pascal(requestBodyName);
            classImports.push(`import ${requestBodyName} from "${modelRelativePath}";`);
            methodParams.push(`${Case.camel(requestBodyName)}: ${requestBodyName}`);
            methodDescriptionParams.push(`${Case.camel(requestBodyName)} the ${Case.sentence(requestBodyName)} body`);
        }

        if (responseBodyName) {
            const requestTypeModelPath = responseBodyName.endsWith("-model") ? `${ENTITY_MODELS_DIR}/${Case.kebab(responseBodyName)}`
                : `${API_MODELS_DIR}/${Case.kebab(verb.tag)}/${Case.kebab(responseBodyName || "")}`;
            const modelRelativePath = path.relative(`${APIS_DIR}/${Case.kebab(verb.tag)}/`, `${requestTypeModelPath}`).replace(/\\/g, "/");

            responseBodyName = Case.pascal(responseBodyName);
            classImports.push(`import ${responseBodyName} from "${modelRelativePath}";`);
        }

        if (parameters) {
            parameters.forEach(parameter => {
                methodParams.push(`${Case.camel(parameter.name)}: ${parameter.type}`);
                methodDescriptionParams.push(`${Case.camel(parameter.name)} ${parameter.description}`);
            })
        }

        methodParams.push("correlationId: string");
        methodDescriptionParams.push(CORRELATION_ID_PARAM_DESCR);

        const method = CommonUtils.createMethod({
            name: methodName,
            description: verb.summary || Case.title(`the ${Case.sentence(methodName).toLocaleLowerCase()} method`),
            paramsDescriptions: CommonUtils.formatMethodDescrParams(methodDescriptionParams),
            returnType: responseBodyName,
            params: methodParams.join(",\n "),
            operationId: `"${className}.${methodName}"`
        });

        SouceCodeUtils.createOrUpdateFile({
            folder: serviceFolder,
            file: serviceFile,
            method,
            methodName,
            classImports,
            className,
            classDescription: Case.sentence(`${className}`)
        });
    }

    /**
     * @description Generates the controller in a given directory
     * @param verb the verb for which the service must be generated
     * @param directory the directory where the files must be generated
     * @param parameters the list of parameters
     * @returns {void} nothing returned
     */
    private static async generateController(verb: Verb, directory: string, requestBodyName?: string, responseBodyName?: string, parameters?: Parameter[]) {
        const controllerFolder = `${directory}/${APIS_DIR}/${Case.kebab(verb.tag)}/`;
        const controllerFile = `${Case.kebab(verb.tag)}.${CONTROLLER_FILE_SUFFIX}`;
        const isGetById = verb.signature === "get" && verb.url.charAt(verb.url.length - 1) === "}";
        const className = `${Case.pascal(verb.tag + "-controller")}`;
        const classDescription = Case.title(`the ${Case.sentence(verb.tag)} controller`);
        const routingControllerDecorators: Decorator[] = SouceCodeUtils.determineRoutingControllerDecorators(verb, requestBodyName, parameters);
        const uoStatusCodeDecorators: Decorator[] = SouceCodeUtils.determineUoStatusCodeDecorators(verb);
        const methodDecorators = routingControllerDecorators.concat(uoStatusCodeDecorators);
        let decoratorImports: Map<string, Set<string>> = new Map<string, Set<string>>();
        let methodDecoratorDeclarations: string[] = [];
        let methodParamDecoratorDeclarations: string[] = [];
        let methodDescriptionParams: string[] = [];
        let classImports: string[] = [];
        let methodName: string;

        // Importing the class decorator: JsonController from the routing-controllers library
        decoratorImports.set(ROUTING_CONTROLLERS_LIB, new Set<string>([JSON_CONTROLLER]));

        if (verb.isPersistedModel) {
            methodName = `${Case.camel(`${verb.signature}_${verb.model}`)}${isGetById ? "ById" : ""}`;
            if (verb.signature === "get" && !isGetById) {
                methodName = pluralize.plural(methodName);
            }
        } else {
            const businessFunction = verb.url.substring(verb.url.lastIndexOf("/"), verb.url.length);
            methodName = `${Case.camel(`${verb.signature}_${businessFunction}_${pluralize.singular(verb.model)}`)}`;
        }

        methodDecorators.forEach(decorator => {
            if (Object.values(MethodParamDecorator).includes(decorator.name as MethodParamDecorator)) {
                methodParamDecoratorDeclarations.push(`${decorator.declaration}`);
            } else {
                methodDecoratorDeclarations.push(`${decorator.declaration}`);
            }
            if (decoratorImports.has(decorator.importLib)) {
                decoratorImports.set(decorator.importLib, decoratorImports.get(decorator.importLib)?.add(decorator.name) || new Set);
            } else {
                decoratorImports.set(decorator.importLib, new Set<string>().add(decorator.name));
            }
        });

        if (parameters) {
            parameters.forEach(parameter => {
                methodDescriptionParams.push(`${Case.camel(parameter.name)} ${parameter.description}`);
            })
        }

        if (requestBodyName) {
            const requestTypeModelPath = requestBodyName.endsWith("-model") ? `${ENTITY_MODELS_DIR}/${Case.kebab(requestBodyName)}`
                : `${API_MODELS_DIR}/${Case.kebab(verb.tag)}/${Case.kebab(requestBodyName)}`;
            const modelRelativePath = path.relative(`${APIS_DIR}/${Case.kebab(verb.tag)}`, `${requestTypeModelPath}`).replace(/\\/g, "/");

            classImports.push(`import ${Case.pascal(requestBodyName)} from "${modelRelativePath}";`);
            methodDescriptionParams.push(`${Case.camel(requestBodyName)} the ${Case.sentence(requestBodyName)} body`);
        }

        if (responseBodyName) {
            const returnTypeModelPath = responseBodyName.endsWith("-model") ? `${ENTITY_MODELS_DIR}/${Case.kebab(responseBodyName)}`
                : `${API_MODELS_DIR}/${Case.kebab(verb.tag)}/${Case.kebab(responseBodyName)}`;
            const modelRelativePath = path.relative(`${APIS_DIR}/${Case.kebab(verb.tag)}`, `${returnTypeModelPath}`).replace(/\\/g, "/");

            responseBodyName = Case.pascal(responseBodyName);
            classImports.push(`import ${responseBodyName} from "${modelRelativePath}";`);
            if (verb.signature === "get" && !isGetById) {
                responseBodyName = `${responseBodyName}[]`;
            }
        }

        const method = CommonUtils.createMethod({
            name: methodName,
            description: verb.summary || Case.title(`the ${Case.sentence(methodName)} method`),
            returnType: responseBodyName,
            params: methodParamDecoratorDeclarations.join(",\n "),
            paramsDescriptions: CommonUtils.formatMethodDescrParams(methodDescriptionParams),
            decorators: methodDecoratorDeclarations,
            operationId: `"${className}.${methodName}"`
        });

        const appFileRelativePath = path.relative(`${APIS_DIR}/${Case.kebab(verb.tag)}`, `${APP_FILE_PATH}`).replace(/\\/g, "/");
        classImports.push(`import { ${LOGGER_VAR_NAME} } from "${appFileRelativePath}";`);

        SouceCodeUtils.createOrUpdateFile({
            folder: controllerFolder,
            file: controllerFile,
            method,
            methodName,
            decoratorImports,
            classImports,
            className,
            classDescription,
            classDecorators: [`@${JSON_CONTROLLER}("${SouceCodeUtils.determineControllerUrl(verb.url, "class")}")`]
        });
    }

    /**
     * @description Generates database adapters in a given directory
     * @param verb the verb for which the database adapter must be generated
     * @param directory the directory where the files must be generated
     * @returns {void} nothing returned
     */
    private static async generateDatabaseAdapter(verb: Verb, directory: string, parameters?: Parameter[]) {
        const adapterFolder = `${directory}/${ADAPTERS_DIR}/`;
        const adapterFile = `${Case.kebab(verb.model)}-${DATABASE_ADAPTER_FILE_SUFFIX}`;
        const isGetById = verb.signature === "get" && verb.url.charAt(verb.url.length - 1) === "}";
        const className = Case.pascal(`${verb.model}-database-adapter`);
        const classDescription = Case.title(`the ${Case.sentence(verb.tag)} database adapter`);
        const uoStatusCodeDecorators = SouceCodeUtils.determineUoStatusCodeDecorators(verb);
        let decoratorImports: Map<string, Set<string>> = new Map<string, Set<string>>();
        let classImports: string[] = [];
        let methodDecoratorDeclarations: string[] = [];
        let methodParams: string[] = [];
        let methodDescriptionParams: string[] = [];
        let methodName: string = `${Case.camel(`${verb.signature}_${verb.model}`)}${isGetById ? "ById" : ""}`;
        let methodReturnType: string;

        decoratorImports.set(UO_DATABASE_CONNECTORS_LIB, new Set<string>([DATABASE_ADAPTER]));

        if (verb.signature === "get") {
            methodReturnType = Case.pascal(`${verb.model}-database`);

            const returnModelRelativePath = path.relative(`${ADAPTERS_DIR}`, `${ADAPTER_MODELS_DIR}/${Case.kebab(methodReturnType)}`).replace(/\\/g, "/");
            classImports.push(`import { ${methodReturnType} } from "${returnModelRelativePath}";`);

            if (!isGetById) {
                methodName = pluralize.plural(methodName);
                methodReturnType = `${methodReturnType}[]`;
            }
        } else {
            methodReturnType = DOCUMENT_INSERT_RESPONSE;
            classImports.push(`import { ${DOCUMENT_INSERT_RESPONSE} } from "${NANO}";`);
        }

        uoStatusCodeDecorators.forEach(decorator => {
            methodDecoratorDeclarations.push(`${decorator.declaration}`);
            if (decoratorImports.has(decorator.importLib)) {
                decoratorImports.set(decorator.importLib, decoratorImports.get(decorator.importLib)?.add(decorator.name) || new Set);
            } else {
                decoratorImports.set(decorator.importLib, new Set<string>([decorator.name]));
            }
        });

        if (parameters) {
            parameters.forEach(parameter => {
                methodParams.push(`${Case.camel(parameter.name)}: ${parameter.type}`);
                methodDescriptionParams.push(`${Case.camel(parameter.name)} ${parameter.description}`);
            })
        }

        const method = CommonUtils.createMethod({
            name: methodName,
            description: verb.summary || Case.title(`the ${Case.sentence(methodName)} method`),
            params: methodParams.join(",\n "),
            paramsDescriptions: CommonUtils.formatMethodDescrParams(methodDescriptionParams),
            decorators: methodDecoratorDeclarations,
            returnType: methodReturnType,
            operationId: `"${className}.${methodName}"`
        });

        const appFileRelativePath = path.relative(`${ADAPTERS_DIR}`, `${APP_FILE_PATH}`).replace(/\\/g, "/");
        classImports.push(`import { ${LOGGER_VAR_NAME} } from "${appFileRelativePath}";`);

        SouceCodeUtils.createOrUpdateFile({
            folder: adapterFolder,
            file: adapterFile,
            method,
            methodName,
            decoratorImports,
            classImports,
            className: `${className} extends ${DATABASE_ADAPTER}`,
            classDescription
        });
    }

    /**
     * @description Generates all models related to a request or response object
     * @param verbBody the verb body
     * @param verbTag the verb tag
     * @param isPersistedModel is the model persited
     * @param directory the directory where the request or response model files must be generated
     * @returns {void} nothing returned
     */
    private static async generateAllRelevantModels(verbBody: VerbBody, verbTag: string, isPersistedModel: boolean, directory: string) {
        const modelsDirectory = `${directory}/${API_MODELS_DIR}/${Case.kebab(verbTag)}/`;
        const entityModelsDirectory = `${directory}/${ENTITY_MODELS_DIR}/`;
        const adapterModelsDirectory = `${directory}/${ADAPTER_MODELS_DIR}/`;
        let entityModels: string[] = [];

        CommonUtils.createDirIfNotExist(entityModelsDirectory);
        verbBody.properties.forEach(property => {
            if (CommonUtils.isEntityObject(property)) {
                ModelsService.generateEntityModel(property, entityModelsDirectory);
                entityModels.push(property.type);
            }

            let fieldProperties: Property[] | undefined = property.properties;
            while (fieldProperties) {
                fieldProperties.forEach(field => {
                    if (CommonUtils.isEntityObject(field)) {
                        ModelsService.generateEntityModel(field, entityModelsDirectory);
                    }
                    fieldProperties = field.properties;
                });
            }
        });

        CommonUtils.createDirIfNotExist(modelsDirectory);
        if (verbBody.type === VerbBodyType.request) {
            ModelsService.generateRequestModel(verbBody, modelsDirectory, entityModels);
        } else if (verbBody.type === VerbBodyType.response) {
            ModelsService.generateResponseModel(verbBody, modelsDirectory, entityModels);
        } else if (verbBody.type === VerbBodyType.model) {
            const entityModel = {
                name: pluralize.singular(verbBody.name),
                properties: verbBody.properties
            } as Property;

            ModelsService.generateEntityModel(entityModel, entityModelsDirectory);

            if (isPersistedModel) {
                //Generate database adapter models
                CommonUtils.createDirIfNotExist(adapterModelsDirectory);
                ModelsService.generateAdapterModel(verbBody, adapterModelsDirectory);
            }
        }
    }
}
