import fs from "fs";
import Case from "case";
import { CLASS_TRANSFORMER_LIB, CLASS_VALIDATOR_LIB, EXPOSE, FIELD_DESCRIPTION_TEMPLATE, IS_ARRAY, IS_BOOLEAN, IS_DEFINED, IS_EMAIL, IS_NOT_EMPTY, IS_NUMBER, IS_OBJECT, IS_OPTIONAL, IS_PHONE_NUMBER, IS_STRING, TRANSFORM_BOOLEAN, TRANSFORM_NUMBER, TRANSFORM_OBJECT, TRANSFORM_OBJECT_ARRAY, TRANSFORM_STRING, TYPE, UO_TRANSFORM_DECORATORS_LIB } from "../constants";
import { VerbBodyType } from "../enums/verb-body-type.enum";
import { Decorator } from "../models/domain/decorator";
import { Property } from "../models/domain/property";
import CommonUtils from "./common-utils";

/**
 * @description Utilities used within the models.service service file
 */
export default class ModelsUtils {
    /**
         * @description returns a list of transform decorators applicable to a given property
         * @param property the property for which the decorator list must be determined
         * @returns {Decorator[]} returns the list of decorators
         */
    public static determineTransformerDecorators(property: Property, verbBodyType: VerbBodyType): Decorator[] {
        let decorators: Decorator[] = [];

        decorators.push({
            name: EXPOSE,
            declaration: `@${EXPOSE}()`,
            importLib: CLASS_TRANSFORMER_LIB
        })

        if (CommonUtils.isEntityObject(property)) {
            decorators.push({
                name: TYPE,
                declaration: `@${TYPE}(() => ${property.type.replace("[]", "")})`,
                importLib: CLASS_TRANSFORMER_LIB,
            });
        }

        if (verbBodyType === VerbBodyType.model) {
            if (property.type === "string") {
                decorators.push({
                    name: TRANSFORM_STRING,
                    declaration: `@${TRANSFORM_STRING}("${property.name}", "", [""] )`,
                    importLib: UO_TRANSFORM_DECORATORS_LIB
                })
            }
            if (property.type === "number") {
                decorators.push({
                    name: TRANSFORM_NUMBER,
                    declaration: `@${TRANSFORM_NUMBER}("${property.name}", 0, [""] )`,
                    importLib: UO_TRANSFORM_DECORATORS_LIB
                })
            }
            if (property.type === "boolean") {
                decorators.push({
                    name: TRANSFORM_BOOLEAN,
                    declaration: `@${TRANSFORM_BOOLEAN}("${property.name}", "", [""] )`,
                    importLib: UO_TRANSFORM_DECORATORS_LIB
                })
            }
            if (CommonUtils.isEntityObject(property) && !property.type.includes("[]")) {
                decorators.push({
                    name: TRANSFORM_OBJECT,
                    declaration: `@${TRANSFORM_OBJECT}("${property.name}", ${Case.pascal(property.name)}, undefined, [""] )`,
                    importLib: UO_TRANSFORM_DECORATORS_LIB
                })
            }
            if (property.type.includes("[]") && CommonUtils.isEntityObject(property)) {
                decorators.push({
                    name: TRANSFORM_OBJECT_ARRAY,
                    declaration: `@${TRANSFORM_OBJECT_ARRAY}("${property.name}", ${Case.pascal(property.name)}, [], [""] )`,
                    importLib: UO_TRANSFORM_DECORATORS_LIB
                })
            }
        }

        return decorators;
    }

    /**
     * @description returns a list of validation decorators applicable to a given property
     * @param property the property for which the decorator list must be determined
     * @returns {Decorator[]} returns the list of decorators
     */
    public static determineValidationDecorators(property: Property): Decorator[] {
        const type = property.type;
        const typesThatCannotBeEmptyIfRequired = ["string", "number", "boolean"];
        const propertyName = Case.snake(property.name);
        const formatTypeMessageConst = Case.constant(propertyName + "_format_type");
        const formatArrayMessageConst = Case.constant(propertyName + "_format_array");
        const requiredFieldMessageConst = Case.constant(propertyName + "_required");
        let decorators: Decorator[] = [];

        if (property.isRequired) {
            decorators.push({
                name: IS_DEFINED,
                declaration: `@${IS_DEFINED}({message: ${requiredFieldMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: requiredFieldMessageConst
            });

            if (typesThatCannotBeEmptyIfRequired.includes(type)) {
                decorators.push({
                    name: IS_NOT_EMPTY,
                    declaration: `@${IS_NOT_EMPTY}()`,
                    importLib: CLASS_VALIDATOR_LIB
                });
            }
        } else {
            decorators.push({
                name: IS_OPTIONAL,
                declaration: `@${IS_OPTIONAL}()`,
                importLib: CLASS_VALIDATOR_LIB
            });
        }

        if (propertyName.includes("email")) {
            decorators.push({
                name: IS_EMAIL,
                declaration: `@${IS_EMAIL}({message: ${formatTypeMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: formatTypeMessageConst
            });
        }
        else if (propertyName.includes("phone")) {
            decorators.push({
                name: IS_PHONE_NUMBER,
                declaration: `@${IS_PHONE_NUMBER}({message: ${formatTypeMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: formatTypeMessageConst
            });
        }
        else if (type === "string") {
            decorators.push({
                name: IS_STRING,
                declaration: `@${IS_STRING}({message: ${formatTypeMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: formatTypeMessageConst
            });
        }
        else if (type === "number") {
            decorators.push({
                name: IS_NUMBER,
                importLib: CLASS_VALIDATOR_LIB,
                declaration: `@${IS_NUMBER}({allowNaN: false})`
            });
        }
        else if (type === "boolean") {
            decorators.push({
                name: IS_BOOLEAN,
                declaration: `@${IS_BOOLEAN}({message: ${formatTypeMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: formatTypeMessageConst
            });
        }
        else if (type.includes("[]")) {
            decorators.push({
                name: IS_ARRAY,
                declaration: `@${IS_ARRAY}({message: ${formatArrayMessageConst}})`,
                importLib: CLASS_VALIDATOR_LIB,
                validationMessageConst: formatArrayMessageConst
            });
        }

        if (CommonUtils.isEntityObject(property)) {
            decorators.push({
                name: IS_OBJECT,
                declaration: `@${IS_OBJECT}()`,
                importLib: CLASS_VALIDATOR_LIB
            });
            decorators.push({
                name: TYPE,
                declaration: `@${TYPE}(() => ${property.type})`,
                importLib: CLASS_TRANSFORMER_LIB,
            });
        }

        return decorators;
    }

    /**
     * @description returns a commented description
     * @param description the description that needs to be commented out
     * @returns {string} returns commented out description
     */
     public static addPropertyDescription(description: string): string {
        let commentTemplate = fs.readFileSync(FIELD_DESCRIPTION_TEMPLATE, { encoding: "utf-8" });
        return commentTemplate.replace(/description/g, description);
    }
}
