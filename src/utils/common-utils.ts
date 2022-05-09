import fs from "fs";
import { Property } from "../models/domain/property";
import { Class } from "../models/domain/class";
import Case from "case";
import { CLASS_TEMPLATE, DECORATED_CLASS_TEMPLATE, DECORATED_METHOD_TEMPLATE, METHOD_TEMPLATE } from "../constants";
import { Method } from "../models/domain/method";

/**
 * @description Utilities used across the service
 */
export default class CommonUtils {
    /**
     * @description Checks whether a field name is a valid REST verb
     * @param fieldName the field name to check
     * @returns returns a boolean value
     */
    public static isValidVerb(fieldName: string): boolean {
        if (fieldName === 'post' ||
            fieldName === 'put' ||
            fieldName === 'get' ||
            fieldName === 'delete') {
            return true;
        }
        return false;
    }

    /**
     * @description Traverses a given object to look for a particular field
     * @param object the object to traverse
     * @param path the path of the field desired
     * @returns returns the field if it is found in target object. Else returns undefined
     */
    public static getField = (object: any, path: string) => {
        if (object == null) {
            return object;
        }
        const parts = path.split('.');
        for (let i = 0; i < parts.length; ++i) {
            if (object == null) {
                return undefined;
            }
            const key: string = parts[i];
            object = object[key];
        }
        return object;
    };

    /**
     * @description Creates a directory in a given path if it does not yet exist
     * @param targetPath the target path
     * @returns {void} nothing returned
     */
    public static createDirIfNotExist = (targetPath: string) => {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    }

    /**
     * @description determined whether a property is an entity object or not
     * @param property the property
     * @returns {boolean} returns a boolean value
     */
    public static isEntityObject = (property: Property) => {
        return property.type.replace('[]', '') === Case.pascal(property.name);
    }

    /**
     * @description creates a class as a string based on the class template
     * @param newClass the new class attributes
     * @param additionalReplaces a list of additional targets to remove from the template
     * @returns {string} returns the newly created class as a string
     */
    public static createClass = (newClass: Class, additionalReplaces?: string[]): string => {
        const empty = "";
        const classDecorators = newClass.decorators ? newClass.decorators.join("\n") : empty;
        let createdClass = fs.readFileSync(newClass.decorators ? DECORATED_CLASS_TEMPLATE : CLASS_TEMPLATE, { encoding: "utf-8" });

        createdClass = createdClass.replace(/className/g, newClass.name)
            .replace(/classDescription/g, newClass.description)
            .replace(/classContent/g, newClass.content || empty)
            .replace(/classImports/g, newClass.imports || empty)
            .replace(/classDecorators/g, classDecorators);

        if (additionalReplaces) {
            additionalReplaces.forEach(target => {
                let re = new RegExp(`${target}`);
                createdClass = createdClass.replace(re, "");
            })
        }

        return createdClass;
    }

    /**
     * @description append a method at the end of an existing class
     * @param originalClass the original class
     * @param toAdd the method to append at the end of class
     * @returns {string} returns the updated class
     */
    public static updateClass = (originalClass: string, toAdd: string, targetedIndex?: number): string => {

        return originalClass.substring(0, targetedIndex || (originalClass.lastIndexOf("}")))
            + toAdd
            + originalClass.substring(targetedIndex || (originalClass.lastIndexOf("}")), originalClass.length);
    }

    /**
     * @description creates a method as a string based on the method template
     * @param method the new method attributes
     * @returns {string} returns the newly created method as a string
     */
    public static createMethod = (method: Method, additionalReplaces?: string[]): string => {
        const empty = "";
        const methodParamsDescription = method.paramsDescriptions || empty;
        const methodDecorators = method.decorators ? method.decorators.join("\n") : empty;
        const methodParams = method.params ? method.params : empty;
        let createdMethod = fs.readFileSync(method.decorators ? DECORATED_METHOD_TEMPLATE : METHOD_TEMPLATE, { encoding: "utf-8" });

        createdMethod = createdMethod.replace(/methodName/g, method.name)
            .replace(/methodDescription/g, method.description)
            .replace(/methodParamsDescription/g, methodParamsDescription)
            .replace(/methodReturnType/g, method.returnType || "void")
            .replace(/methodReturnDescr/g, `returns ${method.returnType ? `a ${method.returnType} object` : "nothing"}`)
            .replace(/methodDecorators/g, methodDecorators)
            .replace(/methodParams/g, methodParams)
            .replace(/methodOperationId/g, method.operationId);

        if (additionalReplaces) {
            additionalReplaces.forEach(target => {
                let re = new RegExp(`${target}`);
                createdMethod = createdMethod.replace(re, "");
            })
        }

        return createdMethod;
    }

    /**
     * @description formats the description parameters of a method
     * @param descriptionParams the array of description paramters to be formatted
     * @returns {string} returns the formatted description paramters as a string
     */
    public static formatMethodDescrParams(descriptionParams: string[]): string {
        for (let i = 0; i < descriptionParams.length; i++) {
            if (i === 0) {
                descriptionParams[i] = `@param ${descriptionParams[i]}`;
            } else {
                descriptionParams[i] = `* @param ${descriptionParams[i]}`;
            }
        }
        return descriptionParams.join("\n");
    }
}
