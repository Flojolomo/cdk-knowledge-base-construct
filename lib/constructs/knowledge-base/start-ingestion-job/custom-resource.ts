import { Logger } from "@aws-lambda-powertools/logger";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from "aws-lambda";
import {
  StartIngestionJobEvent,
  handler as startIngestionJobHandler,
} from "./start-sync";

const logger = new Logger({ serviceName: "StartIngestionJob" });

export const handler = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> => {
  const ResourceProperties =
    event.ResourceProperties as unknown as StartIngestionJobEvent;

  if (event.RequestType === "Create") {
    try{
    await startIngestionJobHandler(ResourceProperties, context);
    } catch (error) {
      logger.error("Error starting ingestion job", { error });
    }
  }

  return {
    Status: "SUCCESS",
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    PhysicalResourceId: ResourceProperties.dataSourceId,
    Data: {},
  };
};
