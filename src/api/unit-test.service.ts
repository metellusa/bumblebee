import fs from "fs";
import beautify from "js-beautify";
import Case from "case";
import {
    ADAPTER_TESTS_DIR,
    ADAPTER_TEST_FILE_SUFFIX,
    APIS_DIR,
    API_TESTS_PATH_SUFFIX,
    CHAI,
    CONTROLLER_TEST_FILE_SUFFIX,
    DESCRIBE_BLOCK_TEMPLATE,
    EXPECT,
    PERSISTENT_MODEL_LABEL,
    SERVICE_TEST_FILE_SUFFIX,
    SINON,
    SPEC_FILE_TEMPLATE
} from "../constants";
import { Verb } from "../models/domain/verb";
import pluralize from "pluralize";
import { Swagger } from "../models/domain/swagger";
import CommonUtils from "../utils/common-utils";
import { DescribeBlock } from "../models/domain/describe-block";
import UnitTestUtils from "../utils/unit-test-utils";
export default class UnitTestService {

    /**
     * @description Generates unit test files for a given swagger
     * @param swagger the swagger for which the test files must be generated
     * @returns {void} nothing returned
     */
    public static async generateUnitTestFiles(swagger: Swagger) {
        if (fs.existsSync(swagger.targetLocation)) {
            swagger.paths.forEach((path) => {
                path.verbs.forEach((verb) => {
                    const testFilesDir = `${swagger.targetLocation}/${APIS_DIR}/${Case.kebab(verb.tag)}/${API_TESTS_PATH_SUFFIX}/`;

                    CommonUtils.createDirIfNotExist(testFilesDir);
                    // Generate the service unit test files
                    this.generateServiceTests(verb, testFilesDir);

                    // Generate the controller unit test files
                    this.generateControllerTests(verb, testFilesDir);
                });
            });

            swagger.tags.forEach((tag) => {
                // Generate the adapter unit test files
                if (tag.includes(PERSISTENT_MODEL_LABEL)) {
                    const adapterTestFilesDir = `${swagger.targetLocation}/${ADAPTER_TESTS_DIR}/`;

                    CommonUtils.createDirIfNotExist(adapterTestFilesDir);
                    this.generateAdapterTests(tag, adapterTestFilesDir);
                }
            });
        } else {
            throw new Error(`Target location: ${swagger.targetLocation} does not exist`);
        }
    }

    /**
     * @description Generates service spec files in a given directory
     * @param verb the verb for which the service spec files must be generated
     * @param directory the directory where the spec files must be generated
     * @returns {void} nothing returned
     */
    protected static async generateServiceTests(verb: Verb, directory: string) {
        const isGetById = verb.signature === "get" && verb.url.charAt(verb.url.length - 1) === "}";
        let serviceSpecFile: string;
        let specImports: string[] = [];
        let methodName: string;

        const specDescription = `"${Case.title(`${verb.signature}_${verb.model}_service`)}"`;

        if (verb.isPersistedModel) {
            serviceSpecFile = `${verb.signature}-${verb.model}.${SERVICE_TEST_FILE_SUFFIX}`;
            methodName = `${Case.camel(`${verb.signature}-${verb.model}`)}${isGetById ? "ById" : ""}`;
            if (verb.signature === "get" && !isGetById) {
                methodName = pluralize.plural(methodName);
            }
        } else {
            const businessFunction = verb.url.substring(verb.url.lastIndexOf("/") + 1, verb.url.length);
            serviceSpecFile = `${verb.signature}-${businessFunction}.${SERVICE_TEST_FILE_SUFFIX}`;
            methodName = `${Case.camel(`${verb.signature}-${businessFunction}`)}`;
        }

        specImports.push(`import ${EXPECT} from "${CHAI}";`);
        specImports.push(`import ${SINON} from "${SINON}";`);

        const successDescribeBlock = UnitTestUtils.createDescribeBlock({
            description: `"Success"`
        });

        const innerDescribeBlock = UnitTestUtils.createDescribeBlock({
            description: `"${methodName}"`,
            content: successDescribeBlock
        });

        UnitTestUtils.createOrUpdateSpecFile({
            folder: directory,
            file: serviceSpecFile,
            specDescription,
            specImports,
            innerDescribeBlock: innerDescribeBlock,
            innerDescribeBlockDescription: `"${Case.constant(verb.signature)} ${Case.pascal(verb.model)}"`
        });
    }

    /**
     * @description Generates controller spec files in a given directory
     * @param verb the verb for which the controller spec files must be generated
     * @param directory the directory where the spec files must be generated
     * @returns {void} nothing returned
     */
    private static async generateControllerTests(verb: Verb, directory: string) {
        const controllerTestFile = `${Case.kebab(verb.tag)}.${CONTROLLER_TEST_FILE_SUFFIX}`;
        const isGetById = verb.signature === "get" && verb.url.charAt(verb.url.length - 1) === "}";
        let specImports: string[] = [];
        let methodName: string;

        const specDescription = `"${Case.title(`${verb.signature}_${verb.model}_controller`)}"`;

        specImports.push(`import ${EXPECT} from "${CHAI}";`);
        specImports.push(`import ${SINON} from "${SINON}";`);

        const successDescribeBlock = UnitTestUtils.createDescribeBlock({
            description: `"Success"`
        });

        if (verb.isPersistedModel) {
            methodName = `${Case.camel(`${verb.signature}-${verb.model}`)}${isGetById ? "ById" : ""}`;
            if (verb.signature === "get" && !isGetById) {
                methodName = pluralize.plural(methodName);
            }
        } else {
            const businessFunction = verb.url.substring(verb.url.lastIndexOf("/") + 1, verb.url.length);
            methodName = `${Case.camel(`${verb.signature}-${businessFunction}`)}`;
        }

        const innerDescribeBlock = UnitTestUtils.createDescribeBlock({
            description: `"${methodName}"`,
            content: successDescribeBlock
        });

        UnitTestUtils.createOrUpdateSpecFile({
            folder: directory,
            file: controllerTestFile,
            specDescription,
            specImports,
            innerDescribeBlock: innerDescribeBlock,
            innerDescribeBlockDescription: `"${Case.constant(verb.signature)} ${Case.pascal(verb.model)}"`
        });
    }

    /**
     * @description Generates adapter spec files in a given directory
     * @param tag the path tag
     * @param directory the directory where the spec files must be generated
     * @returns {void} nothing returned
     */
    private static async generateAdapterTests(tag: string, directory: string) {
        let adapterFile = `${Case.kebab(tag)}.${ADAPTER_TEST_FILE_SUFFIX}`;

        fs.appendFileSync(`${directory}${adapterFile}`, " ");
    }
}
