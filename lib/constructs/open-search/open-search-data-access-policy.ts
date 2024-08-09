import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as osServerless from "aws-cdk-lib/aws-opensearchserverless";
import { Construct } from "constructs";

type DataAccessPolicyStatement = {
  Rules: {
    Resource: string[];
    Permission: string[];
    ResourceType: string;
  }[];
  Principal: string[];
  Description?: string;
};

interface OpenSearchDataAccessPolicyProps {
  collection: osServerless.CfnCollection;
}

export class OpenSearchDataAccessPolicy extends osServerless.CfnAccessPolicy {
  private static readonly COLLECTION_READ_PERMISSIONS = [
    "aoss:DescribeCollectionItems",
  ];
  private static readonly COLLECTION_READ_WRITE_PERMISSIONS = [
    ...OpenSearchDataAccessPolicy.COLLECTION_READ_PERMISSIONS,
    "aoss:CreateCollectionItems",
    "aoss:DeleteCollectionItems",
    "aoss:UpdateCollectionItems",
    "aoss:*",
  ];

  private static readonly INDEX_READ_PERMISSIONS = [
    "aoss:DescribeIndex",
    "aoss:ReadDocument",
  ];

  private static readonly INDEX_READ_WRITE_PERMISSIONS = [
    ...OpenSearchDataAccessPolicy.INDEX_READ_PERMISSIONS,
    "aoss:CreateIndex",
    "aoss:WriteDocument",
    "aoss:DeleteIndex",
    "aoss:UpdateIndex",
  ];

  public readonly env: cdk.ResourceEnvironment;

  private readonly dataAccessPolicyDocument: Array<DataAccessPolicyStatement> =
    [];

  private readonly collection: osServerless.CfnCollection;

  public constructor(
    scope: Construct,
    id: string,
    props: OpenSearchDataAccessPolicyProps,
  ) {
    super(scope, id, {
      name: cdk.Names.uniqueResourceName(scope, {
        maxLength: 31,
      }).toLowerCase(),
      type: "data",
      policy: JSON.stringify([]),
    });

    const { account, region } = cdk.Stack.of(this);
    this.env = {
      account,
      region,
    };

    this.collection = props.collection;
  }

  public grantRead(principal: iam.IPrincipal): void {
    this.dataAccessPolicyDocument.push({
      Rules: [
        {
          Resource: [`collection/${this.collection.name}`],
          Permission: OpenSearchDataAccessPolicy.COLLECTION_READ_PERMISSIONS,
          ResourceType: "collection",
        },
        {
          Resource: [`collection/${this.collection.name}`],
          Permission: OpenSearchDataAccessPolicy.INDEX_READ_PERMISSIONS,
          ResourceType: "index",
        },
      ],
      Principal: [this.getArnFromPrincipal(principal)],
    });

    this.policy = JSON.stringify(this.dataAccessPolicyDocument);
  }

  public grantReadWrite(principal: iam.IPrincipal): void {
    this.dataAccessPolicyDocument.push({
      Rules: [
        {
          Resource: [`collection/${this.collection.name}`],
          Permission:
            OpenSearchDataAccessPolicy.COLLECTION_READ_WRITE_PERMISSIONS,
          ResourceType: "collection",
        },
        {
          Resource: [`index/${this.collection.name}/*`],
          Permission: OpenSearchDataAccessPolicy.INDEX_READ_WRITE_PERMISSIONS,
          ResourceType: "index",
        },
      ],
      Principal: [this.getArnFromPrincipal(principal)],
    });

    this.policy = JSON.stringify(this.dataAccessPolicyDocument);
  }

  private getArnFromPrincipal(principal: iam.IPrincipal): string {
    if (principal instanceof iam.AccountPrincipal) {
      return `arn:aws:iam::${principal.accountId}:root`;
    }

    if (principal instanceof iam.ArnPrincipal) {
      return principal.arn;
    }

    if (principal instanceof iam.ServicePrincipal) {
      // Service principals don't have a direct ARN, but you can construct one
      return `arn:aws:iam::${cdk.Stack.of(this).account}:role/service-role/${
        principal.service
      }`;
    }

    if (principal instanceof iam.Role) {
      return principal.roleArn;
    }

    if (principal instanceof iam.User) {
      return principal.userArn;
    }

    if (principal instanceof iam.Group) {
      return principal.groupArn;
    }

    if ("grantPrincipal" in principal) {
      // For IGrantable objects
      return this.getArnFromPrincipal(principal.grantPrincipal);
    }

    // For custom principal implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (principal as any).arn === "string") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (principal as any).arn;
    }

    throw new Error("Unable to extract ARN from principal");
  }
}
