import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

import { Construct } from "constructs";
import { KnowledgeBase } from "./constructs/knowledge-base/knowledge-base";
import { OpenSearchCollection } from "./constructs/open-search/open-search-collection";
import { OpenSearchDataAccessPolicy } from "./constructs/open-search/open-search-data-access-policy";
import { OpenSearchIndex } from "./constructs/open-search/open-search-index";

export class KnowledgeBaseConstructStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, "log-group", {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const createIndexRole = new iam.Role(this, "create-index-role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    const bedrockServiceRole = new iam.Role(this, "knowledge-base-role", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    const embeddingModel = bedrock.FoundationModel.fromFoundationModelId(
      this,
      "embedding-model",
      {
        modelId: "cohere.embed-english-v3",
      }
    );

    const collection = new OpenSearchCollection(this, "OpenSearchCollection", {
      allowPublicAccess: true,
    });

    const dataAccessPolicy = new OpenSearchDataAccessPolicy(
      this,
      "data-access-policy",
      {
        collection,
      }
    );

    dataAccessPolicy.grantReadWrite(createIndexRole);
    dataAccessPolicy.grantReadWrite(bedrockServiceRole);

    const vectorIndex = new OpenSearchIndex(this, "index", {
      collection: collection,
      indexName: "fourth-index",
      vectorDimension: 1024,
      logGroup,
      dataAccessPolicy,
      role: createIndexRole,
    });

    vectorIndex.grantReadWrite(createIndexRole);
    const knowledgeBase = new KnowledgeBase(this, "knowledge-base", {
      vectorIndex,
      embeddingModel,
      logGroup,
      serviceRole: bedrockServiceRole,
    });

    knowledgeBase.dataSource.syncAfterCreation();
    knowledgeBase.dataSource.syncOnSchedule(
      events.Schedule.rate(cdk.Duration.minutes(5))
    );

    // collection.grantRead(new iam.AccountRootPrincipal());

    // const secondDataSource = knowledgeBase.addDataSource("dummy-2")

    // secondDataSource.syncAfterCreation()
    // secondDataSource.syncOnSchedule(events.Schedule.rate(cdk.Duration.minutes(5)))
  }
}
