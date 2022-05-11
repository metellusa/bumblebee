import Case from "case";
import fs from "fs";
import {
    API_MODELS_DIR, ENTITY_MODELS_DIR, CLASS_TRANSFORMER_LIB, VALIDATION_MESSAGES_FILE_DIR, VALIDATION_MESSAGES_FILE, ADAPTER_MODELS_DIR, EXCLUDE, DATABASE_FIELDS
} from "../constants";
import { Property } from "../models/domain/property";
import CommonUtils from "../utils/common-utils";
import path from "path";
import { VerbBody } from "../models/domain/verb-body";
import beautify from "js-beautify";
import pluralize from "pluralize";
import { VerbBodyType } from "../enums/verb-body-type.enum";
import { Decorator } from "../models/domain/decorator";
import ModelsUtils from "../utils/models-utils";
import { VerbElement } from "../models/domain/verb-element";
import { Swagger } from "../models/domain/swagger";

export default class ModelsService {

    /**
     * @description Generates model files for a given swagger
     * @param swagger the swagger for which the model files must be generated
     * @returns {void} nothing returned
     */
    public static async generateModelFiles(swagger: Swagger) {
        const components: Map<string, VerbElement> = new Map<string, VerbElement>(swagger.components);

        if (fs.existsSync(swagger.targetLocation)) {
            swagger.paths.forEach((path) => {
                path.verbs.forEach((verb) => {

                    let responseBodyName, requestBodyName;

                    // Generate all the models pertaining to the request body if any
                    if (verb.requestBodyRef) {
                        const requestBodyObj = components.get(verb.requestBodyRef);
                        if (requestBodyObj) {
                            requestBodyName = requestBodyObj.name;
                            this.generateAllApplicableModels(requestBodyObj as VerbBody, verb.tag, verb.isPersistedModel, swagger.targetLocation);
                        }
                    }
                    // Generate all the models pertaining to the response body if any
                    if (verb.responseBodyRef) {
                        const responseBodyObj = components.get(verb.responseBodyRef);
                        if (responseBodyObj) {
                            responseBodyName = responseBodyObj.name;
                            this.generateAllApplicableModels(responseBodyObj as VerbBody, verb.tag, verb.isPersistedModel, swagger.targetLocation);
                        }
                    }

                });
            });
        } else {
            throw new Error(`Target location specified: ${swagger.targetLocation} does not exist`);
        }
    }

    /**
     * @description Generates all models that are applicable to a request or response object
     * @param verbBody the verb body
     * @param verbTag the verb tag
     * @param isPersistedModel is the model persited
     * @param directory the directory where the request or response model files must be generated
     * @returns {void} nothing returned
     */
    private static async generateAllApplicableModels(verbBody: VerbBody, verbTag: string, isPersistedModel: boolean, directory: string) {
        const modelsDirectory = `${directory}/${API_MODELS_DIR}/${Case.kebab(verbTag)}/`;
        const entityModelsDirectory = `${directory}/${ENTITY_MODELS_DIR}/`;
        const adapterModelsDirectory = `${directory}/${ADAPTER_MODELS_DIR}/`;
        let entityModels: string[] = [];

        CommonUtils.createDirIfNotExist(entityModelsDirectory);
        verbBody.properties.forEach(property => {
            if (CommonUtils.isEntityObject(property)) {
                this.generateEntityModel(property, entityModelsDirectory);
                entityModels.push(property.type);
            }

            let fieldProperties: Property[] | undefined = property.properties;
            while (fieldProperties) {
                fieldProperties.forEach(field => {
                    if (CommonUtils.isEntityObject(field)) {
                        this.generateEntityModel(field, entityModelsDirectory);
                    }
                    fieldProperties = field.properties;
                });
            }
        });

        CommonUtils.createDirIfNotExist(modelsDirectory);
        if (verbBody.type === VerbBodyType.request) {
            this.generateRequestModel(verbBody, modelsDirectory, entityModels);
        } else if (verbBody.type === VerbBodyType.response) {
            this.generateResponseModel(verbBody, modelsDirectory, entityModels);
        } else if (verbBody.type === VerbBodyType.model) {
            const entityModel = {
                name: pluralize.singular(verbBody.name),
                properties: verbBody.properties
            } as Property;

            this.generateEntityModel(entityModel, entityModelsDirectory);

            if (isPersistedModel) {
                //Generate database adapter models
                CommonUtils.createDirIfNotExist(adapterModelsDirectory);
                this.generateAdapterModel(verbBody, adapterModelsDirectory);
            }
        }
    }

