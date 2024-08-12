import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import {
  S3EventSource,
  SnsEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

interface LambdaFunctionProps {
  functionProps: Partial<Omit<NodejsFunctionProps, "events">> & {
    entry: NodejsFunctionProps["entry"];
    logRetention?: logs.RetentionDays;
    logGroup?: logs.ILogGroup;
  };
  bucket?: s3.Bucket;
  topic?: sns.Topic;
  filters?: s3.NotificationKeyFilter[];
}
export class LambdaFunction extends Construct {
  public readonly function: NodejsFunction;

  public constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);

    this.function = new NodejsFunction(this, "lambda", {
      logRetention: props.functionProps.logRetention,
      logGroup: props.functionProps.logGroup,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      environment: {
        AWS_LAMBDA_LOG_LEVEL: "DEBUG",
        ...(props.functionProps.environment ?? {}),
      },
      ...props.functionProps,
    });

    if (props.bucket) {
      const eventSource = new S3EventSource(props.bucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: props.filters,
      });

      this.function.addEventSource(eventSource);
    }

    if (props.topic) {
      this.function.addEventSource(new SnsEventSource(props.topic));
    }
  }
}
