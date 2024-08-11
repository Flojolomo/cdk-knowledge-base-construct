import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { LambdaFunction } from "../utils/lambda-function";

export type ChunkingConfiguration =
  | {
      chunkingStrategy: "NONE";
    }
  | {
      chunkingStrategy: "HIERARCHICAL" | "SEMANTIC";
      fixedSizeChunkingConfiguration?: {
        maxTokens: number;
        overlapPercentage: number;
      };
    }
  | {
      chunkingStrategy: "FIXED_SIZE";
      fixedSizeChunkingConfiguration: {
        maxTokens: number;
        overlapPercentage: number;
      };
    };

export interface KnowledgeBaseDataSourceProps {
  name: string;
  bucket: s3.IBucket;
  dataDeletionPolicy?: "RETAIN";
  chunkingConfiguration?: ChunkingConfiguration;
  description?: string;
  inclusionPrefixes?: string[];
  knowledgeBase: bedrock.CfnKnowledgeBase;
}

export class KnowledgeBaseDataSource extends bedrock.CfnDataSource {
  public get dataSourceId(): string {
    return this.attrDataSourceId;
  }

  public readonly bucket: s3.IBucket;

  private knowledgeBase: bedrock.CfnKnowledgeBase;

  public constructor(
    scope: Construct,
    id: string,
    props: KnowledgeBaseDataSourceProps
  ) {
    super(scope, id, {
      description: props.description,
      name: props.name,
      knowledgeBaseId: props.knowledgeBase.ref,
      dataDeletionPolicy: props.dataDeletionPolicy ?? "RETAIN",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: props.bucket.bucketArn,
          inclusionPrefixes: props.inclusionPrefixes,
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: props.chunkingConfiguration ?? {
          chunkingStrategy: "NONE",
        },
      },
    });

    this.knowledgeBase = props.knowledgeBase;
    this.bucket = props.bucket;
  }

  public syncAfterCreation(): void {
    const { function: injectDataAfterCreationFunction } = new LambdaFunction(
      this,
      "start-ingestion-job-after-creation-data-source",
      {
        functionProps: {
          entry: path.join(__dirname, "start-ingestion-job/custom-resource.ts"),
          timeout: cdk.Duration.minutes(5),
        },
      }
    );

    injectDataAfterCreationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "StartIngestionJobAfterCreation",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:StartIngestionJob"],
        resources: [this.knowledgeBase.attrKnowledgeBaseArn],
      })
    );

    const customResourceProvider = new cr.Provider(
      this,
      "sync-after-creation-provider",
      {
        onEventHandler: injectDataAfterCreationFunction,
        logRetention: logs.RetentionDays.ONE_DAY,
      }
    );

    new cdk.CustomResource(this, `sync-after-creation-custom-resource`, {
      serviceToken: customResourceProvider!.serviceToken,
      properties: {
        knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
        dataSourceId: this.dataSourceId,
      },
    });
  }

  public syncOnSchedule(schedule: events.Schedule) {
    const { function: createFunctionToStartIngestionJob } = new LambdaFunction(
      this,
      "start-ingestion-job-data-source",
      {
        functionProps: {
          entry: path.join(__dirname, "start-ingestion-job/start-sync.ts"),
        },
      }
    );

    createFunctionToStartIngestionJob.role!.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: "StartIngestionJobOnSchedule",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:StartIngestionJob"],
        resources: [this.knowledgeBase.attrKnowledgeBaseArn],
      })
    );

    const rule = new events.Rule(this, "cron-job", {
      schedule,
    });

    rule.addTarget(
      new targets.LambdaFunction(createFunctionToStartIngestionJob, {
        event: events.RuleTargetInput.fromObject({
          knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
          dataSourceId: this.dataSourceId,
        }),
      })
    );
  }
}
