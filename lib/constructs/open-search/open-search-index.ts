import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

import * as cr from "aws-cdk-lib/custom-resources";
import { Construct, IDependable } from "constructs";
import { IVectorIndex } from "../knowledge-base/vector-index";
import { LambdaFunction } from "../utils/lambda-function";
import { OpenSearchCollection } from "./open-search-collection";
import { OpenSearchDataAccessPolicy } from "./open-search-data-access-policy";

interface OpenSearchIndexProps {
  indexName: string;
  vectorDimension: number;
  collection: OpenSearchCollection;
  logGroup?: logs.ILogGroup;
  logRetention?: logs.RetentionDays;
  dataAccessPolicy: OpenSearchDataAccessPolicy;
  role: iam.IRole;
}

/**
 * Resource to create an index in the OpenSearch collection
 * passed as a parameter in {@link OpenSearchIndexProps.collection}. It configures the index as a vector index
 * with the dimension specified in {@link OpenSearchIndexProps.vectorDimension}. The name of the index is specified in
 * {@link OpenSearchIndexProps.indexName}.
 */
export class OpenSearchIndex
  extends Construct
  implements IVectorIndex, IDependable
{
  public readonly metadataField: string = "METADATA";
  public readonly textField: string = "TEXT_CHUNK";
  public readonly vectorField: string;
  public readonly collection: OpenSearchCollection;
  public readonly indexName: string;

  public readonly indexProvider: cr.Provider;
  private readonly indexCreation: cdk.CustomResource;
  private readonly dataAccessPolicy: OpenSearchDataAccessPolicy;

  public constructor(
    scope: Construct,
    id: string,
    props: OpenSearchIndexProps
  ) {
    super(
      scope,
      `${id}-${cdk.Names.uniqueId(props.collection)}-${props.indexName}-${props.vectorDimension}`
    );

    this.vectorField = props.indexName;
    this.collection = props.collection;
    this.indexName = props.indexName;
    this.dataAccessPolicy = props.dataAccessPolicy;

    const { function: createIndexHandler } = new LambdaFunction(
      this,
      "lambda",
      {
        functionProps: {
          entry: path.join(__dirname, "open-search-index.handler.ts"),
          environment: {
            OPENSEARCH_DOMAIN: props.collection.attrCollectionEndpoint,
          },
          role: props.role,
          timeout: cdk.Duration.minutes(5),
          logGroup: props.logGroup,
        },
      }
    );

    this.indexProvider = new cr.Provider(this, "create-index-provider", {
      onEventHandler: createIndexHandler,
      logRetention: props.logRetention,
      logGroup: props.logGroup,
    });

    // Custom resource ignores delete event, if create event failed with an unhandled error.
    this.indexCreation = new cdk.CustomResource(
      this,
      cdk.Names.uniqueId(this),
      {
        serviceToken: this.indexProvider.serviceToken,
        properties: {
          indexName: props.indexName,
          dimensions: props.vectorDimension,
          metadataField: this.metadataField,
          textField: this.textField,
          vectorField: props.indexName,
          val: 2,
        },
      }
    );
  }

  public grantReadWrite(principal: iam.IPrincipal): iam.Grant {
    return this.collection.grantApiAccess(principal);
  }
}
