import * as path from 'path';
import { Construct } from 'constructs';
import {
  Stack, StackProps, Duration, RemovalPolicy, CfnOutput, Token, Validations,
} from 'aws-cdk-lib';
import {
  Bucket, BucketEncryption, BlockPublicAccess,
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  Distribution, ViewerProtocolPolicy, CachePolicy, AllowedMethods,
  ResponseHeadersPolicy, OriginAccessIdentity, CfnDistribution,
  HeadersFrameOption, HeadersReferrerPolicy,
  OriginRequestPolicy, CacheHeaderBehavior, CacheQueryStringBehavior,
  CacheCookieBehavior, OriginProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin, HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { HttpApi, CfnStage, PayloadFormatVersion } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnWebACL, CfnIPSet } from 'aws-cdk-lib/aws-wafv2';
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
import {
  Table as DynamoTable, AttributeType, BillingMode, ProjectionType,
} from 'aws-cdk-lib/aws-dynamodb';

export class QuicksightPortalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // WAF is on by default (~$5/mo base + $1/M requests). Opt out with:
    //   cdk deploy -c enableWaf=false
    // or set "enableWaf": false in cdk.context.json.
    const wafCtx = this.node.tryGetContext('enableWaf');
    const wafOptedOut = wafCtx === false || wafCtx === 'false';

    // Optional IP allowlist — when set, only requests from these CIDRs are
    // allowed through CloudFront (everything else is blocked at the edge).
    // Setting this forces WAF on (overriding `enableWaf: false`) since the
    // allowlist is enforced via a WAF rule.
    const rawIpRanges = this.node.tryGetContext('allowedIpRanges');
    const allowedIpRanges: string[] = Array.isArray(rawIpRanges)
      ? rawIpRanges.filter((c): c is string => typeof c === 'string' && c.length > 0)
      : [];
    const hasIpAllowlist = allowedIpRanges.length > 0;
    const allowedIpv4 = allowedIpRanges.filter(cidr => !cidr.includes(':'));
    const allowedIpv6 = allowedIpRanges.filter(cidr => cidr.includes(':'));

    const enableWaf = hasIpAllowlist || !wafOptedOut;

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
      enforceSSL: true,
      // Well above the 15-min Lambda timeout (AWS guidance: >= 6x). Equal
      // values let a message go visible again while the first invocation is
      // still running, so two workers could process the same job concurrently
      // and the second's stuck-job sweep could auto-fail the first's live job.
      visibilityTimeout: Duration.minutes(90),
      retentionPeriod: Duration.days(14),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new Queue(this, 'ExportDLQ', {
          queueName: `quicksight-export-dlq-${this.account}`,
          encryption: QueueEncryption.KMS_MANAGED,
          enforceSSL: true,
          retentionPeriod: Duration.days(14),
        }),
      },
    });

    /* 3b ────────── DynamoDB table for job records + logs */
    // pk=jobId, sk='META' for the job record; sk='LOG#<ts>#<seq>' for log
    // entries (one atomic put per log line). GSI lists newest-first; TTL is
    // the retention backstop behind the cleanupOldJobs sweep. Also holds the
    // single-export lock item (conditional writes). Job storage never
    // touches S3.
    const jobsTable = new DynamoTable(this, 'JobsTable', {
      tableName: `quicksight-portal-jobs-${this.account}`,
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN, // job history survives stack teardown
    });
    jobsTable.addGlobalSecondaryIndex({
      indexName: 'byStartTime',
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING },
      sortKey: { name: 'startTime', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
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
    // SMUS (SageMaker Unified Studio) catalog lookups — the only DataZone
    // call the portal makes. Harmless when SMUS_DOMAIN_ID is not configured.
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['datazone:SearchListings'],
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

    // SMUS (SageMaker Unified Studio) integration — optional. Provide the
    // DataZone domain id at synth time via CDK context or environment:
    //   cdk deploy -c smusDomainId=dzd_xxxx
    //   (or SMUS_DOMAIN_ID=dzd_xxxx cdk deploy)
    // smusPortalUrl / SMUS_PORTAL_URL optionally overrides the derived portal
    // URL for custom SMUS domains. Unset = SMUS UI hidden in the portal.
    const smusDomainId = this.node.tryGetContext('smusDomainId') || process.env.SMUS_DOMAIN_ID || '';
    const smusPortalUrl = this.node.tryGetContext('smusPortalUrl') || process.env.SMUS_PORTAL_URL || '';

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
        JOBS_TABLE_NAME: jobsTable.tableName,
        ...(smusDomainId ? { SMUS_DOMAIN_ID: smusDomainId } : {}),
        ...(smusPortalUrl ? { SMUS_PORTAL_URL: smusPortalUrl } : {}),
      },
    });

    // Grant API Lambda permission to send messages to the queue
    exportQueue.grantSendMessages(apiLambda);

    // Job records live in DynamoDB (shared execution role covers both Lambdas)
    jobsTable.grantReadWriteData(lambdaRole);

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
        // Continuation pattern: the worker requeues an export that would
        // outlive the 15-min Lambda ceiling so a fresh invocation resumes it
        EXPORT_QUEUE_URL: exportQueue.queueUrl,
        JOBS_TABLE_NAME: jobsTable.tableName,
      },
    });

    // Configure the worker Lambda to be triggered by SQS
    workerLambda.addEventSource(new SqsEventSource(exportQueue, {
      batchSize: 1, // Process one export job at a time
      maxBatchingWindow: Duration.seconds(0), // Process immediately
    }));

    // Worker requeues continuation messages for long-running exports
    exportQueue.grantSendMessages(workerLambda);

    /* 6 ────────── API Gateway HTTP API v2 (same-origin via CloudFront) */
    // HTTP API v2: lower cost + lower latency than REST v1, and no
    // account-level CloudWatch role dance needed for logging.
    // Access logs — structured JSON so CloudWatch Logs Insights can parse.
    const apiAccessLogs = new LogGroup(this, 'ApiAccessLogs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Keep the v1 payload shape so existing Lambda handlers (event.path,
    // event.httpMethod, event.headers) work unchanged.
    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', apiLambda, {
      payloadFormatVersion: PayloadFormatVersion.VERSION_1_0,
    });

    const api = new HttpApi(this, 'HttpApi', {
      apiName: 'QuicksightPortalApi',
      // Catch-all — CloudFront only forwards /api/* to this origin anyway,
      // and the Lambda router handles path dispatch. Auth is enforced in Lambda.
      defaultIntegration: lambdaIntegration,
    });

    // Configure the $default stage: access logs, throttling, no request body trace.
    const defaultStage = api.defaultStage!.node.defaultChild as CfnStage;
    defaultStage.accessLogSettings = {
      destinationArn: apiAccessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLength: '$context.responseLength',
        integrationLatency: '$context.integrationLatency',
      }),
    };
    // Throttling: 25 r/s sustained, 50 burst — blocks abuse before it hits Lambda.
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 50,
      throttlingRateLimit: 25,
    };
    // Grant API Gateway write access to the access-log group.
    apiAccessLogs.grantWrite(new ServicePrincipal('apigateway.amazonaws.com'));

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
    // Force-enabled if `allowedIpRanges` is set.
    const ipv4Set = enableWaf && allowedIpv4.length > 0 ? new CfnIPSet(this, 'AllowedIpv4Set', {
      scope: 'CLOUDFRONT',
      ipAddressVersion: 'IPV4',
      addresses: allowedIpv4,
    }) : undefined;
    const ipv6Set = enableWaf && allowedIpv6.length > 0 ? new CfnIPSet(this, 'AllowedIpv6Set', {
      scope: 'CLOUDFRONT',
      ipAddressVersion: 'IPV6',
      addresses: allowedIpv6,
    }) : undefined;

    // Build the "allowed IP" match statement — OR of v4 and v6 sets if both
    // are present, else a single IP set reference.
    const ipSetRefs: Array<{ ipSetReferenceStatement: { arn: string } }> = [];
    if (ipv4Set) ipSetRefs.push({ ipSetReferenceStatement: { arn: ipv4Set.attrArn } });
    if (ipv6Set) ipSetRefs.push({ ipSetReferenceStatement: { arn: ipv6Set.attrArn } });
    const allowedIpStatement = ipSetRefs.length === 1
      ? ipSetRefs[0]
      : ipSetRefs.length > 1
        ? { orStatement: { statements: ipSetRefs } }
        : undefined;

    const allowlistRule = allowedIpStatement ? {
      name: 'IpAllowlist',
      priority: 0,
      action: { block: {} },
      // Block anything NOT in the allowlist.
      statement: { notStatement: { statement: allowedIpStatement } },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'IpAllowlist', sampledRequestsEnabled: true },
    } : undefined;

    const waf = enableWaf ? new CfnWebACL(this, 'SiteWAF', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'QuickSightPortalWAF',
        sampledRequestsEnabled: true,
      },
      rules: [
        ...(allowlistRule ? [allowlistRule] : []),
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
    // HTTP API v2 has no stage prefix in the URL (uses $default stage).
    const apiDomainName = `${api.apiId}.execute-api.${this.region}.amazonaws.com`;
    const apiOrigin = new HttpOrigin(apiDomainName, {
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
      // Required for `compress: true` on the /api/* behavior to engage
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(websiteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          // Compress JSON list payloads at the edge (no backend changes)
          compress: true,
        },
      },
      defaultRootObject: 'index.html',
      // NOTE: minimumProtocolVersion has no effect with the default
      // CloudFront certificate (security policy is fixed at TLSv1). Set it
      // (TLS_V1_2_2021) when a custom domain + ACM certificate are added.
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
    new CfnOutput(this, 'ApiURL', { value: api.apiEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.ref });
    new CfnOutput(this, 'ExportQueueUrl', { value: exportQueue.queueUrl });

    /* 11 ────────── cdk-nag acknowledgments */
    // Every remaining AWS Solutions finding is an explicit, reasoned decision.
    // Anything not listed here fails synth - new resources must either
    // comply or add their own acknowledgment with a reason.
    const acknowledgments: Array<{ id: string; reason: string }> = [
      {
        id: 'AwsSolutions-L1',
        reason:
          'Lambdas are pinned to the Node 22 LTS runtime, matched to the build target ' +
          'and @types/node; runtime upgrades are done deliberately, not implicitly. ' +
          'The BucketDeployment handler runtime is CDK-managed.',
      },
      {
        id: 'AwsSolutions-APIG4',
        reason:
          'Authorization is enforced in the API Lambda via Cognito JWT verification ' +
          '(aws-jwt-verify) on every route except the auth endpoints; CloudFront ' +
          'same-origin routing + WAF sit in front of the API.',
      },
      {
        id: 'AwsSolutions-COG8',
        reason:
          'Cognito Plus tier / advanced security is a paid feature not justified for ' +
          'this deployment; the pool has a strong password policy, optional TOTP MFA, ' +
          'and no self-signup.',
      },
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is offered (TOTP) but intentionally optional for this user base.',
      },
      {
        id: 'AwsSolutions-S1',
        reason:
          'S3 server access logging is intentionally disabled on the SPA bucket: ' +
          'CloudFront fronts all access and the added log bucket/cost is not justified.',
      },
      {
        id: 'AwsSolutions-CFR1',
        reason: 'No geo restriction requirement for this portal.',
      },
      {
        id: 'AwsSolutions-CFR3',
        reason:
          'CloudFront access logging intentionally disabled for cost; API access logs ' +
          'are captured at the HTTP API stage.',
      },
      {
        id: 'AwsSolutions-CFR4',
        reason:
          'The distribution uses the default CloudFront certificate (no custom ' +
          'domain), which fixes the minimum protocol at TLSv1; acceptable until a ' +
          'custom domain + ACM certificate are introduced.',
      },
      {
        id: 'AwsSolutions-CFR7',
        reason:
          'S3 origin uses an Origin Access Identity; migration to Origin Access ' +
          'Control is tracked as a follow-up and needs a verified deploy window.',
      },
    ];
    // IAM4/IAM5 are granular rules - each finding is acknowledged
    // individually so any NEW wildcard still fails synth.
    //
    // cdk-nag renders finding ids with RESOLVED values when the stack has an
    // environment (real deploys: account/region are concrete) and with
    // placeholder tokens (<AWS::AccountId>) in env-less synths. Register the
    // ARN-bearing acknowledgments for BOTH renderings so `cdk deploy` and
    // env-less `cdk synth` both pass.
    const nagAccounts = Token.isUnresolved(this.account)
      ? ['<AWS::AccountId>']
      : [this.account, '<AWS::AccountId>'];
    const quicksightAdminReason =
      'The portal administers ALL QuickSight assets in the account by design; ' +
      'QuickSight actions are scoped to account-level QuickSight ARNs.';
    const metadataBucketReason =
      'Object-level access to the portal-owned metadata/website buckets; the ' +
      'object keyspace is the granularity S3 offers.';
    const iamAcknowledgments: Array<{ id: string; reason: string }> = [
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason:
          'AWSLambdaBasicExecutionRole only grants CloudWatch Logs write for the ' +
          'function log group; a customer-managed equivalent adds boilerplate ' +
          'without reducing scope.',
      },
      ...['List*', 'Describe*', 'Get*', 'Search*', 'Update*'].map((a) => ({
        id: `AwsSolutions-IAM5[Action::quicksight:${a}]`,
        reason: quicksightAdminReason,
      })),
      ...nagAccounts.map((acct) => ({
        id: `AwsSolutions-IAM5[Resource::arn:aws:quicksight:${this.region}:${acct}:*]`,
        reason: quicksightAdminReason,
      })),
      ...['GetObject*', 'GetBucket*', 'List*', 'DeleteObject*', 'Abort*'].map((a) => ({
        id: `AwsSolutions-IAM5[Action::s3:${a}]`,
        reason: metadataBucketReason,
      })),
      ...nagAccounts.map((acct) => ({
        id: `AwsSolutions-IAM5[Resource::arn:aws:s3:::quicksight-metadata-bucket-${acct}/*]`,
        reason: metadataBucketReason,
      })),
      {
        id: 'AwsSolutions-IAM5[Resource::<WebsiteBucket75C24D94.Arn>/*]',
        reason: metadataBucketReason,
      },
      {
        id: 'AwsSolutions-IAM5[Resource::<JobsTable1970BC16.Arn>/index/*]',
        reason:
          'grantReadWriteData covers the jobs table GSI (index/*) - required for job listings.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'cloudtrail:LookupEvents and datazone:SearchListings do not support ' +
          'resource-level scoping.',
      },
      ...nagAccounts.map((acct) => ({
        id: `AwsSolutions-IAM5[Resource::arn:aws:s3:::cdk-hnb659fds-assets-${acct}-${this.region}/*]`,
        reason: 'CDK-managed BucketDeployment reads its own asset bucket.',
      })),
    ];

    for (const ack of acknowledgments) {
      Validations.of(this).acknowledge(ack);
    }
    // Validations.acknowledge() rejects ids containing more than one '::'
    // (the delimiter is reserved), which every ARN-bearing IAM finding id
    // does. cdk-nag matches acknowledgments against the raw metadata entries
    // under Validations.ACKNOWLEDGED_RULES_METADATA_KEY, so record those
    // directly - same mechanism, same audit trail in the template.
    for (const ack of iamAcknowledgments) {
      this.node.addMetadata(Validations.ACKNOWLEDGED_RULES_METADATA_KEY, {
        [ack.id]: ack.reason,
      });
    }
  }
}
