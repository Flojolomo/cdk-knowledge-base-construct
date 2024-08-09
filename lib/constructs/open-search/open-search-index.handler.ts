import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { Logger } from "@aws-lambda-powertools/logger";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from "aws-lambda";
import * as env from "env-var";

interface IndexConfiguration {
  indexName: string;
  dimensions: number;
  metadataField: string;
  textField: string;
  vectorField: string;
}

const OPENSEARCH_DOMAIN = env.get("OPENSEARCH_DOMAIN").required().asString();
const AWS_REGION = env.get("AWS_REGION").required().asString();

const logger = new Logger({ serviceName: "OpenSearchIndex" });

const openSearchClient = new Client({
  ...AwsSigv4Signer({
    region: AWS_REGION,
    service: "aoss", // 'aoss' for OpenSearch Serverless
    // Must return a Promise that resolve to an AWS.Credentials object.
    // This function is used to acquire the credentials when the client start and
    // when the credentials are expired.
    // The Client will refresh the Credentials only when they are expired.
    // With AWS SDK V2, Credentials.refreshPromise is used when available to refresh the credentials.

    // Example with AWS SDK V3:
    getCredentials: () => {
      // Any other method to acquire a new Credentials object can be used.
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    },
  }),
  node: OPENSEARCH_DOMAIN,
});

class Handler implements LambdaInterface {
  private async createIndex({
    indexName,
    metadataField,
    textField,
    dimensions,
    vectorField,
  }: IndexConfiguration) {
    try {
      const indexExists = await openSearchClient.indices.exists({
        index: indexName,
      });
      if (indexExists) {
        // throw new Error(`Index ${indexName} already exists`);
      }

      await openSearchClient.indices.create({
        index: indexName,
        body: {
          settings: {
            index: {
              knn: true,
            },
          },
          mappings: {
            properties: {
              [metadataField]: {
                type: "text",
                index: false,
              },
              [textField]: {
                type: "text",
                index: true,
              },
              [vectorField]: {
                type: "knn_vector",
                dimension: dimensions,
                method: {
                  name: "hnsw",
                  space_type: "l2",
                  engine: "faiss",
                },
              },
            },
          },
        },
      });
    } catch (e) {
      logger.error("Error creating index", { error: e });
    }
  }
  private async deleteIndex({ indexName }: { indexName: string }) {
    try {
      await openSearchClient.indices.delete({ index: indexName });
    } catch (e) {
      logger.error("Error deleting index", { error: e });
    }
  }

  @logger.injectLambdaContext({ logEvent: true })
  public async handler(
    event: CloudFormationCustomResourceEvent,
    _context: Context,
  ): Promise<CloudFormationCustomResourceResponse> {
    const indexConfig = event.ResourceProperties;
    switch (event.RequestType) {
      case "Create":
      case "Update":
        await this.createIndex({
          indexName: indexConfig.indexName,
          metadataField: indexConfig.metadataField,
          textField: indexConfig.textField,
          dimensions: Number(indexConfig.dimensions),
          vectorField: indexConfig.vectorField,
        });
        break;
      // throw new Error("Updates of indices are not supported");
      case "Delete":
        // TODO verify
        await this.deleteIndex({
          indexName: event.ResourceProperties.indexName,
        });
    }

    return {
      Status: "SUCCESS",
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      PhysicalResourceId: event.ResourceProperties.INDEX_NAME,
    };
  }
}

const lambdaHandler = new Handler();
export const handler = lambdaHandler.handler.bind(lambdaHandler);

// export const handler = async (
//   event: CloudFormationCustomResourceEvent
// ): Promise<CloudFormationCustomResourceResponse> => {
//   console.log("#####", event);

//   const indexName = event.ResourceProperties.INDEX_NAME;
//   const indexConfiguration = event.ResourceProperties.INDEX_CONFIGURATION;

//   if (!indexName) {
//     throw new Error("Missing INDEX_NAME in ResourceProperties");
//   }

//   if (!indexConfiguration) {
//     throw new Error("Missing INDEX_CONFIGURATION in ResourceProperties");
//   }

//   if (event.RequestType === "Delete") {
//     console.log("Deleting index ", indexName);
//     deleteIndex(indexName);
//     return {
//       Status: "SUCCESS",
//       RequestId: event.RequestId,
//       LogicalResourceId: event.LogicalResourceId,
//       StackId: event.StackId,
//       PhysicalResourceId: indexName,
//     };
//   }

//   await verifyIndexExists(indexName, indexConfiguration);

//   return {
//     Status: "SUCCESS",
//     RequestId: event.RequestId,
//     LogicalResourceId: event.LogicalResourceId,
//     StackId: event.StackId,
//     PhysicalResourceId: indexName,
//   };
// };

// async function createIndex(
//   name: string,
//   indexConfiguration: IndexConfiguration
// ) {
//   await openSearchClient.indices.create({
//     index: name,
//     body: {
//       settings: {
//         index: {
//           knn: true,
//         },
//       },
//       mappings: {
//         properties: {
//           [indexConfiguration.MAPPING_FIELD_METADATA]: {
//             type: "text",
//             index: false,
//           },
//           [indexConfiguration.MAPPING_FIELD_TEXT_CHUNK]: {
//             type: "text",
//             index: true,
//           },
//           [indexConfiguration.VECTOR_FIELD]: {
//             type: "knn_vector",
//             dimension: Number(indexConfiguration.DIMENSION),
//             method: {
//               name: "hnsw",
//               space_type: "l2",
//               engine: "faiss",
//             },
//           },
//         },
//       },
//     },
//   });
// }

// async function verifyIndexExists(
//   indexName: string,
//   indexConfiguration: IndexConfiguration
// ) {
//   const indexExists = await (
//     await openSearchClient.indices.exists({ index: indexName })
//   ).body;
//   if (!indexExists) {
//     console.log("Creating index ", indexConfiguration);

//     await createIndex(indexName, indexConfiguration);
//     console.log("Index created");
//   }

//   console.log("Index exists");
// }

// async function deleteIndex(indexName: string) {
//   await openSearchClient.indices.delete({ index: indexName });
// }
