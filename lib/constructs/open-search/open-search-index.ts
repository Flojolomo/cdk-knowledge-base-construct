import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { LambdaFunction } from "../utils/lambda-function";
import { OpenSearchCollection } from "./open-search-collection";

interface OpenSearchIndexProps {
  indexName: string;
  vectorDimension: number;
  collection: OpenSearchCollection;
}

/**
 * Resource to create an index in the OpenSearch collection
 * passed as a parameter in {@link OpenSearchCollectionProps.collection}. It configures the index as a vector index
 * with the dimension specified in {@link OpenSearchIndexProps.vectorDimension}. The name of the index is specified in
 * {@link OpenSearchIndexProps.indexName}.
 */
export class OpenSearchIndex extends Construct {
  public readonly metadataField: string = "METADATA";
  public readonly textField: string = "TEXT_CHUNK";
  public readonly vectorField: string;

  public constructor(
    scope: Construct,
    id: string,
    props: OpenSearchIndexProps,
  ) {
    // TODO consider index name as id to force replacement
    super(
      scope,
      `${id}-${cdk.Names.uniqueId(props.collection)}-${props.indexName}-${props.vectorDimension}`,
    );

    this.vectorField = props.indexName;

    const { function: createIndexHandler } = new LambdaFunction(
      this,
      "lambda",
      {
        functionProps: {
          entry: path.join(__dirname, "open-search-index.handler.ts"),
          environment: {
            OPENSEARCH_DOMAIN: props.collection.attrCollectionEndpoint,
          },
        },
      },
    );

    const provider = new cr.Provider(this, "create-index-provider", {
      onEventHandler: createIndexHandler,
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const customResource = new cdk.CustomResource(
      this,
      cdk.Names.uniqueId(this),
      {
        serviceToken: provider.serviceToken,
        properties: {
          indexName: props.indexName,
          dimensions: props.vectorDimension,
          metadataField: this.metadataField,
          textField: this.textField,
          vectorField: props.indexName,
          val: 2
        },
      },
    );

    const grant = props.collection.grantReadWrite(createIndexHandler.role!);

    customResource.node.addDependency(grant);
  }
}