#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { QuicksightPortalStack } from '../lib/quicksight-portal-stack';

const app = new cdk.App();

// cdk-nag: AWS Solutions rule pack runs on every synth. Findings must be
// fixed or acknowledged with a reason (see Validations.of(...).acknowledge
// in the stack). Opt out for a one-off synth with: cdk synth -c nag=false
if (app.node.tryGetContext('nag') !== 'false') {
  cdk.Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
}

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new QuicksightPortalStack(app, 'QuicksightPortalStack', {
  env,
  description: 'QuickSight Assets Portal with Cognito Authentication',
});
