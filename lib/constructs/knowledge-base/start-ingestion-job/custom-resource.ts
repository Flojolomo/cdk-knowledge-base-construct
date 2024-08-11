import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from "aws-lambda";
import {
  StartIngestionJobEvent,
  handler as startIngestionJobHandler,
} from "./start-sync";

export const handler = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> => {
  const ResourceProperties =
    event.ResourceProperties as unknown as StartIngestionJobEvent;

  if (event.RequestType === "Create") {
    await startIngestionJobHandler(ResourceProperties, context);
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
