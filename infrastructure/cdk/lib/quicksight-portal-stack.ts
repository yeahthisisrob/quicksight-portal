import * as path from 'path';
import { Construct } from 'constructs';
import {
  Stack, StackProps, Duration, RemovalPolicy, CfnOutput,
} from 'aws-cdk-lib';
import {
  Bucket, BucketEncryption, BlockPublicAccess,
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  Distribution, ViewerProtocolPolicy, CachePolicy, AllowedMethods,
  ResponseHeadersPolicy, OriginAccessIdentity, CfnDistribution,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  RestApi, LambdaIntegration, AuthorizationType, GatewayResponse, ResponseType,
} from 'aws-cdk-lib/aws-apigateway';
import {
  Function as LambdaFunction, Runtime, Code,
} from 'aws-cdk-lib/aws-lambda';
import {
  Role, ServicePrincipal, PolicyStatement, Effect, ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import {
  UserPool, UserPoolDomain, CfnUserPoolGroup, CfnUserPoolClient, AccountRecovery, Mfa,
} from 'aws-cdk-lib/aws-cognito';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class QuicksightPortalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /* 1 ────────── SPA bucket + CloudFront */
    const websiteBucket = new Bucket(this, 'WebsiteBucket', {
      bucketName: `quicksight-portal-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const oai = new OriginAccessIdentity(this, 'OAI');
    websiteBucket.grantRead(oai);

    /* 2 ────────── Cognito User-pool (+groups) */
    const userPool = new UserPool(this, 'QuickSightPortalUserPool', {
      userPoolName: 'quicksight-portal-users',
      selfSignUpEnabled: false, // Disable self-registration
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8, requireLowercase: true, requireUppercase: true,
        requireDigits: true, requireSymbols: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY, // For dev/test environments
      mfa: Mfa.OPTIONAL, // Enable MFA as optional
      mfaSecondFactor: { sms: false, otp: true },
    });

    new CfnUserPoolGroup(this, 'QuickSightUsersGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'QuickSightUsers',
      description: 'Users with access to QuickSight Portal',
      precedence: 1,
    });
    new CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admins',
      description: 'Portal administrators',
      precedence: 0,
    });

    const userPoolDomain = new UserPoolDomain(this, 'QuickSightPortalUserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: `quicksight-portal-${this.account}` },
    });

    /* 3 ────────── SQS Queue for export jobs */
    const exportQueue = new Queue(this, 'ExportQueue', {
      queueName: `quicksight-export-queue-${this.account}`,
      encryption: QueueEncryption.KMS_MANAGED,
      visibilityTimeout: Duration.minutes(15), // Match Lambda timeout
      retentionPeriod: Duration.days(14),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new Queue(this, 'ExportDLQ', {
          queueName: `quicksight-export-dlq-${this.account}`,
          encryption: QueueEncryption.KMS_MANAGED,
          retentionPeriod: Duration.days(14),
        }),
      },
    });

    /* 4 ────────── Lambda behind the API */
    const lambdaRole = new Role(this, 'LambdaExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'quicksight:List*', 'quicksight:Describe*', 'quicksight:Get*',
        'quicksight:Search*', 'quicksight:TagResource', 'quicksight:UntagResource',
        'quicksight:Update*', 'quicksight:CreateFolderMembership',
        'quicksight:DeleteFolderMembership',
        'quicksight:DeleteAnalysis', 'quicksight:DeleteDashboard', 
        'quicksight:DeleteDataSet', 'quicksight:DeleteDataSource',
        'quicksight:ListIngestions', 'quicksight:DescribeIngestion',
        'quicksight:CancelIngestion',
        'quicksight:CreateDashboard', 'quicksight:CreateAnalysis',
        'quicksight:CreateDataSet', 'quicksight:CreateDataSource',
        'quicksight:CreateFolder', 'quicksight:CreateGroup',
        'quicksight:RegisterUser', 'quicksight:CreateGroupMembership',
        'quicksight:PassDataSource', 'quicksight:PassDataSet',
        'quicksight:UpdateDashboard', 'quicksight:UpdateAnalysis',
        'quicksight:UpdateDataSet', 'quicksight:UpdateDataSource',
        'quicksight:UpdateFolder', 'quicksight:UpdateGroup',
        'quicksight:DeleteGroup', 'quicksight:DeleteGroupMembership',
        'quicksight:UpdateUser', 'quicksight:UpdateDashboardPermissions',
        'quicksight:UpdateAnalysisPermissions', 'quicksight:UpdateDataSetPermissions',
        'quicksight:UpdateDataSourcePermissions', 'quicksight:UpdateFolderPermissions',
        'quicksight:UpdateDashboardPublishedVersion',
        'quicksight:CreateRefreshSchedule', 'quicksight:UpdateRefreshSchedule',
        'quicksight:DeleteRefreshSchedule', 'quicksight:PutDataSetRefreshProperties',
      ],
      resources: [`arn:aws:quicksight:${this.region}:${this.account}:*`],
    }));
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['cloudtrail:LookupEvents'],
      resources: ['*'],
    }));
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::quicksight-metadata-bucket-${this.account}`,
        `arn:aws:s3:::quicksight-metadata-bucket-${this.account}/*`,
      ],
    }));

    const apiLambda = new LambdaFunction(this, 'ApiLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../../../backend/lambda/dist')),
      role: lambdaRole,
      timeout: Duration.minutes(15),
      memorySize: 3008, // Maximum Lambda memory (3 GB)
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'INFO',
        LOG_SAMPLE_RATE: '0.1',
        SERVICE_NAME: 'quicksight-portal-api',
        AWS_ACCOUNT_ID: this.account,
        DEPLOYMENT_TIME: new Date().toISOString(),
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
        BUCKET_NAME: `quicksight-metadata-bucket-${this.account}`,
        EXPORT_QUEUE_URL: exportQueue.queueUrl,
      },
    });

    // Grant API Lambda permission to send messages to the queue
    exportQueue.grantSendMessages(apiLambda);

    /* 5 ────────── Worker Lambda for export processing */
    const workerLambda = new LambdaFunction(this, 'WorkerLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'worker.handler',
      code: Code.fromAsset(path.join(__dirname, '../../../backend/lambda/dist')),
      role: lambdaRole, // Reuse the same role with QuickSight permissions
      timeout: Duration.minutes(15),
      memorySize: 3008, // Maximum Lambda memory (3 GB)
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'INFO',
        LOG_SAMPLE_RATE: '0.1',
        SERVICE_NAME: 'quicksight-portal-worker',
        AWS_ACCOUNT_ID: this.account,
        DEPLOYMENT_TIME: new Date().toISOString(),
        BUCKET_NAME: `quicksight-metadata-bucket-${this.account}`,
      },
    });

    // Configure the worker Lambda to be triggered by SQS
    workerLambda.addEventSource(new SqsEventSource(exportQueue, {
      batchSize: 1, // Process one export job at a time
      maxBatchingWindow: Duration.seconds(0), // Process immediately
    }));

    /* 6 ────────── CloudFront for SPA only */
    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(websiteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [{
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      }],
    });

    const cdnDomain =
      (distribution.node.defaultChild as CfnDistribution).attrDomainName;

    /* 7 ────────── API Gateway with CORS */
    const api = new RestApi(this, 'Api', {
      restApiName: 'QuicksightPortalApi',
      deployOptions: { stageName: 'prod', metricsEnabled: true },
      defaultCorsPreflightOptions: {
        allowOrigins: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:5173',
          'http://localhost:5174',
        ],
        allowHeaders: [
          'Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key',
          'X-Amz-Security-Token', 'X-Amz-User-Agent', 'X-Amz-Content-Sha256',
        ],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      },
    });
    const integration = new LambdaIntegration(apiLambda);

    // Health endpoint
    const health = api.root.addResource('health');
    health.addMethod('GET', integration, { authorizationType: AuthorizationType.NONE });

    // API endpoints - auth handled in Lambda
    const apiRoot = api.root.addResource('api');
    const apiProxy = apiRoot.addResource('{proxy+}');
    
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => {
      apiRoot.addMethod(method, integration, { authorizationType: AuthorizationType.NONE });
      apiProxy.addMethod(method, integration, { authorizationType: AuthorizationType.NONE });
    });

    // Add gateway responses for proper CORS on errors
    new GatewayResponse(this, 'Default4xxResponse', {
      restApi: api,
      type: ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://${distribution.distributionDomainName}'`,
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amz-Content-Sha256'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,PATCH,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    new GatewayResponse(this, 'Default5xxResponse', {
      restApi: api,
      type: ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'https://${distribution.distributionDomainName}'`,
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amz-Content-Sha256'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,PATCH,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    /* 8 ────────── User-pool client (needs CloudFront domain) */
    const userPoolClient = new CfnUserPoolClient(this, 'QuickSightPortalUserPoolClient', {
      userPoolId: userPool.userPoolId,
      clientName: 'PortalClient',
      generateSecret: false,
      explicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      allowedOAuthFlows: ['code'],
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthScopes: ['openid', 'email', 'profile'],
      supportedIdentityProviders: ['COGNITO'],
      callbackUrLs: [
        `https://${cdnDomain}/auth/cognito/callback`,
        'http://localhost:5173/auth/cognito/callback',
        'http://localhost:5174/auth/cognito/callback',
      ],
      logoutUrLs: [
        `https://${cdnDomain}`,
        'http://localhost:5173',
        'http://localhost:5174',
      ],
    });

    /* 9 ────────── Deploy SPA + runtime config */
    const runtimeConfig = `window.APP_CONFIG = {
  API_URL: '${api.url}api',
  AWS_REGION: '${this.region}',
  USER_POOL_ID: '${userPool.userPoolId}',
  USER_POOL_CLIENT_ID: '${userPoolClient.ref}',
  COGNITO_DOMAIN: 'https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com',
  ENVIRONMENT: 'production'
};`;

    new BucketDeployment(this, 'DeployWebsite', {
      sources: [
        Source.asset(path.join(__dirname, '../../../frontend/dist')),
        Source.data('config.js', runtimeConfig),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    /* 10 ────────── Outputs */
    new CfnOutput(this, 'SiteURL', {
      value: `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'ApiURL', { value: api.url });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.ref });
    new CfnOutput(this, 'ExportQueueUrl', { value: exportQueue.queueUrl });
  }
}
