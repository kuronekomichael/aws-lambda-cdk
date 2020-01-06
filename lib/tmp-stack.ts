import cdk = require('@aws-cdk/core');
import lambda = require('@aws-cdk/aws-lambda');
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import targets = require('@aws-cdk/aws-events-targets');
import { ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';

export class TmpStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IAM Role for Lambda
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

    const eventTargetLambda = new targets.LambdaFunction(lambdaFn, {
      event: events.RuleTargetInput.fromObject({/* event parameters */})
    });

    // Cron
    const timerRuleEndOfMonth = new events.Rule(this, 'timerRuleEndOfMonth', {
      schedule: events.Schedule.expression(`cron(0 1 L * ? *)`), // 月末日のAM10時
      //                                         │ │ │ │ │ └ Year
      //                                         │ │ │ │ └ Day-of-week (?=いずれかの曜日)
      //                                         │ │ │ └ Month
      //                                         │ │ └ Day-of-month
      //                                         │ └ Hours(UTC)
      //                                         └ Minutes
    });
    const timerRuleBeginningOfMonth = new events.Rule(this, 'timerRuleBeginningOfMonth', {
      schedule: events.Schedule.expression(`cron(0 1 1 * ? *)`), // 月末日のAM10時
      //                                         │ │ │ │ │ └ Year
      //                                         │ │ │ │ └ Day-of-week (?=いずれかの曜日)
      //                                         │ │ │ └ Month
      //                                         │ │ └ Day-of-month
      //                                         │ └ Hours(UTC)
      //                                         └ Minutes
    });

    timerRuleEndOfMonth.addTarget(eventTargetLambda);
    timerRuleBeginningOfMonth.addTarget(eventTargetLambda);
  }
}
