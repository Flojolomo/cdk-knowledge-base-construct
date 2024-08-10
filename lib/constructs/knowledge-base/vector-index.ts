import * as iam from "aws-cdk-lib/aws-iam";
import { OpenSearchCollection } from "../open-search/open-search-collection";

export interface IVectorIndex  {
    get collection(): OpenSearchCollection
    get indexName(): string
    get vectorField(): string,
    get metadataField(): string
    get textField(): string
    grantReadWrite(principal: iam.IPrincipal): iam.Grant;
}