    /**
     * @description Generates the request model for a given verbBody
     * @param verbBody the verbBody for which the model must be generated
     * @param directory the directory where the model must be generated
     * @returns {void} nothing returned
     */
    private static async generateRequestModel(verbBody: VerbBody, directory: string, entityModelstoImport?: string[]) {
        const requestModelFile = `${Case.kebab(verbBody.name)}.ts`;
        const requestModelFilePath = `${directory}${requestModelFile}`;

        let classContent: string = "";
        let classImports: string[] = [];
        let decoratorImportsMap: Map<string, Set<string>> = new Map<string, Set<string>>()
        let validationConstantImports: string[] = [];
        let validationConstantTypes: Map<string, string> = new Map<string, string>();

        verbBody.properties.forEach(property => {
            const propertyDescr = ModelsUtils.addPropertyDescription(property.description || Case.sentence(`the ${Case.sentence(property.name)}`));
            const validationDecorators: Decorator[] = ModelsUtils.determineValidationDecorators(property);
            let propertyName = property.name;

            if (!property.isRequired) {
                propertyName = propertyName + "?";
            }
            classContent += propertyDescr;
            validationDecorators.forEach(decorator => {
                classContent += `${decorator.declaration}\n`;

                if (decoratorImportsMap.has(decorator.importLib)) {
                    const existingSet = decoratorImportsMap.get(decorator.importLib) || new Set();
                    decoratorImportsMap.set(decorator.importLib, existingSet.add(decorator.name));
                } else {
                    decoratorImportsMap.set(decorator.importLib, new Set<string>().add(decorator.name));
                }

                if (decorator.validationMessageConst) {
                    validationConstantImports.push(decorator.validationMessageConst);
                    validationConstantTypes.set(decorator.validationMessageConst, property.type);
                }
            });

            classContent += `public ${propertyName}: ${property.type};`;
        });

        decoratorImportsMap.forEach((importSet, importLib) => {
            classImports.push(`import {${Array.from(importSet).join()}} from "${importLib}";`);
        });

        if (entityModelstoImport) {
            entityModelstoImport.forEach(entityModel => {
                const entityModelFile = `${Case.kebab(entityModel)}`;
                const entityModelRelativePath = path.relative(`${API_MODELS_DIR}/${requestModelFile}`, `${ENTITY_MODELS_DIR}/${entityModelFile}`).replace(/\\/g, "/");

                classImports.push(`import ${entityModel} from "${entityModelRelativePath}";`);
            });
        }
        if (validationConstantTypes.size > 0) {
            const validationMessageConstantsFileLocation = path.relative(`${API_MODELS_DIR}/${requestModelFile}`, `${VALIDATION_MESSAGES_FILE_DIR}/${VALIDATION_MESSAGES_FILE}`).replace(/\\/g, "/");;
            const validationMessageConstantsDir = `${directory.substring(0, directory.indexOf(`/${API_MODELS_DIR}`))}/${VALIDATION_MESSAGES_FILE_DIR}/`;

            classImports.push(`import {${validationConstantImports.join()}} from "${validationMessageConstantsFileLocation}";`);
            CommonUtils.createDirIfNotExist(validationMessageConstantsDir);
            this.generateValidationMessagesConstants(validationConstantTypes, validationMessageConstantsDir);
        }

        fs.writeFileSync(requestModelFilePath, beautify.js(CommonUtils.createClass({
            name: `${Case.pascal(verbBody.name)}`,
            description: Case.title(`the ${Case.sentence(verbBody.name)} class`),
            content: classContent,
            imports: classImports.join("\n")
        }), { brace_style: "preserve-inline" }));
    }

