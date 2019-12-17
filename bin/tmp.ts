#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { TmpStack } from '../lib/tmp-stack';

const app = new cdk.App();
new TmpStack(app, 'TmpStack');
