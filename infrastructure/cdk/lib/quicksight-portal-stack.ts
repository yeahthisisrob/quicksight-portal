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
  HeadersFrameOption, HeadersReferrerPolicy, SecurityPolicyProtocol,
  OriginRequestPolicy, CacheHeaderBehavior, CacheQueryStringBehavior,
  CacheCookieBehavior, OriginProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin, HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  RestApi, LambdaIntegration, AuthorizationType, MethodLoggingLevel,
  LogGroupLogDestination, AccessLogFormat,
} from 'aws-cdk-lib/aws-apigateway';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
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

    // WAF is on by default (~$5/mo base + $1/M requests). Opt out with:
    //   cdk deploy -c enableWaf=false
    // or set "enableWaf": false in cdk.context.json.
    const wafCtx = this.node.tryGetContext('enableWaf');
    const enableWaf = wafCtx !== false && wafCtx !== 'false';

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
        'quicksight:DeleteGroup', 'quicksight:DeleteGroupMembership', 'quicksight:DeleteUser',
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
      runtime: Runtime.NODEJS_22_X,
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
      runtime: Runtime.NODEJS_22_X,
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

    /* 6 ────────── API Gateway (same-origin via CloudFront — no CORS needed) */
    // Access logs — structured JSON so CloudWatch Logs Insights can parse.
    const apiAccessLogs = new LogGroup(this, 'ApiAccessLogs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new RestApi(this, 'Api', {
      restApiName: 'QuicksightPortalApi',
      deployOptions: {
        stageName: 'prod',
        metricsEnabled: true,
        // Throttling: 25 r/s sustained, 50 burst — blocks abuse before it hits Lambda.
        throttlingRateLimit: 25,
        throttlingBurstLimit: 50,
        // Never log request bodies (may contain tokens / PII).
        dataTraceEnabled: false,
        loggingLevel: MethodLoggingLevel.ERROR,
        accessLogDestination: new LogGroupLogDestination(apiAccessLogs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
      },
      // No defaultCorsPreflightOptions — API is same-origin via CloudFront.
      // Lambda cors.ts still sets Access-Control-* for dev (localhost) as defense in depth.
    });
    const integration = new LambdaIntegration(apiLambda);

    // Health endpoint
    const health = api.root.addResource('health');
    health.addMethod('GET', integration, { authorizationType: AuthorizationType.NONE });

    // API endpoints — auth handled in Lambda
    const apiRoot = api.root.addResource('api');
    const apiProxy = apiRoot.addResource('{proxy+}');

    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => {
      apiRoot.addMethod(method, integration, { authorizationType: AuthorizationType.NONE });
      apiProxy.addMethod(method, integration, { authorizationType: AuthorizationType.NONE });
    });

    /* 7 ────────── Security headers policy (custom — stricter than managed SECURITY_HEADERS) */
    const securityHeaders = new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: 'QuickSightPortalSecHeaders',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        xssProtection: { protection: true, modeBlock: true, override: true },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    /* 8 ────────── WAF (CloudFront scope) — bot + injection + rate limit at edge */
    // Default on (~$5/mo base + $1/M requests). Opt out: `enableWaf: false` in
    // cdk.context.json or `-c enableWaf=false` on the CLI.
    const waf = enableWaf ? new CfnWebACL(this, 'SiteWAF', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'QuickSightPortalWAF',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'CommonRuleSet', sampledRequestsEnabled: true },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesKnownBadInputsRuleSet' },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'KnownBadInputs', sampledRequestsEnabled: true },
        },
        {
          name: 'RateLimitPerIP',
          priority: 3,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RateLimitPerIP', sampledRequestsEnabled: true },
        },
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesAmazonIpReputationList' },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'IPReputation', sampledRequestsEnabled: true },
        },
      ],
    }) : undefined;

    /* 9 ────────── CloudFront — SPA (default) + API at /api/* (same-origin) */
    // API Gateway origin — strip /prod stage at origin path
    const apiDomainName = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;
    const apiOrigin = new HttpOrigin(apiDomainName, {
      originPath: '/prod',
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
    });

    // Custom cache policy for /api/*: no caching, but MUST allow-list Authorization header.
    // Managed-CachingDisabled strips all headers which would break JWT auth.
    const apiCachePolicy = new CachePolicy(this, 'ApiNoCachePolicy', {
      cachePolicyName: 'QuickSightPortalApiPassthrough',
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(1),
      minTtl: Duration.seconds(0),
      headerBehavior: CacheHeaderBehavior.allowList('Authorization'),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      cookieBehavior: CacheCookieBehavior.none(),
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(websiteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: waf?.attrArn,
      errorResponses: [{
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      }],
    });

    const cdnDomain =
      (distribution.node.defaultChild as CfnDistribution).attrDomainName;

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

    // Needed by Lambda for aws-jwt-verify audience check.
    apiLambda.addEnvironment('COGNITO_USER_POOL_CLIENT_ID', userPoolClient.ref);

    /* 10 ────────── Deploy SPA + runtime config */
    // API_URL is same-origin via CloudFront /api/* — no CORS, WAF inspects API too.
    const runtimeConfig = `window.APP_CONFIG = {
  API_URL: '/api',
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
