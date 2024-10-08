import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { Logger } from "@aws-lambda-powertools/logger";
import { parser } from "@aws-lambda-powertools/parser";
import { BedrockAgent } from "@aws-sdk/client-bedrock-agent";
import { Context } from "aws-lambda";
import { z } from "zod";

const bedrockClient = new BedrockAgent();

const startIngestionJobEventSchema = z.object({
  knowledgeBaseId: z.string(),
  dataSourceId: z.string(),
});

const logger = new Logger({ serviceName: "start-sync" });

export type StartIngestionJobEvent = z.infer<
  typeof startIngestionJobEventSchema
>;

class Lambda implements LambdaInterface {
  @parser({ schema: startIngestionJobEventSchema })
  @logger.injectLambdaContext({ logEvent: true })
  public async handler(
    event: StartIngestionJobEvent,
    _: Context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    await bedrockClient.startIngestionJob({
      knowledgeBaseId: event.knowledgeBaseId,
      dataSourceId: event.dataSourceId,
    });
  }
}

const myFunction = new Lambda();
export const handler = myFunction.handler.bind(myFunction);
