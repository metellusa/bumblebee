import "reflect-metadata";
import { createExpressServer } from 'routing-controllers';
import ActionsController from "./api/actions.controller";
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import YAML from 'yaml';

// creates express app, registers all controller routes and returns express app instance
const app = createExpressServer({
  controllers: [ActionsController] // specify controllers we want to use
});

const yamlFile = fs.readFileSync(__dirname + './../yaml/uo-repo-files-generator.yaml', 'utf8')
const swaggerDoc = YAML.parse(yamlFile)

app.use('/explorer', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {isExplorer: false}));

app.listen(3000);
