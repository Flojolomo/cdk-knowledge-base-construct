import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as osServerless from "aws-cdk-lib/aws-opensearchserverless";
import { Construct } from "constructs";
import { OpenSearchDataAccessPolicy } from "./open-search-data-access-policy";

interface OpenSearchCollectionProps {
  /**
   * Whether the collection is accessible from the public internet.
   * @default false
   */
  allowPublicAccess?: boolean;
  /**
   * The description of the collection.
   */
  description?: string;
  /**
   * The KMS key to encrypt the collection. If none is set, an AWS owned key is used.
   * @default undefined
   */
  kmsKey?: kms.Key;
  /**
   * The name of the collection.
   * @default A unique identifier
   */
  name?: string;
  /**
   * The source services to access the collection.
   * This configuration is not considered, if {@link allowPublicAccess} is set to true.
   * @default undefined
   */
  sourceServices?: Array<"bedrock.amazonaws.com">;
  /**
   * Toggle to enable or disable standby replicas.
   * @default "DISABLED"
   */
  standbyReplicas?: "ENABLED" | "DISABLED";
  /**
   * The tags associated with the collection.
   * @default undefined
   */
  tags?: Array<cdk.CfnTag>;
  /**
   * The type of the collection.
   * @default "VECTORSEARCH"
   */
  type?: "SEARCH" | "TIMESERIES" | "VECTORSEARCH";
  /**
   * The VPC endpoints to access the collection.
   * @default undefined
   */
  vpcEndpoints?: Array<ec2.IVpcEndpoint>;
}

/**
 * An OpenSearch Serverless collection with relevant resources included.
 * The encryption policy is mandatory to be created. By default, an AWS owned key is used,
 * except a KMW key is provided in the props.
 *
 * By default, the collection is not accessible, neither from the public internet nor from VPC endpoints.
 * To enable access from the public internet, set {@link OpenSearchCollectionProps.allowPublicAccess} to true,
 * a list of services to access the collection in {@link OpenSearchCollectionProps.sourceServices},
 * or provide a list of VPC endpoints in {@link OpenSearchCollectionProps.vpcEndpoints}
 */
export class OpenSearchCollection extends osServerless.CfnCollection {
  private readonly dataAccessPolicy: OpenSearchDataAccessPolicy;

  /**
   * @param scope
   * @param id
   * @param props
   */
  public constructor(
    scope: Construct,
    id: string,
    props: OpenSearchCollectionProps,
  ) {
    super(scope, id, {
      description: props.description,
      name: props.name ?? cdk.Names.uniqueId(scope).toLowerCase(),
      standbyReplicas: props.standbyReplicas ?? "DISABLED",
      tags: props.tags,
      type: props.type ?? "VECTORSEARCH",
    });

    this.dataAccessPolicy = new OpenSearchDataAccessPolicy(
      this,
      "data-access-policy",
      {
        collection: this,
      },
    );

    const encryptionPolicy = new osServerless.CfnSecurityPolicy(
      this,
      "encryption-policy",
      {
        name: this.name,
        type: "encryption",
        policy: JSON.stringify({
          Rules: [
            {
              Resource: [`collection/${this.name}`],
              ResourceType: "collection",
            },
          ],
          AWSOwnedKey: !props.kmsKey,
          KmsARN: props.kmsKey?.keyArn,
        }),
      },
    );

    this.addDependency(encryptionPolicy);

    if (props.allowPublicAccess || props.sourceServices || props.vpcEndpoints) {
      new osServerless.CfnSecurityPolicy(this, "security-policy", {
        name: this.name,
        type: "network",
        policy: JSON.stringify([
          {
            AllowFromPublic: props.allowPublicAccess ?? false,
            Rules: [
              {
                Resource: [`collection/${this.name}`],
                ResourceType: "dashboard",
              },
              {
                Resource: [`collection/${this.name}`],
                ResourceType: "collection",
              },
            ],
            SourceVPCEndpoints: props.vpcEndpoints?.map(
              (vpcEndpoint) => vpcEndpoint.vpcEndpointId,
            ),
          },
        ]),
      });
    }
  }

  public grantReadWrite(principal: iam.IPrincipal): iam.Grant {
    this.dataAccessPolicy.grantReadWrite(principal);
    const grant = this.grantApiAccess(principal);
    return grant;
  }

  public grantRead(principal: iam.IPrincipal): iam.Grant {
    this.dataAccessPolicy.grantReadWrite(principal);
    return this.grantApiAccess(principal);
  }

  private grantApiAccess(principal: iam.IPrincipal): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: principal,
      actions: ["aoss:APIAccessAll"],
      resourceArns: [
        "*"
      ],
    });
  }
}
