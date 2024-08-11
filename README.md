# Knowledge Base Constructs

This repository aims to provide reusable constructs for use with CDK, to spin up RAG applications. So far, the support or OpenSearch & Bedrock Knowledge Bases is only backed by L1 constructs. 

## Prerequisites
- yarn, v4.2.1
- access to an AWS account

## Useful commands

- `yarn build` compile typescript to js
- `yarn test` perform the jest unit tests
- `yarn cdk deploy` deploy this stack to your default AWS account/region
- `yarn cdk diff` compare deployed stack with current state
- `yarn cdk synth` emits the synthesized CloudFormation template

## Open points

- [x] Fix dependency issues
- [ ] Fix prettier to run on save
- [ ] Deletion of data source sync after startup fails due to timeout after 3 seconds
- [ ] Document constructs
- [ ] Convert to a CDK library instead of CDK app
- [ ] Update the README with all components and proper documentation of directory structure
- [ ] Write tests to verify regression

## Learnings
- CDK custom resources do not execute the delete invocation, if the creation failed with an unhandled error. This is especially relevant, when creating indices as part of the stack implemented [here](./lib/knowledge-base-construct-stack.ts).
- Managing dependencies between resources can be tricky. What helped me a lot was to re-architect the resource structure and the composition. This also helped me to clarify responsibilities of each resource & construct. 
Besides that, I realized that the dependencies are listed in the created template which improves the research about circular dependencies.