import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { OpenSearchIndex } from "../open-search/open-search-index";
import { ChunkingConfiguration, KnowledgeBaseDataSource } from "./data-source";

interface KnowledgeBaseProps {
  dataSourceId?: string;
  embeddingModel: bedrock.FoundationModel;
  vectorIndex: OpenSearchIndex;
  sourceBucket?: s3.Bucket;
  logGroup?: logs.ILogGroup;
  serviceRole: iam.IRole;
  chunkingConfiguration?: ChunkingConfiguration;
}

export class KnowledgeBase extends Construct {
  public readonly serviceRole: iam.IRole;
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly dataSource: KnowledgeBaseDataSource;
  public readonly dataSources: Array<KnowledgeBaseDataSource> = [];

  private readonly logGroup?: logs.ILogGroup;

  public constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    this.serviceRole = props.serviceRole;

    this.node.addDependency(props.vectorIndex);

    const sourceBucket =
      props.sourceBucket ??
      new s3.Bucket(this, "source-bucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

    const knowledgeBaseName = cdk.Names.uniqueResourceName(this, {
      maxLength: 64,
    });

    const grantee = props.vectorIndex.grantReadWrite(props.serviceRole);

    sourceBucket.grantReadWrite(props.serviceRole);
    props.serviceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [props.embeddingModel.modelArn],
      })
    );

    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "knowledge-base", {
      name: knowledgeBaseName,
      roleArn: props.serviceRole.roleArn,
      storageConfiguration: {
        opensearchServerlessConfiguration: {
          collectionArn: props.vectorIndex.collection.collectionArn,
          vectorIndexName: props.vectorIndex.indexName,
          fieldMapping: {
            vectorField: props.vectorIndex.vectorField,
            metadataField: props.vectorIndex.metadataField,
            textField: props.vectorIndex.textField,
          },
        },
        type: "OPENSEARCH_SERVERLESS",
      },
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: props.embeddingModel.modelArn,
        },
      },
    });

    grantee.applyBefore(this.knowledgeBase);
    this.knowledgeBase.node.addDependency(props.vectorIndex.indexProvider);

    const dataSourceName = props.dataSourceId ?? "default";
    this.dataSource = new KnowledgeBaseDataSource(this, "data-source", {
      bucket: sourceBucket,
      knowledgeBase: this.knowledgeBase,
      name: dataSourceName,
      logGroup: props.logGroup,
      chunkingConfiguration: props.chunkingConfiguration,
    });

    this.dataSources.push(this.dataSource);
  }

  public addDataSource(
    id: string,
    {
      sourceBucket,
      chunkingConfiguration,
      description,
      inclusionPrefixes,
    }: {
      sourceBucket?: s3.Bucket;
      description?: string;
      chunkingConfiguration?: ChunkingConfiguration;
      inclusionPrefixes?: string[];
    } = {}
  ): KnowledgeBaseDataSource {
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_bedrock.CfnDataSource.html

    const bucket =
      sourceBucket ??
      new s3.Bucket(this, `source-bucket-${id}`, {
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

    bucket.grantRead(this.serviceRole);
    const dataSource = new KnowledgeBaseDataSource(this, `data-source-${id}`, {
      bucket,
      chunkingConfiguration,
      description,
      inclusionPrefixes,
      knowledgeBase: this.knowledgeBase,
      name: id,
      logGroup: this.logGroup,
    });

    this.dataSources.push(dataSource);
    return dataSource;
  }
}
