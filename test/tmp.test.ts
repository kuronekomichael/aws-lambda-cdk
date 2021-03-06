import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import Tmp = require('../lib/tmp-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Tmp.TmpStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});