    /**
     * @description Generates the response model for a given verbBody
     * @param verbBody the verbBody for which the model must be generated
     * @param directory the directory where the model must be generated
     * @returns {void} nothing returned
     */
    private static async generateResponseModel(verbBody: VerbBody, directory: string, entityModels?: string[]) {
        const responseModelFile = `${Case.kebab(verbBody.name)}.ts`;
        const responseModelFilePath = `${directory}${responseModelFile}`;
        let classContent: string = "";
        let classImports: string[] = [];
        let decoratorImportsMap: Map<string, Set<string>> = new Map<string, Set<string>>();

        decoratorImportsMap.set(CLASS_TRANSFORMER_LIB, new Set<string>().add(EXCLUDE));

        verbBody.properties.forEach(property => {
            const propertyDescr = ModelsUtils.addPropertyDescription(property.description || Case.sentence(`the ${Case.sentence(property.name)}`));

            classContent += propertyDescr;
            const transformDecorators: Decorator[] = ModelsUtils.determineTransformerDecorators(property, VerbBodyType.response);
            transformDecorators.forEach(decorator => {
                classContent += `${decorator.declaration}\n`;

                if (decoratorImportsMap.has(decorator.importLib)) {
                    const existingSet = decoratorImportsMap.get(decorator.importLib) || new Set();
                    decoratorImportsMap.set(decorator.importLib, existingSet.add(decorator.name));
                } else {
                    decoratorImportsMap.set(decorator.importLib, new Set<string>().add(decorator.name));
                }
            });
            classContent += `public ${property.name}: ${property.type};`;
        });

        decoratorImportsMap.forEach((importSet, importLib) => {
            classImports.push(`import {${Array.from(importSet).join()}} from "${importLib}";`);
        });

        if (entityModels) {
            entityModels.forEach(entityModel => {
                const entityModelFile = `${Case.kebab(entityModel)}`;
                const entityModelPath = path.relative(`${API_MODELS_DIR}/${responseModelFile}`, `${ENTITY_MODELS_DIR}/${entityModelFile}`).replace(/\\/g, "/");

                classImports.push(`import ${entityModel} from "${entityModelPath}";`);
            });
        }

        fs.writeFileSync(responseModelFilePath, beautify.js(CommonUtils.createClass({
            name: `${Case.pascal(verbBody.name)}`,
            description: Case.title(`the ${Case.sentence(verbBody.name)} class`),
            content: classContent,
            imports: classImports.join("\n"),
            decorators: [`@${EXCLUDE}()`]
        }), { brace_style: "preserve-inline" }));
    }

    /**
     * @description Generates an entity model for a given object
     * @param property the property to convert into an entity model
     * @param directory the directory where the model must be generated
     * @returns {void} nothing returned
     */
    private static async generateEntityModel(property: Property, directory: string) {
        const entityModelFile = Case.kebab(property.name);
        const entityModelFilePath = `${directory}${entityModelFile}.ts`;

        if (property.properties) {
            let classContent: string = "";
            let classImports: string[] = [];
            let decoratorImportsMap: Map<string, Set<string>> = new Map<string, Set<string>>();

            decoratorImportsMap.set(CLASS_TRANSFORMER_LIB, new Set<string>().add(EXCLUDE));

            property.properties.forEach(property => {
                const propertyDescr = ModelsUtils.addPropertyDescription(property.description || Case.sentence(`the ${Case.sentence(property.name)}`));

                classContent += propertyDescr;
                const transformDecorators: Decorator[] = ModelsUtils.determineTransformerDecorators(property, VerbBodyType.model);
                transformDecorators.forEach(decorator => {
                    classContent += `${decorator.declaration}\n`;

                    if (decoratorImportsMap.has(decorator.importLib)) {
                        const existingSet = decoratorImportsMap.get(decorator.importLib) || new Set();
                        decoratorImportsMap.set(decorator.importLib, existingSet.add(decorator.name));
                    } else {
                        decoratorImportsMap.set(decorator.importLib, new Set<string>().add(decorator.name));
                    }
                });

                if (CommonUtils.isEntityObject(property)) {
                    classImports.push(`import ${Case.pascal(property.name)} from "./${Case.kebab(property.name)}";`);
                }

                classContent += `public ${property.name}${property.isRequired ? "" : "?"}: ${property.type};`;
            });

            decoratorImportsMap.forEach((importSet, importLib) => {
                classImports.push(`import {${Array.from(importSet).join()}} from "${importLib}";`);
            });

            fs.writeFileSync(entityModelFilePath, beautify.js(CommonUtils.createClass({
                name: `${Case.pascal(property.name)}`,
                description: Case.title(`the ${Case.sentence(property.name)} class`),
                content: classContent,
                imports: classImports.join("\n"),
                decorators: [`@${EXCLUDE}()`]
            }), { brace_style: "preserve-inline" }));
        }
    }

