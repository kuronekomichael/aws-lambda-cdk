import cdk = require('@aws-cdk/core');
import lambda = require('@aws-cdk/aws-lambda');
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import targets = require('@aws-cdk/aws-events-targets');
import { ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';

export class TmpStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda用IAMロール
    const iamRoleForLambda = new iam.Role(this, 'IAMRoleForLamda', {
      roleName: 'ssm-secure-string-lambda-role',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'), // SSMからSecureStringを読み込むため
      ]
    });

    // Lambda
    const lambdaFn = new lambda.Function(this, 'FuncEsaStats2Slack', {
      code: lambda.Code.asset('lambda'),
      handler: 'esa-stats-to-slack.handler',
      timeout: cdk.Duration.seconds(300),
      role: iamRoleForLambda,
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    // CloudWatch events cron定義
    const stackConfig = {
      events: {
        cron: "0 1 L * ? *" // 月末日のAM10時
        // Minutes:      0 = 0分
        // Hours:        1 = GMT1:00(日本時間では10:00)
        // Day-of-month: L = 月末日
        // Month:        * = 毎月
        // Day-of-week:  ? = いずれかの曜日
        // Year:         * = 毎年
      },
    };

    const timerRule = new events.Rule(this, 'timerRule', {
      schedule: events.Schedule.expression(`cron(${stackConfig.events.cron})`)
    });

    timerRule.addTarget(new targets.LambdaFunction(lambdaFn, {
      event: events.RuleTargetInput.fromObject({/* event parameters */})
    }));
  }
}
