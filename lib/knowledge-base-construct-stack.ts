import * as cdk from "aws-cdk-lib";
import { AccountRootPrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { OpenSearchCollection } from "./constructs/open-search/open-search-collection";
import { OpenSearchIndex } from "./constructs/open-search/open-search-index";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class KnowledgeBaseConstructStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const collection = new OpenSearchCollection(this, "OpenSearchCollection", {
      allowPublicAccess: true,
    });

    new OpenSearchIndex(this, "index", {
      collection: collection,
      indexName: "fourth-index",
      vectorDimension: 1024,
    });


    collection.grantRead(new AccountRootPrincipal())

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'KnowledgeBaseConstructQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