    /**
     * @description Generates an adapter model for a given object
     * @param verbBody the verbBody for which the model must be generated
     * @param directory the directory where the model must be generated
     * @returns {void} nothing returned
     */
    private static async generateAdapterModel(verbBody: VerbBody, directory: string) {
        const className = Case.pascal(pluralize.singular(verbBody.name.replace("-model", "")) + "-database");
        const adapterModelFile = `${Case.kebab(className)}.ts`;
        const adapterModelFilePath = `${directory}${adapterModelFile}`;
        const entityModel = Case.pascal(verbBody.name);
        const modelId = Case.snake(pluralize.singular(verbBody.name.replace("-model", "_id")));

        let classContent: string = "";
        let classImports: string[] = [];
        let decoratorImportsMap: Map<string, Set<string>> = new Map<string, Set<string>>();

        decoratorImportsMap.set(CLASS_TRANSFORMER_LIB, new Set<string>().add(EXCLUDE));

        DATABASE_FIELDS.forEach(property => {
            property.name = property.name === "model_id" ? modelId : property.name;
            const propertyDescr = ModelsUtils.addPropertyDescription(property.description || Case.sentence(`the ${Case.sentence(property.name)}`));

            classContent += propertyDescr;
            const transformDecorators: Decorator[] = ModelsUtils.determineTransformerDecorators(property, VerbBodyType.response);
            transformDecorators.forEach(decorator => {
                classContent += `${decorator.declaration}\n`;

                if (decoratorImportsMap.has(decorator.importLib)) {
                    const existingSet = decoratorImportsMap.get(decorator.importLib) || new Set();
                    decoratorImportsMap.set(decorator.importLib, existingSet.add(decorator.name));
                } else {
                    decoratorImportsMap.set(decorator.importLib, new Set<string>().add(decorator.name));
                }
            });
            classContent += `public ${property.name}: ${property.type};`;
        });

        decoratorImportsMap.forEach((importSet, importLib) => {
            classImports.push(`import {${Array.from(importSet).join()}} from "${importLib}";`);
        });

        const entityModelFile = Case.kebab(entityModel);
        const entityModelPath = path.relative(`${ADAPTER_MODELS_DIR}/`, `${ENTITY_MODELS_DIR}/${entityModelFile}`).replace(/\\/g, "/");

        classImports.push(`import ${entityModel} from "${entityModelPath}";`);

        fs.writeFileSync(adapterModelFilePath, beautify.js(CommonUtils.createClass({
            name: `${className} extends ${entityModel}`,
            description: Case.title(`the ${Case.sentence(className)} class`),
            content: classContent,
            imports: classImports.join("\n"),
            decorators: [`@${EXCLUDE}()`]
        }, [" default"]), { brace_style: "preserve-inline" }));
    }

    /**
     * @description Generates validation messages constants
     * @param constantsTypes a map of constants and their corresponding types
     * @param directory the directory where the constants must be generated
     * @returns {void} nothing returned
     */
    private static async generateValidationMessagesConstants(constantsTypes: Map<string, string>, directory: string) {
        let classContent: string = "";
        const validationMessagesFilePath = `${directory}${VALIDATION_MESSAGES_FILE}.ts`;
        const addExportToClassContent = (constant: string, type: string) => {
            if (constant.includes("REQUIRED")) {
                const property = constant.substring(0, constant.indexOf("_REQUIRED"));
                classContent += `export const ${constant} = "The ${Case.snake(property)} must be provided.";`;
            }
            if (constant.includes("FORMAT_TYPE")) {
                const property = constant.substring(0, constant.indexOf("_FORMAT_TYPE"));
                classContent += `export const ${constant} = "The field ${Case.snake(property)} must be a ${type}.";`;
            }
        };

        if (fs.existsSync(validationMessagesFilePath)) {
            const existingFileContent = fs.readFileSync(validationMessagesFilePath, "utf8");
            constantsTypes.forEach((type, constant) => {
                if (!existingFileContent.includes(`export const ${constant}`)) {
                    addExportToClassContent(constant, type);
                }
            });
            if (classContent != "") {
                fs.appendFileSync(validationMessagesFilePath, "\n" + beautify.js(classContent) + "\n");
            }
        } else {
            constantsTypes.forEach((type, constant) => {
                addExportToClassContent(constant, type);
            });
            fs.writeFileSync(validationMessagesFilePath, beautify.js(classContent) + "\n");
        }
    }

}
